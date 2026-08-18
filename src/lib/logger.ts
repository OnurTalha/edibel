import { createHash } from "node:crypto";

/*
 * Yapılandırılmış günlük kaydı (bkz. CLAUDE.md, Faz 9).
 *
 * Günlükler stdout'a tek satırlık JSON olarak yazılır; kapsayıcı günlüğünü
 * okuyan her araç bunu ayrıştırabilir.
 *
 * KİŞİSEL VERİ YAZILMAZ. Şunlar hiçbir koşulda günlüğe girmez:
 *  - etiketten okunan ham metin, çeviriler ve malzeme adları
 *  - fotoğraf verisi (zaten sunucuda saklanmaz)
 *  - cihaz kimliği ve IP adresi
 * Cihaz kimliği yerine, aynı cihazın isteklerini ilişkilendirmeye yeten
 * kısaltılmış bir özet (deviceHash) yazılır; bu özetten kimliğe dönülemez
 * ve kayıt tutulmaz.
 */

export type LogLevel = "info" | "warn" | "error";

type LogValue = string | number | boolean | null | undefined;

export function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function logEvent(
  level: LogLevel,
  event: string,
  fields: Record<string, LogValue> = {},
): void {
  const entry: Record<string, LogValue> = {
    ts: new Date().toISOString(),
    level,
    app: "edibel",
    event,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

/* Hata türü günlüğe yazılır; hata metni kullanıcı verisi içerebileceğinden
   yalnızca sınıf adı ve kısa bir tür etiketi kaydedilir. */
export function errorKind(error: unknown): string {
  if (error instanceof Error) return error.name;
  return typeof error;
}
