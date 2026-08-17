import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/*
 * PostgreSQL bağlantısı süreç başına tek kez kurulur. Next.js geliştirme
 * modunda modüller sıcak yeniden yükleme ile defalarca değerlendirildiği
 * için istemci global nesnede saklanır; aksi halde bağlantı havuzu şişer.
 */
declare global {
  var __edibelSql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL ortam değişkeni tanımlı değil.");
  }
  return postgres(url, {
    max: 10,
    // Boşta kalan bağlantılar kapatılır; uygulama düşük kaynakla çalışır
    idle_timeout: 30,
    connect_timeout: 10,
  });
}

export const sql = globalThis.__edibelSql ?? createClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__edibelSql = sql;
}

/* Drizzle örneği; tablo şeması Faz 2'de eklenecektir. */
export const db = drizzle(sql);
