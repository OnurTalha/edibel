import { randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import { scans } from "@/db/schema";
import type { MenuOutput } from "@/lib/ai/vision";
import { normalizeText, parseLabel, type DetectedLanguage } from "@/lib/parsing";
import {
  matchIngredient,
  type MatchOptions,
  type MatchResult,
} from "@/lib/matching";
import { buildVerdictItems, computeDishVerdict } from "@/lib/verdict";
import type { MenuResult } from "@/lib/schemas";
import { AnalysisError } from "./pipeline";

/*
 * Menü analiz hattı (lokanta menüsü taraması).
 *
 * Etiket hattıyla AYNI olan: eşleştirme yalnızca özgün (menünün dilindeki)
 * malzeme adı üzerinden yapılır, hüküm yalnızca madhhab_rulings tablosundan
 * gelir, çeviri karara girmez.
 *
 * Etiket hattından FARKLI olan: malzemeler etiketten okunmaz, yemeğin
 * adından çıkarılır. Bu sebeple karar sözlüğü ayrıdır ve hiçbir yemek
 * "helal" damgası almaz (bkz. src/lib/verdict/menu.ts).
 */

/* Tek fotoğrafta işlenecek üst sınırlar; kalabalık menülerde süreyi korur */
const MAX_DISHES = 60;
const MAX_INGREDIENTS_PER_DISH = 12;

export async function runMenuAnalysis(
  menu: MenuOutput,
  deviceId: string,
): Promise<MenuResult> {
  if (!menu.containsMenu || menu.dishes.length === 0) {
    throw new AnalysisError(
      "Fotoğrafta yemek listesi bulunamadı. Lütfen menünün yemek adlarının yazdığı bölümünü çekin.",
    );
  }

  const language: DetectedLanguage = menu.detectedLanguage;
  const dishes = menu.dishes.slice(0, MAX_DISHES);

  /*
   * Menüde aynı malzeme birçok yemekte tekrar eder (豚肉, みりん, 鰹だし).
   * Her tekrar için ayrı sorgu yapmak hem yavaştır hem de eşleşmeyen
   * terimlerde gereksiz harici arayüz çağrısı üretir. Bu sebeple benzersiz
   * yazımlar bir kez eşleştirilir ve sonuç paylaşılır.
   */
  const matchOptions: MatchOptions = {
    language,
    allergenContainsPork: false,
    /*
     * Menüden çıkan eşleşmeyen terimler unmatched_terms tablosuna
     * YAZILMAZ. O tablo, içerik veritabanını hangi yönde büyüteceğimizi
     * gösteren geri besleme kaynağıdır ve etiketlerde GERÇEKTEN BASILI
     * yazımları biriktirir. Modelin çıkarımıyla ürettiği adlar oraya
     * karışırsa hem sayaçlar gerçek sıklığı yansıtmaz hem de etikette hiç
     * geçmeyen yazımlar iş listesine girer.
     */
    recordUnmatched: false,
  };

  const matchCache = new Map<string, MatchResult>();
  async function matchOnce(
    rawText: string,
    sourceHint: string | null,
    modelTranslationTr: string | null,
  ): Promise<MatchResult> {
    const key = `${normalizeText(rawText)}|${sourceHint ?? ""}`;
    const cached = matchCache.get(key);
    if (cached) return cached;
    const result = await matchIngredient(
      { rawText, sourceHint, modelTranslationTr },
      matchOptions,
    );
    matchCache.set(key, result);
    return result;
  }

  /*
   * Modelin verdiği malzeme adı bileşik olabilir:
   * 天つゆ（鰹だし・醤油・味醂） gibi. Bu ifade tek parça olarak
   * eşleştirilirse parantezin içindeki 味醂 (mirin) hiç değerlendirilmez ve
   * yemek yanlışlıkla uygun görünür. Bu sebeple etiket hattının kullandığı
   * ayrıştırıcı burada da çalıştırılır: bileşik ad alt malzemelerine
   * bölünür, kapsayıcı ad isCompoundParent olarak işaretlenir (karar motoru
   * kapsayıcıyı bilinmeyen malzeme saymaz, içeriği zaten ayrı ayrı
   * listededir).
   *
   * Alt malzemeler kapsayıcının certainty değerini devralır: tempura sosu
   * "olasi" ise içindeki mirin de "olasi"dır.
   */
  function expand(rawText: string, modelTranslationTr: string | null) {
    const parsed = parseLabel(rawText);
    if (parsed.entries.length === 0) {
      return [{ rawText, sourceHint: null, isCompoundParent: false, modelTranslationTr }];
    }
    return parsed.entries.map((entry) => ({
      rawText: entry.rawText,
      sourceHint: entry.sourceHint,
      isCompoundParent: entry.isCompoundParent ?? false,
      /*
       * Modelin çevirisi bileşik ifadenin TAMAMINA aittir; yalnızca
       * kapsayıcı ada (veya tek parçalı ifadenin kendisine) verilir.
       * Alt malzemelerin çevirisi veritabanından gelir.
       */
      modelTranslationTr:
        parsed.entries.length === 1 || entry.isCompoundParent
          ? modelTranslationTr
          : null,
    }));
  }

  const resultDishes: MenuResult["dishes"] = [];

  for (const dish of dishes) {
    const inferred = dish.likelyIngredients.slice(0, MAX_INGREDIENTS_PER_DISH);

    /* Bileşik adlar alt malzemelerine bölünür (bkz. expand) */
    const parts = inferred.flatMap((ing) =>
      expand(ing.rawText, ing.translationTr).map((part) => ({
        ...part,
        certainty: ing.certainty,
      })),
    );

    const matched: MatchResult[] = [];
    for (const part of parts) {
      const result = await matchOnce(
        part.rawText,
        part.sourceHint,
        part.modelTranslationTr,
      );
      /* Kapsayıcı bayrağı önbellekten değil, bu kullanımdan gelir */
      matched.push({ ...result, isCompoundParent: part.isCompoundParent });
    }

    /* Hükümler veritabanından okunur (etiket hattıyla aynı fonksiyon) */
    const verdictItems = await buildVerdictItems(matched);

    const decision = computeDishVerdict(
      verdictItems.map((item, i) => ({
        item,
        certainty: parts[i]!.certainty,
        /* Veritabanı çevirisi öncelikli, yoksa modelinki */
        translationTr:
          matched[i]!.translationTr ??
          parts[i]!.modelTranslationTr ??
          parts[i]!.rawText,
      })),
    );

    const ingredients = decision.ingredients.map((ing, i) => {
      const m = matched[i]!;
      return {
        rawText: ing.rawText,
        translationTr: ing.translationTr,
        translationSource:
          m.translationTr !== null ? ("database" as const) : ("model" as const),
        certainty: ing.certainty,
        status: ing.status,
        matchMethod: m.method,
        rulings: verdictItems[i]!.rulings.map((r) => ({
          madhhab: r.madhhab,
          status: r.status,
          principleKey: r.principleKey,
          reasoningTr: r.reasoningTr,
          sourceRef: r.sourceRef,
        })),
      };
    });

    resultDishes.push({
      rawName: dish.rawName,
      nameTr: dish.nameTr,
      verdict: decision.verdict,
      madhhabVerdicts: decision.madhhabVerdicts,
      ingredients,
      concerns: decision.concernIndexes.map((i) => {
        const ing = decision.ingredients[i]!;
        return {
          nameTr: ing.translationTr,
          status: ing.status,
          certainty: ing.certainty,
        };
      }),
    });
  }

  const summary = {
    kacinilmali: resultDishes.filter((d) => d.verdict === "kacinilmali").length,
    sorulmali: resultDishes.filter((d) => d.verdict === "sorulmali").length,
    muhtemelenUygun: resultDishes.filter(
      (d) => d.verdict === "muhtemelen_uygun",
    ).length,
  };

  const scanId = randomUUID();
  const result: MenuResult = {
    scanId,
    detectedLanguage: language,
    rawBlock: menu.rawBlock,
    dishes: resultDishes,
    summary,
  };

  /*
   * Tarama kaydı: fotoğraf SAKLANMAZ; yalnızca okunan metin ve sonuç
   * saklanır (bkz. CLAUDE.md, Bölüm 6, scans).
   */
  await getDb()
    .insert(scans)
    .values({
      id: scanId,
      deviceId,
      scanType: "menu",
      detectedLanguage: language,
      rawText: menu.rawBlock,
      /* Menüde akıcı çeviri yerine yemek adlarının Türkçesi tutulur */
      translatedText: resultDishes.map((d) => d.nameTr).join("\n"),
      parsedIngredients: resultDishes.map((d) => ({
        rawName: d.rawName,
        verdict: d.verdict,
        ingredients: d.ingredients.map((i) => ({
          rawText: i.rawText,
          certainty: i.certainty,
          method: i.matchMethod,
          status: i.status,
        })),
      })),
      verdict: result,
    });

  return result;
}
