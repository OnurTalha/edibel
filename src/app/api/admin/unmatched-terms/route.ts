import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { unmatchedTerms } from "@/db/schema";
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

  const provided = request.headers.get("x-admin-token") ?? "";
  if (!tokenMatches(provided, expected)) {
    return NextResponse.json({ error: STR.adminTokenWrong }, { status: 401 });
  }

  try {
    const rows = await db
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
    console.error("admin unmatched-terms route error:", err);
    return NextResponse.json(
      { error: "Liste yüklenemedi. Lütfen biraz sonra tekrar deneyin." },
      { status: 500 },
    );
  }
}
