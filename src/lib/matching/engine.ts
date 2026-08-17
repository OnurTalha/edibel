import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  ingredientAliases,
  ingredients,
  madhhabRulings,
  unmatchedTerms,
} from "@/db/schema";
import { getEmbeddingClient } from "@/lib/ai/embedding";
import { buildCandidates } from "./candidates";
import { resolveSourceHint } from "./source-hints";
import type {
  MatchInput,
  MatchOptions,
  MatchResult,
  MatchedIngredient,
} from "./types";

/*
 * Eşleştirme motoru (bkz. CLAUDE.md, Katman 4).
 *
 * Yöntem sırası: 1) tam eşleşme, 2) çok dilli takma ad tablosu (yazım
 * varyantları), 3) pg_trgm bulanık eşleşme, 4) gömme vektörü benzerliği.
 * Hiçbir yöntemle eşleşmeyen malzeme ASLA helal sayılmaz; sonuca
 * "unmatched" olarak yansır ve unmatched_terms tablosuna kaydedilir.
 *
 * Eşleştirme yalnızca özgün metinle yapılır; çeviri sorgulara girmez.
 */

/* Bulanık eşleşme alt sınırı; altındaki benzerlikler eşleşme sayılmaz */
const FUZZY_THRESHOLD = 0.45;
/* Gömme eşleşmesi için en büyük kosinüs uzaklığı */
const EMBEDDING_MAX_DISTANCE = 0.35;

const INGREDIENT_FIELDS = {
  id: ingredients.id,
  canonicalNameTr: ingredients.canonicalNameTr,
  canonicalNameEn: ingredients.canonicalNameEn,
  insCode: ingredients.insCode,
  eCode: ingredients.eCode,
  category: ingredients.category,
  sourceType: ingredients.sourceType,
  defaultStatus: ingredients.defaultStatus,
  descriptionTr: ingredients.descriptionTr,
};

interface AliasHit {
  alias: string;
  language: string;
  translationTr: string | null;
  ingredient: MatchedIngredient;
}

/* Yöntem 1 + 2: aday yazımların takma ad tablosunda aranması */
async function lookupAliases(candidates: string[]): Promise<AliasHit[]> {
  const rows = await db
    .select({
      alias: ingredientAliases.alias,
      language: ingredientAliases.language,
      translationTr: ingredientAliases.translationTr,
      ...INGREDIENT_FIELDS,
    })
    .from(ingredientAliases)
    .innerJoin(ingredients, eq(ingredientAliases.ingredientId, ingredients.id))
    .where(inArray(ingredientAliases.alias, candidates));

  return rows.map((r) => ({
    alias: r.alias,
    language: r.language,
    translationTr: r.translationTr,
    ingredient: {
      id: r.id,
      canonicalNameTr: r.canonicalNameTr,
      canonicalNameEn: r.canonicalNameEn,
      insCode: r.insCode,
      eCode: r.eCode,
      category: r.category,
      sourceType: r.sourceType,
      defaultStatus: r.defaultStatus,
      descriptionTr: r.descriptionTr,
    },
  }));
}

/* Latin/Türkçe etiketler için standart ad araması (takma ad bulunamazsa) */
async function lookupCanonicalName(
  term: string,
): Promise<MatchedIngredient | null> {
  const lowered = term.toLowerCase();
  const rows = await db
    .select(INGREDIENT_FIELDS)
    .from(ingredients)
    .where(
      sql`lower(${ingredients.canonicalNameEn}) = ${lowered} OR lower(${ingredients.canonicalNameTr}) = ${lowered}`,
    )
    .limit(1);
  return rows[0] ?? null;
}

interface FuzzyHit {
  similarity: number;
  translationTr: string | null;
  ingredient: MatchedIngredient;
}

