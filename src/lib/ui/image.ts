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

/* Görüntünün tamamının çerçeveye sığdığı en büyük ölçek */
export function containScale(image: Size, frame: Size): number {
  return Math.min(frame.w / image.w, frame.h / image.h);
}

/*
 * Başlangıç görünümü fotoğrafın TAMAMINI gösterir.
 *
 * Kaplama (cover) kullanılmaz: çerçeve dikey, telefon fotoğrafları ise
 * çoğunlukla yataydır; kaplama, kullanıcı daha hiçbir şey yapmadan
 * görüntünün kenarlarını kırpar ve etiketin bir kısmı görünmeden analize
 * gider. Kullanıcı isterse yakınlaştırıp yalnızca içindekiler bölümünü
 * seçer (bkz. CLAUDE.md, Bölüm 9: Ekran 2).
 */
export function centeredView(image: Size, frame: Size): CropView {
  const scale = containScale(image, frame);
  return {
    scale,
    tx: (frame.w - image.w * scale) / 2,
    ty: (frame.h - image.h * scale) / 2,
  };
}

/*
 * Ölçeği [sığdırma, sığdırma * maxZoom] aralığına sınırlar. Kaydırma:
 * görüntü çerçeveden büyükse kenarların içeri kaçmasına izin verilmez,
 * küçükse (sığdırma görünümünde) ilgili eksende ortalanır.
 */
export function clampCropView(
  view: CropView,
  image: Size,
  frame: Size,
  maxZoom: number,
): CropView {
  const lower = containScale(image, frame);
  const scale = Math.min(Math.max(view.scale, lower), lower * maxZoom);
  const displayedW = image.w * scale;
  const displayedH = image.h * scale;
  return {
    scale,
    tx:
      displayedW <= frame.w
        ? (frame.w - displayedW) / 2
        : Math.min(0, Math.max(frame.w - displayedW, view.tx)),
    ty:
      displayedH <= frame.h
        ? (frame.h - displayedH) / 2
        : Math.min(0, Math.max(frame.h - displayedH, view.ty)),
  };
}

/*
 * Çerçevede görünen alanın görüntü pikseli cinsinden karşılığı.
 * Sığdırma görünümünde bu dikdörtgen görüntünün dışına taşabilir (kenarda
 * boş alan görünür); gerçek kırpma clampCropRectToImage ile sınırlanır.
 */
export function viewToCropRect(view: CropView, frame: Size): CropRect {
  return {
    sx: -view.tx / view.scale,
    sy: -view.ty / view.scale,
    sw: frame.w / view.scale,
    sh: frame.h / view.scale,
  };
}

/* Kırpma dikdörtgenini görüntü sınırlarına indirger; boş alan kırpılmaz */
export function clampCropRectToImage(rect: CropRect, image: Size): CropRect {
  const sx = Math.max(0, Math.min(rect.sx, image.w - 1));
  const sy = Math.max(0, Math.min(rect.sy, image.h - 1));
  return {
    sx,
    sy,
    sw: Math.max(1, Math.min(rect.sw, image.w - sx)),
    sh: Math.max(1, Math.min(rect.sh, image.h - sy)),
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
  const { sx, sy, sw, sh } = clampCropRectToImage(rect, {
    w: image.naturalWidth,
    h: image.naturalHeight,
  });

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
