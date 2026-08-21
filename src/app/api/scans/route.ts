import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { scans } from "@/db/schema";
import { errorKind, logEvent } from "@/lib/logger";
import {
  analysisResultSchema,
  menuResultSchema,
  type ScanList,
  type ScanListItem,
} from "@/lib/schemas";

/*
 * Cihazın geçmiş taramaları (bkz. CLAUDE.md, Faz 8).
 * Kayıtlar anonim cihaz kimliğiyle ilişkilendirilir; kişisel veri
 * saklanmaz ve fotoğraflar hiçbir zaman sunucuya yazılmaz.
 */

export const dynamic = "force-dynamic";

const MAX_ITEMS = 50;
const PREVIEW_LENGTH = 120;

const querySchema = z.object({
  deviceId: z.string().min(1).max(128),
});

/* Geçmiş listesinde yalnızca özet alanlar gösterilir */
const summarySchema = analysisResultSchema.pick({
  verdict: true,
  unmatchedCount: true,
  detectedLanguage: true,
});

/* Menü taramasının özeti: yemek sayısı ve karar dağılımı */
const menuSummarySchema = menuResultSchema.pick({
  detectedLanguage: true,
  dishes: true,
  summary: true,
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    deviceId: url.searchParams.get("deviceId") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçmiş yüklenemedi. Lütfen uygulamayı yenileyin." },
      { status: 400 },
    );
  }

  try {
    const rows = await getDb()
      .select({
        id: scans.id,
        createdAt: scans.createdAt,
        scanType: scans.scanType,
        detectedLanguage: scans.detectedLanguage,
        rawText: scans.rawText,
        verdict: scans.verdict,
      })
      .from(scans)
      .where(eq(scans.deviceId, parsed.data.deviceId))
      .orderBy(desc(scans.createdAt))
      .limit(MAX_ITEMS);

    const items: ScanListItem[] = [];
    for (const row of rows) {
      if (row.scanType === "menu") {
        const menu = menuSummarySchema.safeParse(row.verdict);
        if (!menu.success) continue;
        items.push({
          scanType: "menu",
          scanId: row.id,
          createdAt: row.createdAt.toISOString(),
          detectedLanguage: menu.data.detectedLanguage,
          dishCount: menu.data.dishes.length,
          summary: menu.data.summary,
          /* Önizleme: ilk yemeklerin Türkçe adları */
          preview: menu.data.dishes
            .map((dish) => dish.nameTr)
            .join(", ")
            .slice(0, PREVIEW_LENGTH),
        });
        continue;
      }

      const summary = summarySchema.safeParse(row.verdict);
      /* Okunamayan eski kayıt listeyi bozmaz, atlanır */
      if (!summary.success) continue;
      items.push({
        scanType: "etiket",
        scanId: row.id,
        createdAt: row.createdAt.toISOString(),
        detectedLanguage: summary.data.detectedLanguage,
        verdict: summary.data.verdict,
        unmatchedCount: summary.data.unmatchedCount,
        preview: row.rawText.slice(0, PREVIEW_LENGTH),
      });
    }

    const response: ScanList = { scans: items };
    return NextResponse.json(response);
  } catch (err) {
    logEvent("error", "scans.list_error", { kind: errorKind(err) });
    return NextResponse.json(
      { error: "Geçmiş yüklenemedi. Lütfen biraz sonra tekrar deneyin." },
      { status: 500 },
    );
  }
}
