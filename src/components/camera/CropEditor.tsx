"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  centeredView,
  clampCropView,
  containScale,
  cropToJpegBase64,
  loadImage,
  viewToCropRect,
  type CropView,
} from "@/lib/ui/image";
import { STR } from "@/lib/ui/strings";

/*
 * Ekran 2: kırpma (bkz. CLAUDE.md, Bölüm 9).
 * Kullanıcı yalnızca içindekiler bölümünü çerçeveye alır; bu adım Doğu Asya
 * etiketlerinde okuma başarısını artırır çünkü model gereksiz alana
 * dağılmaz. Parmakla yakınlaştırma ve kaydırma desteklenir (pointer olayları;
 * fare üzerine gelme durumuna bağlı hiçbir işlev yoktur).
 *
 * Başlangıçta fotoğrafın TAMAMI görünür (sığdırma). Kaplama kullanılsaydı
 * dikey çerçeve, yatay çekilmiş bir fotoğrafın kenarlarını kullanıcı daha
 * hiçbir şey yapmadan kırpardı. Yakınlaştırıldığında kaydırma, çerçevenin
 * dışına boşluk bırakmayacak biçimde sınırlandırılır.
 */

const MAX_ZOOM = 8;

export function CropEditor({
  file,
  onCancel,
  onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (imageBase64: string) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const frame = useRef({ w: 0, h: 0 });
  const view = useRef<CropView>({ scale: 1, tx: 0, ty: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const frameOrigin = useRef({ left: 0, top: 0 });

  const [source, setSource] = useState<{
    image: HTMLImageElement;
    url: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let released: (() => void) | null = null;
    let cancelled = false;

    loadImage(file)
      .then(({ image, url, release }) => {
        if (cancelled) {
          release();
          return;
        }
        released = release;
        setSource({ image, url });
      })
      .catch(() => {
        if (!cancelled) setError(STR.imageLoadFailed);
      });

    return () => {
      cancelled = true;
      released?.();
    };
  }, [file]);

  const imageSize = useCallback(() => {
    const image = source?.image;
    if (!image) return null;
    return { w: image.naturalWidth, h: image.naturalHeight };
  }, [source]);

  const minScale = useCallback(() => {
    const image = imageSize();
    if (!image || frame.current.w === 0) return 1;
    return containScale(image, frame.current);
  }, [imageSize]);

  const applyTransform = useCallback(() => {
    const element = imgRef.current;
    if (!element) return;
    const { scale, tx, ty } = view.current;
    element.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
  }, []);

  const clampView = useCallback(() => {
    const image = imageSize();
    if (!image) return;
    if (frame.current.w === 0 || frame.current.h === 0) return;
    view.current = clampCropView(
      view.current,
      image,
      frame.current,
      MAX_ZOOM,
    );
  }, [imageSize]);

  /* Çerçeve ölçüsü hazır olduğunda görüntüyü ortalayarak yerleştirir */
  useEffect(() => {
    const image = source?.image;
    const element = frameRef.current;
    if (!image || !element) return;

    const measure = () => {
      const w = element.clientWidth;
      const h = element.clientHeight;
      if (w === 0 || h === 0) return;
      const first = frame.current.w === 0;
      if (!first && w === frame.current.w && h === frame.current.h) return;
      frame.current = { w, h };
      if (first) {
        view.current = centeredView(
          { w: image.naturalWidth, h: image.naturalHeight },
          frame.current,
        );
      } else {
        clampView();
      }
      applyTransform();
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [source, clampView, applyTransform]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    frameOrigin.current = { left: rect.left, top: rect.top };
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    pinch.current = null;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const current = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, current);

    const points = [...pointers.current.values()];
    const v = view.current;

    if (points.length === 1) {
      /* Tek parmak: kaydırma */
      v.tx += current.x - previous.x;
      v.ty += current.y - previous.y;
    } else {
      const a = points[0];
      const b = points[1];
      if (!a || !b) return;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2 - frameOrigin.current.left;
      const cy = (a.y + b.y) / 2 - frameOrigin.current.top;
      const last = pinch.current;
      if (!last || last.dist === 0 || dist === 0) {
        pinch.current = { dist, cx, cy };
        return;
      }
      /* İki parmak: iki parmağın orta noktasını sabit tutan yakınlaştırma */
      const lower = minScale();
      const desired = v.scale * (dist / last.dist);
      const clamped = Math.min(Math.max(desired, lower), lower * MAX_ZOOM);
      const factor = clamped / v.scale;
      v.tx = last.cx - (last.cx - v.tx) * factor + (cx - last.cx);
      v.ty = last.cy - (last.cy - v.ty) * factor + (cy - last.cy);
      v.scale = clamped;
      pinch.current = { dist, cx, cy };
    }

    clampView();
    applyTransform();
  };

  const endPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    pinch.current = null;
  };

  const confirm = () => {
    const image = source?.image;
    if (!image || busy) return;
    setBusy(true);
    try {
      /* Çerçevede görünen alan, görüntü pikseli cinsine çevrilerek kırpılır */
      const base64 = cropToJpegBase64(
        image,
        viewToCropRect(view.current, frame.current),
      );
      onConfirm(base64);
    } catch {
      setError(STR.imageLoadFailed);
      setBusy(false);
    }
  };

  return (
    /* min-h-0: esnek kutuda içerik, kutuyu kendi doğal boyuna şişirmesin */
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-6 pt-4">
        <h1 className="text-lg font-semibold text-white">{STR.cropTitle}</h1>
        <p className="mt-1 text-sm text-white/70">{STR.cropHint}</p>
      </div>

      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        className="relative mx-4 mt-4 min-h-0 flex-1 touch-none select-none overflow-hidden rounded-2xl border border-white/25 bg-black"
      >
        {source ? (
          // eslint-disable-next-line @next/next/no-img-element -- yerel nesne bağlantısı; next/image kullanılamaz
          <img
            ref={imgRef}
            src={source.url}
            alt=""
            draggable={false}
            style={{
              width: source.image.naturalWidth,
              height: source.image.naturalHeight,
              transformOrigin: "0 0",
              willChange: "transform",
            }}
            /* absolute: doğal boyutuyla çerçevenin ölçüsünü etkilemesin */
            className="absolute left-0 top-0 max-w-none origin-top-left"
          />
        ) : null}
        {error ? (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-[15px] text-white">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex gap-3 px-4 py-5">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[52px] flex-1 rounded-2xl border border-white/30 px-4 text-[15px] font-medium text-white"
        >
          {STR.cropRetake}
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={!source || busy || error !== null}
          className="min-h-[52px] flex-[1.4] rounded-2xl bg-emerald-500 px-4 text-[15px] font-semibold text-black disabled:opacity-50"
        >
          {STR.cropConfirm}
        </button>
      </div>
    </div>
  );
}