/* Yöntem 3: pg_trgm bulanık eşleşme */
async function lookupFuzzy(candidates: string[]): Promise<FuzzyHit | null> {
  let best: FuzzyHit | null = null;
  for (const cand of candidates) {
    const rows = (await db.execute(sql`
      SELECT i.id, i.canonical_name_tr, i.canonical_name_en, i.ins_code,
             i.e_code, i.category, i.source_type, i.default_status,
             i.description_tr, a.translation_tr,
             similarity(a.alias, ${cand}) AS sim
      FROM ingredient_aliases a
      JOIN ingredients i ON i.id = a.ingredient_id
      WHERE similarity(a.alias, ${cand}) > ${FUZZY_THRESHOLD}
      ORDER BY sim DESC
      LIMIT 1
    `)) as unknown as Array<Record<string, unknown>>;
    const row = rows[0];
    if (!row) continue;
    const sim = Number(row.sim);
    if (!best || sim > best.similarity) {
      best = {
        similarity: sim,
        translationTr: (row.translation_tr as string | null) ?? null,
        ingredient: {
          id: row.id as string,
          canonicalNameTr: row.canonical_name_tr as string,
          canonicalNameEn: row.canonical_name_en as string,
          insCode: row.ins_code as string | null,
          eCode: row.e_code as string | null,
          category: row.category as string,
          sourceType: row.source_type as string,
          defaultStatus: row.default_status as MatchedIngredient["defaultStatus"],
          descriptionTr: row.description_tr as string,
        },
      };
    }
  }
  return best;
}

interface EmbeddingHit {
  distance: number;
  ingredient: MatchedIngredient;
}

/* Yöntem 4: gömme vektörü benzerliği; yalnızca diğerleri başarısızsa */
async function lookupEmbedding(term: string): Promise<EmbeddingHit | null> {
  const client = getEmbeddingClient();
  if (!client) return null;

  let vector: number[];
  try {
    const [v] = await client.embed([term]);
    if (!v) return null;
    vector = v;
  } catch {
    /* Harici arayüz hatası eşleşmeyi engellemez; terim eşleşmemiş sayılır */
    return null;
  }

  const vecLiteral = `[${vector.join(",")}]`;
  const rows = (await db.execute(sql`
    SELECT i.id, i.canonical_name_tr, i.canonical_name_en, i.ins_code,
           i.e_code, i.category, i.source_type, i.default_status,
           i.description_tr,
           (i.embedding <=> ${vecLiteral}::vector) AS dist
    FROM ingredients i
    WHERE i.embedding IS NOT NULL
    ORDER BY dist
    LIMIT 1
  `)) as unknown as Array<Record<string, unknown>>;
  const row = rows[0];
  if (!row) return null;
  const distance = Number(row.dist);
  if (distance > EMBEDDING_MAX_DISTANCE) return null;
  return {
    distance,
    ingredient: {
      id: row.id as string,
      canonicalNameTr: row.canonical_name_tr as string,
      canonicalNameEn: row.canonical_name_en as string,
      insCode: row.ins_code as string | null,
      eCode: row.e_code as string | null,
      category: row.category as string,
      sourceType: row.source_type as string,
      defaultStatus: row.default_status as MatchedIngredient["defaultStatus"],
      descriptionTr: row.description_tr as string,
    },
  };
}

