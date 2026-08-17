/*
 * Edibel uygulama simgelerini üretir.
 *
 * Simge, yazı tipi kurulumuna bağımlı kalmamak için geometrik olarak
 * çizilmiş küçük "e" harfidir: yeşil zemin üzerinde, daire yayı ve orta
 * çizgiden oluşan harf. Çıktılar public/icons altına ve tarayıcı sekme
 * simgesi olarak src/app/icon.png yoluna yazılır.
 *
 * Çalıştırma: npm run icons
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, "public", "icons");

/*
 * Geometrik "e": merkez (256, 266), yarıçap 108, kalem kalınlığı 58.
 * Yay, saat yönünün tersine 0 dereceden 315 dereceye süpürülür; sağ altta
 * kalan boşluk harfin ağzıdır. Orta çizgi dairenin tam çapı boyunca uzanır.
 */
const GLYPH = `
  <g stroke="#ffffff" stroke-width="58" stroke-linecap="round" fill="none">
    <path d="M 364 266 A 108 108 0 1 0 332.4 342.4" />
    <path d="M 148 266 L 364 266" />
  </g>`;

const GRADIENT = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#14915a" />
      <stop offset="1" stop-color="#0b6a40" />
    </linearGradient>
  </defs>`;

/* Köşeleri yuvarlatılmış sürüm: tarayıcı sekmesi ve klasik simge alanları */
const roundedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${GRADIENT}
  <rect width="512" height="512" rx="116" fill="url(#bg)" />
  ${GLYPH}
</svg>`;

/*
 * Tam kare sürüm: maskable simgeler ve iOS ana ekran simgesi. Bu alanlarda
 * kırpmayı işletim sistemi yapar, bu yüzden zemin tuvalin tamamını kaplar.
 * Harf, maskable güvenli bölgesinin (merkezde %80'lik daire) içinde kalır.
 */
const squareSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${GRADIENT}
  <rect width="512" height="512" fill="url(#bg)" />
  ${GLYPH}
</svg>`;

async function render(svg, size, file) {
  await sharp(Buffer.from(svg), { density: 300 })
    .resize(size, size)
    .png()
    .toFile(file);
  console.log(`yazıldı: ${path.relative(root, file)}`);
}

await mkdir(outDir, { recursive: true });

await render(roundedSvg, 192, path.join(outDir, "icon-192.png"));
await render(roundedSvg, 512, path.join(outDir, "icon-512.png"));
await render(squareSvg, 192, path.join(outDir, "icon-maskable-192.png"));
await render(squareSvg, 512, path.join(outDir, "icon-maskable-512.png"));
await render(squareSvg, 180, path.join(outDir, "apple-touch-icon.png"));
await render(roundedSvg, 192, path.join(root, "src", "app", "icon.png"));
