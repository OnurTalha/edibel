/*
 * Katman 1: tarayıcıda görüntü ön işleme (bkz. CLAUDE.md, Mimari).
 * Fotoğraf kırpılır, uzun kenarı 2000 piksele indirilir ve JPEG olarak
 * sıkıştırılır. Sunucuya ham fotoğraf gönderilmez; yalnızca bu adımdan
 * çıkan base64 dizesi gönderilir.
 */

export const MAX_LONG_EDGE = 2000;
const JPEG_QUALITY = 0.85;

export type CropRect = { sx: number; sy: number; sw: number; sh: number };

/*
 * Kırpma görünümü: görüntü, çerçevenin sol üst köşesine göre (tx, ty)
 * kaydırılır ve scale oranıyla ölçeklenir. Aşağıdaki dört fonksiyon saftır;
 * kırpma ekranındaki dokunma hareketleri bunları kullanır.
 */
export type Size = { w: number; h: number };
export type CropView = { scale: number; tx: number; ty: number };

/* Görüntünün çerçeveyi tamamen kapladığı en küçük ölçek */
export function coverScale(image: Size, frame: Size): number {
  return Math.max(frame.w / image.w, frame.h / image.h);
}

export function centeredView(image: Size, frame: Size): CropView {
  const scale = coverScale(image, frame);
  return {
    scale,
    tx: (frame.w - image.w * scale) / 2,
    ty: (frame.h - image.h * scale) / 2,
  };
}

/*
 * Ölçeği [cover, cover * maxZoom] aralığına, kaydırmayı da çerçevenin
 * dışında boşluk kalmayacak biçimde sınırlar.
 */
export function clampCropView(
  view: CropView,
  image: Size,
  frame: Size,
  maxZoom: number,
): CropView {
  const lower = coverScale(image, frame);
  const scale = Math.min(Math.max(view.scale, lower), lower * maxZoom);
  const displayedW = image.w * scale;
  const displayedH = image.h * scale;
  return {
    scale,
    tx: Math.min(0, Math.max(frame.w - displayedW, view.tx)),
    ty: Math.min(0, Math.max(frame.h - displayedH, view.ty)),
  };
}

/* Çerçevede görünen alanın görüntü pikseli cinsinden karşılığı */
export function viewToCropRect(view: CropView, frame: Size): CropRect {
  return {
    sx: -view.tx / view.scale,
    sy: -view.ty / view.scale,
    sw: frame.w / view.scale,
    sh: frame.h / view.scale,
  };
}

/*
 * Dosyayı yükler ve nesne bağlantısını serbest bırakacak fonksiyonu birlikte
 * döndürür; bağlantı, görüntü ekranda gösterildiği sürece geçerli kalmalıdır.
 */
export type LoadedImage = { image: HTMLImageElement; url: string; release: () => void };

export function loadImage(file: Blob): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const release = () => URL.revokeObjectURL(url);
    const image = new Image();
    /* Tarayıcı EXIF yönlendirmesini kendisi uygular; ek döndürme gerekmez */
    image.onload = () => {
      if (image.naturalWidth === 0 || image.naturalHeight === 0) {
        release();
        reject(new Error("Görüntü boyutu okunamadı"));
        return;
      }
      resolve({ image, url, release });
    };
    image.onerror = () => {
      release();
      reject(new Error("Görüntü yüklenemedi"));
    };
    image.src = url;
  });
}

/*
 * Kırpma dikdörtgeni görüntü pikseli cinsindendir. Sonuç, uzun kenarı en
 * fazla 2000 piksel olan JPEG'in base64 gövdesidir (veri öneki içermez).
 */
export function cropToJpegBase64(
  image: HTMLImageElement,
  rect: CropRect,
): string {
  const sx = Math.max(0, Math.min(rect.sx, image.naturalWidth - 1));
  const sy = Math.max(0, Math.min(rect.sy, image.naturalHeight - 1));
  const sw = Math.max(1, Math.min(rect.sw, image.naturalWidth - sx));
  const sh = Math.max(1, Math.min(rect.sh, image.naturalHeight - sy));

  /* Yalnızca küçültme yapılır; küçük etiket fotoğrafı büyütülmez */
  const ratio = Math.min(1, MAX_LONG_EDGE / Math.max(sw, sh));
  const outWidth = Math.max(1, Math.round(sw * ratio));
  const outHeight = Math.max(1, Math.round(sh * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tuval bağlamı oluşturulamadı");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  /* Şeffaf PNG kaynaklarında JPEG'in siyah zemin üretmemesi için */
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outWidth, outHeight);
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outWidth, outHeight);

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const comma = dataUrl.indexOf(",");
  if (comma === -1) throw new Error("JPEG üretilemedi");
  return dataUrl.slice(comma + 1);
}

/* Canlı kamera karesini dosyaya çevirir; ardından kırpma ekranına gider */
export function canvasToJpegFile(canvas: HTMLCanvasElement): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Kare yakalanamadı"));
          return;
        }
        resolve(new File([blob], "etiket.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  });
}
