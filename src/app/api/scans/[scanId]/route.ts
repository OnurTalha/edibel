import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { fiqhPrinciples, scans } from "@/db/schema";
import { errorKind, logEvent } from "@/lib/logger";
import {
  analysisResultSchema,
  menuResultSchema,
  type ScanResponse,
} from "@/lib/schemas";

/*
 * Kaydedilmiş tarama sonucunu döndürür. Sonuç nesnesi analiz anında
 * üretilmiş ve scans.verdict alanında saklanmıştır; burada yeniden
 * hesaplanmaz. Sonuçta geçen fıkhi ilkelerin açıklamaları, sonuç
 * ekranındaki "Gerekçeler" bölümü için ayrıca eklenir.
 */

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ scanId: z.uuid() });

/* Sonuçta geçen fıkhi ilkelerin açıklamaları ("Gerekçeler" bölümü) */
async function readPrinciples(keys: string[]) {
  if (keys.length === 0) return [];
  return getDb()
    .select({
      key: fiqhPrinciples.key,
      titleTr: fiqhPrinciples.titleTr,
      explanationTr: fiqhPrinciples.explanationTr,
    })
    .from(fiqhPrinciples)
    .where(inArray(fiqhPrinciples.key, keys));
}

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
      .select({ verdict: scans.verdict, scanType: scans.scanType })
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

    /* Menü taraması: yemek başına karar; sözlüğü ve ekranı ayrıdır */
    if (row.scanType === "menu") {
      const menu = menuResultSchema.safeParse(row.verdict);
      if (!menu.success) {
        return NextResponse.json(
          {
            error:
              "Bu taramanın sonucu okunamadı. Lütfen yeni bir tarama yapın.",
          },
          { status: 500 },
        );
      }
      const menuPrincipleKeys = [
        ...new Set(
          menu.data.dishes.flatMap((dish) =>
            dish.ingredients.flatMap((ingredient) =>
              ingredient.rulings.map((ruling) => ruling.principleKey),
            ),
          ),
        ),
      ];
      const response: ScanResponse = {
        scanType: "menu",
        result: menu.data,
        principles: await readPrinciples(menuPrincipleKeys),
      };
      return NextResponse.json(response);
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

    const response: ScanResponse = {
      scanType: "etiket",
      result: result.data,
      principles: await readPrinciples(principleKeys),
    };
    return NextResponse.json(response);
  } catch (err) {
    logEvent("error", "scan.read_error", { kind: errorKind(err) });
    return NextResponse.json(
      { error: "Sonuç yüklenemedi. Lütfen biraz sonra tekrar deneyin." },
      { status: 500 },
    );
  }
}
