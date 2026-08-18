import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { scans } from "@/db/schema";
import {
  analysisResultSchema,
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
    const rows = await db
      .select({
        id: scans.id,
        createdAt: scans.createdAt,
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
      const summary = summarySchema.safeParse(row.verdict);
      /* Okunamayan eski kayıt listeyi bozmaz, atlanır */
      if (!summary.success) continue;
      items.push({
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
    console.error("scan list route error:", err);
    return NextResponse.json(
      { error: "Geçmiş yüklenemedi. Lütfen biraz sonra tekrar deneyin." },
      { status: 500 },
    );
  }
}
