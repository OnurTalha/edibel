/*
 * Edibel hizmet çalışanı (elle yazılmıştır).
 *
 * Amaç: uygulamanın telefona kurulabilmesi ve bağlantı koptuğunda anlamlı
 * bir ekran gösterilmesi. Analiz istekleri (POST /api/analyze) hiçbir zaman
 * önbelleğe alınmaz; yalnızca GET istekleri ele alınır. Daha önce
 * görüntülenmiş tarama sonuçları çevrimdışıyken de açılabilsin diye
 * /api/scans/... yanıtları önbellekten sunulabilir.
 */

const VERSION = "edibel-v2";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const OFFLINE_URL = "/cevrimdisi";

const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

/*
 * Çevrimdışı sayfası, uygulamanın kendi sayfasıdır ve çalışması için kendi
 * betik dosyalarına ihtiyaç duyar. Bu sebeple sayfanın HTML'i ile birlikte
 * içinde geçen /_next varlıkları da kurulum sırasında önbelleğe alınır;
 * aksi halde sunucuya ulaşılamadığında sayfa yarım açılır.
 */
async function precacheOfflinePage(cache) {
  const response = await fetch(OFFLINE_URL, { cache: "reload" });
  if (!response.ok) return;
  const html = await response.clone().text();
  await cache.put(OFFLINE_URL, response);

  const assets = new Set();
  const pattern = /(?:src|href)="(\/_next\/[^"]+)"/g;
  let match = pattern.exec(html);
  while (match !== null) {
    assets.add(match[1]);
    match = pattern.exec(html);
  }

  await Promise.all(
    [...assets].map(async (asset) => {
      try {
        const assetResponse = await fetch(asset);
        if (assetResponse.ok) await cache.put(asset, assetResponse);
      } catch {
        /* Tek bir varlık alınamazsa kurulum yine de sürer */
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE_URLS);
      await precacheOfflinePage(cache);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function navigationStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    /*
     * Daha önce açılmamış bir adres istendiğinde çevrimdışı sayfasının
     * gövdesi doğrudan döndürülemez: adres ile sayfa eşleşmediğinde
     * uygulama yönlendiricisi hata verir. Bunun yerine çevrimdışı adresine
     * yönlendirilir ve o sayfa önbellekten sunulur.
     */
    const url = new URL(request.url);
    if (url.pathname !== OFFLINE_URL) {
      return Response.redirect(OFFLINE_URL, 302);
    }
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  /* Analiz isteği dahil hiçbir POST önbelleğe alınmaz */
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationStrategy(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  /* Görüntülenmiş sonuçlar çevrimdışıyken de açılabilsin */
  if (url.pathname.startsWith("/api/scans/")) {
    event.respondWith(networkFirst(request));
  }
  /* Diğer API istekleri doğrudan ağa gider, önbelleğe alınmaz */
});
