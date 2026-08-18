import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { unmatchedTerms } from "@/db/schema";
import { errorKind, hashIdentifier, logEvent } from "@/lib/logger";
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

    return NextResponse.json({
      terms: rows.map((row) => ({
        id: row.id,
        term: row.term,
        language: row.language,
        modelTranslationTr: row.modelTranslationTr,
        occurrenceCount: row.occurrenceCount,
        lastSeenAt: row.lastSeenAt.toISOString(),
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
