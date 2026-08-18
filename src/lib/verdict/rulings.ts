import { inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { madhhabRulings } from "@/db/schema";
import type { MatchResult } from "@/lib/matching";
import type { AppliedRuling, MadhhabKey, RulingStatus, VerdictItem } from "./types";

/*
 * Eşleşen malzemelere uygulanacak hüküm satırlarının seçimi.
 *
 * Bu dosya yalnızca VERİTABANI OKUMASI yapar; karar mantığının tamamı saf
 * fonksiyonlardan oluşan engine.ts içindedir. Yazma işlemi yoktur.
 *
 * Seçim kuralı: çözümlenmiş kaynağa (resolvedSource) özel hüküm varsa o
 * kullanılır; yoksa genel (resolvedSource = null) hüküm geçerlidir. Özel
 * bitkisel kaynaklar (soya, mısır, palm) için tanımlı hüküm yoksa varsa
 * "bitkisel" hükmüne düşülür — fıkhi ilke aynıdır (bitkisel asıl mübahlık).
 */

const SOURCE_FALLBACK: Record<string, string> = {
  soya: "bitkisel",
  misir: "bitkisel",
  palm: "bitkisel",
};

interface RulingRow {
  ingredientId: string;
  resolvedSource: string | null;
  madhhab: MadhhabKey;
  status: RulingStatus;
  principleKey: string;
  reasoningTr: string;
  sourceRef: string;
}

function pickApplicable(
  rows: RulingRow[],
  resolvedSource: string | null,
): AppliedRuling[] {
  const bySource = (src: string | null) =>
    rows.filter((r) => r.resolvedSource === src);

  let chosen: RulingRow[] = [];
  if (resolvedSource) {
    chosen = bySource(resolvedSource);
    if (chosen.length === 0 && SOURCE_FALLBACK[resolvedSource]) {
      chosen = bySource(SOURCE_FALLBACK[resolvedSource]!);
    }
  }
  if (chosen.length === 0) {
    chosen = bySource(null);
  }

  return chosen.map((r) => ({
    madhhab: r.madhhab,
    status: r.status,
    principleKey: r.principleKey,
    reasoningTr: r.reasoningTr,
    sourceRef: r.sourceRef,
  }));
}

/*
 * Eşleştirme sonuçlarını karar motoru girdilerine çevirir. Sonuç dizisi
 * girdiyle aynı sıradadır; çağıran taraf ikisini dizinle eşleyebilir.
 */
export async function buildVerdictItems(
  results: MatchResult[],
): Promise<VerdictItem[]> {
  const ids = [
    ...new Set(
      results
        .map((r) => r.ingredient?.id)
        .filter((id): id is string => id !== undefined),
    ),
  ];

  const rows: RulingRow[] =
    ids.length === 0
      ? []
      : (
          await getDb()
            .select({
              ingredientId: madhhabRulings.ingredientId,
              resolvedSource: madhhabRulings.resolvedSource,
              madhhab: madhhabRulings.madhhab,
              status: madhhabRulings.status,
              principleKey: madhhabRulings.principleKey,
              reasoningTr: madhhabRulings.reasoningTr,
              sourceRef: madhhabRulings.sourceRef,
            })
            .from(madhhabRulings)
            .where(inArray(madhhabRulings.ingredientId, ids))
        ).map((r) => ({ ...r, madhhab: r.madhhab as MadhhabKey }));

  const byIngredient = new Map<string, RulingRow[]>();
  for (const row of rows) {
    const list = byIngredient.get(row.ingredientId) ?? [];
    list.push(row);
    byIngredient.set(row.ingredientId, list);
  }

  return results.map((r) => ({
    rawText: r.rawText,
    matched: r.ingredient !== null,
    isCompoundParent: r.isCompoundParent,
    rulings: r.ingredient
      ? pickApplicable(
          byIngredient.get(r.ingredient.id) ?? [],
          r.resolvedSource,
        )
      : [],
  }));
}
