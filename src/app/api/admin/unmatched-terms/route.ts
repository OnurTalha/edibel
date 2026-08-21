import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { unmatchedTerms } from "@/db/schema";
import { errorKind, hashIdentifier, logEvent } from "@/lib/logger";
import { matchIngredient } from "@/lib/matching";
import type { DetectedLanguage } from "@/lib/parsing";
import { checkRateLimit } from "@/lib/rate-limit";
import { STR } from "@/lib/ui/strings";

/*
 * Yönetim sayfasının veri kaynağı (bkz. CLAUDE.md, Bölüm 6 ve Faz 8).
 * En sık karşılaşılan eşleşmeyen terimler görülür ve içerik veritabanına
 * eklenecek malzemeler buradan belirlenir.
 *
 * Uygulamanın geri kalanı herkese açıktır; korunan tek yol budur. Anahtar
 * yalnızca sunucuda okunur ve karşılaştırma sabit sürelidir.
 */

export const dynamic = "force-dynamic";

const MAX_ITEMS = 500;

/*
 * Yeniden deneme sırasında aynı anda açılacak en fazla sorgu sayısı.
 * Bağlantı havuzu 10'dur; kalan pay, yönetim sayfası açıkken gelen gerçek
 * analiz isteklerine bırakılır.
 */
const RECHECK_CONCURRENCY = 6;

const LANGUAGES: readonly DetectedLanguage[] = [
  "ja",
  "ko",
  "zh_hans",
  "zh_hant",
  "en",
  "other",
];

/* Tablodaki dil sütunu metindir; bilinmeyen değer "other" sayılır */
function toDetectedLanguage(value: string): DetectedLanguage {
  return LANGUAGES.includes(value as DetectedLanguage)
    ? (value as DetectedLanguage)
    : "other";
}

interface ResolvedState {
  matched: boolean;
  method: "exact" | "alias" | "fuzzy" | null;
  ingredientNameTr: string | null;
}

/*
 * Kaydedilmiş terimi GÜNCEL içerik veritabanına karşı yeniden dener.
 *
 * unmatched_terms bir geçmiş kaydıdır: terim kaydedildikten sonra içerik
 * veritabanına eklenmiş olabilir. Yönetim sayfası bu ayrımı göstermezse
 * liste, çoktan halledilmiş satırlarla dolar ve gerçekten eksik olanlar
 * görünmez olur.
 *
 * Kontrol, analiz akışının kullandığı motorun ta kendisiyle yapılır; ayrı
 * bir sorgu yazılsaydı sayfa "artık eşleşiyor" derken analiz hâlâ
 * eşleştiremiyor olabilirdi. İki fark bilinçlidir: eşleşmeyen terim tekrar
 * kaydedilmez (recordUnmatched: false) ve gömme yöntemi çalıştırılmaz
 * (skipEmbedding: true), çünkü o yöntem terim başına harici arayüz çağrısı
 * gerektirir. Bu sebeple gömme ile eşleşebilecek bir terim burada eksik
 * görünebilir; ters yönde hata olmaz.
 */
async function recheck(term: string, language: string): Promise<ResolvedState> {
  const result = await matchIngredient(
    { rawText: term, sourceHint: null },
    {
      language: toDetectedLanguage(language),
      allergenContainsPork: false,
      recordUnmatched: false,
      skipEmbedding: true,
    },
  );

  if (result.method === "unmatched" || !result.ingredient) {
    return { matched: false, method: null, ingredientNameTr: null };
  }
  /* skipEmbedding sebebiyle geriye yalnızca ilk üç yöntem kalır */
  const method =
    result.method === "embedding" ? "fuzzy" : result.method;
  return {
    matched: true,
    method,
    ingredientNameTr: result.ingredient.canonicalNameTr,
  };
}

/* Sıralı beklemeyi önlemek için sınırlı sayıda terim aynı anda denenir */
async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const index = next++;
        const item = items[index];
        if (item === undefined) return;
        out[index] = await fn(item);
      }
    },
  );
  await Promise.all(workers);
  return out;
}

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: STR.adminNotConfigured },
      { status: 503 },
    );
  }

  /*
   * Anahtar denemesi kaba kuvvete karşı sınırlanır. İstemci adresi yalnızca
   * sayaç anahtarı olarak kullanılır; günlüğe adres değil, geri
   * döndürülemez kısa özeti yazılır.
   */
  const clientAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "bilinmiyor";
  const attempts = checkRateLimit(`admin:${clientAddress}`, 20);
  if (!attempts.allowed) {
    logEvent("warn", "admin.rate_limited", {
      clientHash: hashIdentifier(clientAddress),
    });
    return NextResponse.json(
      { error: STR.rateLimited },
      {
        status: 429,
        headers: { "Retry-After": String(attempts.retryAfterSeconds) },
      },
    );
  }

  const provided = request.headers.get("x-admin-token") ?? "";
  if (!tokenMatches(provided, expected)) {
    logEvent("warn", "admin.unauthorized", {
      clientHash: hashIdentifier(clientAddress),
    });
    return NextResponse.json({ error: STR.adminTokenWrong }, { status: 401 });
  }

  try {
    const rows = await getDb()
      .select()
      .from(unmatchedTerms)
      .orderBy(desc(unmatchedTerms.occurrenceCount), desc(unmatchedTerms.lastSeenAt))
      .limit(MAX_ITEMS);

    /* Her satır güncel içerik veritabanına karşı yeniden denenir */
    const resolved = await mapWithLimit(rows, RECHECK_CONCURRENCY, (row) =>
      recheck(row.term, row.language),
    );

    return NextResponse.json({
      terms: rows.map((row, index) => ({
        id: row.id,
        term: row.term,
        language: row.language,
        modelTranslationTr: row.modelTranslationTr,
        occurrenceCount: row.occurrenceCount,
        lastSeenAt: row.lastSeenAt.toISOString(),
        resolved: resolved[index] ?? {
          matched: false,
          method: null,
          ingredientNameTr: null,
        },
      })),
    });
  } catch (err) {
    logEvent("error", "admin.list_error", { kind: errorKind(err) });
    return NextResponse.json(
      { error: "Liste yüklenemedi. Lütfen biraz sonra tekrar deneyin." },
      { status: 500 },
    );
  }
}
