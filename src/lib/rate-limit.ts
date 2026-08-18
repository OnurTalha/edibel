/*
 * Hız sınırlama (bkz. CLAUDE.md, Faz 9): cihaz başına dakikada en fazla on
 * tarama. Sayaç kapsayıcı belleğinde tutulur; uygulama tek kapsayıcı olarak
 * dağıtıldığı için bu yeterlidir (bkz. Bölüm 2: ayrı arka uç sunucusu
 * kurulmaz). Kapsayıcı yeniden başlarsa sayaçlar sıfırlanır.
 *
 * Kayıtlar yalnızca zaman damgalarından oluşur; istek gövdesi, metin veya
 * başka bir kullanıcı verisi tutulmaz.
 */

export const SCAN_LIMIT_PER_MINUTE = 10;
const WINDOW_MS = 60_000;
const MAX_TRACKED_KEYS = 10_000;

type Buckets = Map<string, number[]>;

/* Geliştirmede sıcak yeniden yükleme sayaçları sıfırlamasın */
const globalStore = globalThis as unknown as {
  __edibelRateBuckets?: Buckets;
};
const buckets: Buckets = (globalStore.__edibelRateBuckets ??= new Map());

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function checkRateLimit(
  key: string,
  limit: number = SCAN_LIMIT_PER_MINUTE,
  windowMs: number = WINDOW_MS,
): RateLimitResult {
  const now = Date.now();
  const threshold = now - windowMs;

  const recent = (buckets.get(key) ?? []).filter((time) => time > threshold);

  if (recent.length >= limit) {
    const oldest = recent[0] ?? now;
    buckets.set(key, recent);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((oldest + windowMs - now) / 1000),
      ),
    };
  }

  recent.push(now);
  buckets.set(key, recent);

  /* Bellek sınırsız büyümesin: eskimiş anahtarlar temizlenir */
  if (buckets.size > MAX_TRACKED_KEYS) {
    for (const [bucketKey, times] of buckets) {
      const alive = times.filter((time) => time > threshold);
      if (alive.length === 0) buckets.delete(bucketKey);
      else buckets.set(bucketKey, alive);
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - recent.length),
    retryAfterSeconds: 0,
  };
}
