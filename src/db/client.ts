import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/*
 * PostgreSQL bağlantısı süreç başına tek kez, İLK KULLANIMDA kurulur.
 *
 * Bağlantı tembel kurulur çünkü `next build` sırasında rota modülleri
 * içe aktarılır ve o anda ortam değişkenleri bulunmaz (üretim imajında
 * gizli bilgi yoktur). Modül yüklenirken bağlantı kurulsaydı derleme
 * DATABASE_URL olmadan başarısız olurdu.
 *
 * Next.js geliştirme modunda modüller sıcak yeniden yükleme ile defalarca
 * değerlendirildiği için istemci global nesnede saklanır; aksi halde
 * bağlantı havuzu şişer.
 */
declare global {
  var __edibelSql: ReturnType<typeof postgres> | undefined;
  var __edibelDb: PostgresJsDatabase | undefined;
}

export function getSql(): ReturnType<typeof postgres> {
  const existing = globalThis.__edibelSql;
  if (existing) return existing;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL ortam değişkeni tanımlı değil.");
  }
  const client = postgres(url, {
    max: 10,
    // Boşta kalan bağlantılar kapatılır; uygulama düşük kaynakla çalışır
    idle_timeout: 30,
    connect_timeout: 10,
  });
  globalThis.__edibelSql = client;
  return client;
}

export function getDb(): PostgresJsDatabase {
  const existing = globalThis.__edibelDb;
  if (existing) return existing;

  const instance = drizzle(getSql());
  globalThis.__edibelDb = instance;
  return instance;
}
