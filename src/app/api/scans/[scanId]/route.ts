import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { fiqhPrinciples, scans } from "@/db/schema";
import { errorKind, logEvent } from "@/lib/logger";
import { analysisResultSchema, type ScanResponse } from "@/lib/schemas";

/*
 * Kaydedilmiş tarama sonucunu döndürür. Sonuç nesnesi analiz anında
 * üretilmiş ve scans.verdict alanında saklanmıştır; burada yeniden
 * hesaplanmaz. Sonuçta geçen fıkhi ilkelerin açıklamaları, sonuç
 * ekranındaki "Gerekçeler" bölümü için ayrıca eklenir.
 */

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ scanId: z.uuid() });

export async function GET(
  _request: Request,
  context: { params: Promise<{ scanId: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json(
      {
        error:
          "Bu tarama bulunamadı. Ana sayfadan yeni bir tarama başlatabilirsiniz.",
      },
      { status: 404 },
    );
  }

  try {
    const rows = await getDb()
      .select({ verdict: scans.verdict })
      .from(scans)
      .where(eq(scans.id, parsedParams.data.scanId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return NextResponse.json(
        {
          error:
            "Bu tarama bulunamadı. Ana sayfadan yeni bir tarama başlatabilirsiniz.",
        },
        { status: 404 },
      );
    }

    const result = analysisResultSchema.safeParse(row.verdict);
    if (!result.success) {
      return NextResponse.json(
        {
          error:
            "Bu taramanın sonucu okunamadı. Lütfen yeni bir tarama yapın.",
        },
        { status: 500 },
      );
    }

    const principleKeys = [
      ...new Set(
        result.data.problematicIngredients.flatMap((ingredient) =>
          ingredient.rulings.map((ruling) => ruling.principleKey),
        ),
      ),
    ];

    const principles =
      principleKeys.length > 0
        ? await getDb()
            .select({
              key: fiqhPrinciples.key,
              titleTr: fiqhPrinciples.titleTr,
              explanationTr: fiqhPrinciples.explanationTr,
            })
            .from(fiqhPrinciples)
            .where(inArray(fiqhPrinciples.key, principleKeys))
        : [];

    const response: ScanResponse = { result: result.data, principles };
    return NextResponse.json(response);
  } catch (err) {
    logEvent("error", "scan.read_error", { kind: errorKind(err) });
    return NextResponse.json(
      { error: "Sonuç yüklenemedi. Lütfen biraz sonra tekrar deneyin." },
      { status: 500 },
    );
  }
}
