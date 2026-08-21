"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FlashIcon } from "@/components/icons";
import { canvasToJpegFile } from "@/lib/ui/image";
import { STR } from "@/lib/ui/strings";

/*
 * İkincil kamera yolu (bkz. CLAUDE.md, Bölüm 8).
 * getUserMedia ile sayfa içinde canlı görüntü gösterilir ve hizalama
 * çerçevesi çizilir. Güvenli bağlam (https) zorunludur. Video öğesine
 * playsInline ve muted verilir, aksi halde iOS Safari görüntüyü tam ekrana
 * alır. Arka kamera facingMode: environment ile istenir. Flaş denetimi iOS
 * Safari'de desteklenmez; buton yalnızca desteklendiği tespit edildiğinde
 * gösterilir.
 */

type TorchCapabilities = { torch?: boolean };

export function LiveCamera({
  onCapture,
  fallback,
  /* Menü taramasında hizalama yönergesi farklıdır; varsayılan etikettir */
  hint = STR.liveCameraHint,
}: {
  onCapture: (file: File) => void;
  fallback: React.ReactNode;
  hint?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"starting" | "ready" | "error">(
    "starting",
  );
  const [message, setMessage] = useState("");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (!window.isSecureContext) {
        setMessage(STR.cameraInsecure);
        setStatus("error");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage(STR.cameraUnavailable);
        setStatus("error");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            /* Doğu Asya etiketlerindeki küçük karakterler için çözünürlük belirleyicidir */
            width: { ideal: 2560 },
            height: { ideal: 1440 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          try {
            await video.play();
          } catch {
            /* Bazı tarayıcılar oynatmayı kullanıcı hareketine bağlar */
          }
        }
        const track = stream.getVideoTracks()[0];
        const capabilities = track?.getCapabilities?.() as
          | TorchCapabilities
          | undefined;
        setTorchAvailable(Boolean(capabilities?.torch));
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "";
        setMessage(
          name === "NotAllowedError" || name === "SecurityError"
            ? STR.cameraDenied
            : STR.cameraUnavailable,
        );
        setStatus("error");
      }
    };

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next }],
      } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  }, [torchOn]);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || busy) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Tuval bağlamı oluşturulamadı");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      onCapture(await canvasToJpegFile(canvas));
    } catch {
      setMessage(STR.imageLoadFailed);
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }, [busy, onCapture]);

  if (status === "error") {
    return (
      <div className="flex flex-1 flex-col justify-end gap-5 px-6 pb-6">
        <p className="rounded-2xl bg-white/10 p-4 text-[15px] leading-relaxed text-white">
          {message}
        </p>
        {fallback}
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="relative flex-1 overflow-hidden bg-black">
        {/*
          Önizleme kırpılmadan gösterilir (object-contain): yakalanan kare
          kameranın tam görüntüsüdür; önizleme kırpılsaydı kullanıcı
          çerçeveye hizaladığı şeyden fazlasını çekmiş olurdu.
        */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-contain"
        />
        {/* Hizalama çerçevesi */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="h-3/5 w-full rounded-2xl border-2 border-dashed border-white/70" />
        </div>
        <p className="pointer-events-none absolute inset-x-0 top-4 px-6 text-center text-sm text-white drop-shadow">
          {status === "starting" ? STR.liveCameraStarting : hint}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 px-6 py-5">
        <div className="w-14">
          {torchAvailable ? (
            <button
              type="button"
              onClick={() => void toggleTorch()}
              aria-pressed={torchOn}
              className={`flex h-12 w-12 items-center justify-center rounded-full ${
                torchOn ? "bg-white text-black" : "bg-white/15 text-white"
              }`}
            >
              <FlashIcon className="h-6 w-6" />
              <span className="sr-only">
                {torchOn ? STR.flashOff : STR.flashOn}
              </span>
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => void capture()}
          disabled={status !== "ready" || busy}
          className="h-[76px] w-[76px] rounded-full border-4 border-white bg-white/25 disabled:opacity-50"
        >
          <span className="sr-only">{STR.capture}</span>
        </button>

        <div className="w-14" />
      </div>
    </div>
  );
}