/* Malzemenin domuz kaynağına özel hükmü var mı (alerjen kuralı için) */
async function hasPorkVariantRuling(ingredientId: string): Promise<boolean> {
  const rows = await db
    .select({ id: madhhabRulings.id })
    .from(madhhabRulings)
    .where(
      and(
        eq(madhhabRulings.ingredientId, ingredientId),
        eq(madhhabRulings.resolvedSource, "domuz"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function recordUnmatched(term: string, language: string): Promise<void> {
  if (term.length < 2) return;
  await db
    .insert(unmatchedTerms)
    .values({ term, language })
    .onConflictDoUpdate({
      target: [unmatchedTerms.term, unmatchedTerms.language],
      set: {
        occurrenceCount: sql`${unmatchedTerms.occurrenceCount} + 1`,
        lastSeenAt: sql`now()`,
      },
    });
}

export async function matchIngredient(
  input: MatchInput,
  opts: MatchOptions,
): Promise<MatchResult> {
  const term = input.rawText;
  const candidates = buildCandidates(term, opts.language);

  const base: Omit<
    MatchResult,
    "method" | "confidence" | "ingredient" | "translationTr"
  > = {
    rawText: term,
    sourceHint: input.sourceHint,
    resolvedSource: null,
    sourceHintTranslationTr: null,
    sourceResolution: null,
    isCompoundParent: input.isCompoundParent ?? false,
  };

  /* Parantez ipucu denetlenmiş tablodan çözümlenir */
  if (input.sourceHint) {
    const resolved = await resolveSourceHint(input.sourceHint, opts.language);
    if (resolved) {
      base.resolvedSource = resolved.resolvedSource;
      base.sourceHintTranslationTr = resolved.translationTr;
      base.sourceResolution = "hint";
    }
  }

  let result: MatchResult | null = null;

  /* Yöntem 1 + 2: tam eşleşme ve takma ad varyantları */
  const hits = await lookupAliases(candidates);
  if (hits.length > 0) {
    /* Tercih: özgün yazım eşleşmesi ve tespit edilen dil önce gelir */
    hits.sort((a, b) => {
      const aExact = a.alias === term ? 1 : 0;
      const bExact = b.alias === term ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      const aLang = a.language === opts.language ? 1 : 0;
      const bLang = b.language === opts.language ? 1 : 0;
      return bLang - aLang;
    });
    const hit = hits[0]!;
    const isExact = hit.alias === term;
    result = {
      ...base,
      method: isExact ? "exact" : "alias",
      confidence: isExact ? 1 : 0.97,
      ingredient: hit.ingredient,
      translationTr: hit.translationTr ?? hit.ingredient.canonicalNameTr,
    };
  }

  /* Latin alfabeli etiketlerde standart ad da denenir */
  if (!result && (opts.language === "en" || opts.language === "other")) {
    const ing = await lookupCanonicalName(term);
    if (ing) {
      result = {
        ...base,
        method: "exact",
        confidence: 1,
        ingredient: ing,
        translationTr: ing.canonicalNameTr,
      };
    }
  }

  /* Yöntem 3: bulanık eşleşme */
  if (!result) {
    const fuzzy = await lookupFuzzy(candidates);
    if (fuzzy) {
      result = {
        ...base,
        method: "fuzzy",
        confidence: fuzzy.similarity,
        ingredient: fuzzy.ingredient,
        translationTr:
          fuzzy.translationTr ?? fuzzy.ingredient.canonicalNameTr,
      };
    }
  }

  /* Yöntem 4: gömme benzerliği (seyrek; harici arayüz) */
  if (!result) {
    const emb = await lookupEmbedding(term);
    if (emb) {
      result = {
        ...base,
        method: "embedding",
        confidence: 1 - emb.distance,
        ingredient: emb.ingredient,
        translationTr: emb.ingredient.canonicalNameTr,
      };
    }
  }

  /* Eşleşme yok: asla helal sayılmaz, bilinmeyen olarak kaydedilir */
  if (!result) {
    if (opts.recordUnmatched !== false) {
      await recordUnmatched(term, opts.language);
    }
    return {
      ...base,
      method: "unmatched",
      confidence: 0,
      ingredient: null,
      translationTr: null,
    };
  }

  /*
   * Alerjen kuralı (bkz. CLAUDE.md, Bölüm 5.2): alerjen satırında domuz
   * bildirimi varsa, kaynağı belirsiz hayvansal maddelerin kaynağı büyük
   * olasılıkla domuzdur. Kural yalnızca parantez ipucu OLMAYAN, kaynağı
   * belirsiz/hayvansal olan ve domuz kaynağına özel hükmü bulunan
   * malzemelere uygulanır; dayanak sonuçta "allergen" olarak işaretlenir.
   */
  if (
    opts.allergenContainsPork &&
    result.ingredient &&
    result.resolvedSource === null &&
    (result.ingredient.sourceType === "belirsiz" ||
      result.ingredient.sourceType === "hayvansal") &&
    (await hasPorkVariantRuling(result.ingredient.id))
  ) {
    result.resolvedSource = "domuz";
    result.sourceResolution = "allergen";
  }

  return result;
}

export async function matchIngredients(
  inputs: MatchInput[],
  opts: MatchOptions,
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];
  for (const input of inputs) {
    results.push(await matchIngredient(input, opts));
  }
  return results;
}
