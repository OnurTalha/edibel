import { randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import { scans } from "@/db/schema";
import type { VisionOutput } from "@/lib/ai/vision";
import {
  containsPorkMarker,
  normalizeText,
  parseLabel,
  type DetectedLanguage,
} from "@/lib/parsing";
import {
  matchIngredient,
  matchIngredients,
  type MatchOptions,
  type MatchResult,
} from "@/lib/matching";
import { buildVerdictItems, computeVerdict } from "@/lib/verdict";
import type { AnalysisResult } from "@/lib/schemas";

/*
 * Analiz hattı: görme modeli çıktısını alır, deterministik katmanlardan
 * geçirir ve Bölüm 10'daki sonuç nesnesini üretir.
 *
 * KRİTİK AYRIM: Modelin çıktısından karara giren TEK şey özgün metindir
 * (rawBlock). Yapılandırma bizim ayrıştırıcımızla, eşleştirme veritabanıyla,
 * hüküm madhhab_rulings tablosuyla üretilir. Modelin çevirileri yalnızca
 * gösterim içindir ve yalnızca veritabanında karşılığı olmayan satırlarda
 * kullanılır (arayüzde "otomatik çeviri" olarak işaretlenir).
 */

export class AnalysisError extends Error {
  constructor(public readonly userMessage: string) {
    super(userMessage);
    this.name = "AnalysisError";
  }
}

function isProblematic(r: MatchResult, displayStatus: string): boolean {
  if (displayStatus === "helal") return false;
  /* İçeriği ayrıca analiz edilen kapsayıcı adlar sorunlu sayılmaz */
  if (r.method === "unmatched" && r.isCompoundParent) return false;
  return true;
}

export async function runAnalysis(
  vision: VisionOutput,
  deviceId: string,
): Promise<AnalysisResult> {
  if (!vision.containsIngredientList || vision.rawBlock.trim().length === 0) {
    throw new AnalysisError(
      "Fotoğrafta içindekiler listesi bulunamadı. Lütfen etiketin 原材料名 / 원재료명 / 配料 gibi başlıklı içindekiler bölümünü çekin.",
    );
  }

  /* Katman 3: normalleştirme ve deterministik ayrıştırma (özgün metinden) */
  const parsed = parseLabel(vision.rawBlock);

  if (!parsed.looksLikeIngredientList) {
    throw new AnalysisError(
      "Okunan metin bir içindekiler listesine benzemiyor (besin değerleri tablosu çekilmiş olabilir). Lütfen içindekiler bölümünü çekin.",
    );
  }

  /* Dil: kendi tespitimiz esastır; belirsizse modelinki kullanılır */
  const language: DetectedLanguage =
    parsed.detectedLanguage !== "other"
      ? parsed.detectedLanguage
      : vision.detectedLanguage;

  /*
   * Alerjen satırı: ayrıştırıcı bulamadıysa modelin çıkardığı özgün metin
   * kullanılır; domuz tespiti her iki durumda da deterministik dizgi
   * denetimiyle yapılır, modelin yorumuna bırakılmaz.
   */
  const allergenRaw =
    parsed.allergen.rawText ?? vision.allergenLine.rawText ?? null;
  const allergenContainsPork =
    allergenRaw !== null && containsPorkMarker(allergenRaw);

  /* Model çevirileri: normalleştirilmiş özgün yazım → Türkçe karşılık */
  const modelTranslations = new Map<string, string>();
  for (const ing of vision.ingredients) {
    if (ing.translationTr) {
      modelTranslations.set(normalizeText(ing.rawText), ing.translationTr);
    }
  }

  /* Katman 4: eşleştirme (yalnızca özgün metin üzerinden) */
  const matchOptions: MatchOptions = { language, allergenContainsPork };
  const matchResults = await matchIngredients(
    parsed.entries.map((e) => ({
      ...e,
      modelTranslationTr:
        modelTranslations.get(normalizeText(e.rawText)) ?? null,
    })),
    matchOptions,
  );

  /*
   * Tek öğeli parantez içerikleri ayrıştırıcıda ayırıcı bulunmadığından
   * kaynak ipucu olarak taşınır; ancak かやく(キャベツ) veya
   * ショートニング(ラード) örneklerindeki gibi alt malzeme de olabilirler.
   * source_hints ile çözülemeyen her ipucu, eşleştirme motorunda malzeme
   * olarak da denenir: kesin/takma ad düzeyinde eşleşirse ayrı girdi olarak
   * eklenir (parantez içindeki haram madde gözden kaçamaz) ve kapsayıcı ad,
   * içeriği analiz edilmiş sayılır. Eşleşmeyen ipuçları (国内製造 gibi
   * üretim bilgileri) malzeme sayılmaz.
   */
  const hintChildren: MatchResult[] = [];
  for (const r of matchResults) {
    if (!r.sourceHint || r.sourceResolution === "hint") continue;
    for (const part of r.sourceHint.split(";")) {
      const hintText = normalizeText(part.trim());
      if (hintText.length < 2) continue;
      const child = await matchIngredient(
        {
          rawText: hintText,
          sourceHint: null,
          modelTranslationTr: modelTranslations.get(hintText) ?? null,
        },
        { ...matchOptions, recordUnmatched: false },
      );
      if (child.method === "exact" || child.method === "alias") {
        hintChildren.push(child);
        r.isCompoundParent = true;
      }
    }
  }
  matchResults.push(...hintChildren);

  /* Katman 5: karar (yalnızca veritabanı hükümlerinden) */
  const verdictItems = await buildVerdictItems(matchResults);
  const verdict = computeVerdict(verdictItems);

  /* Çeviri satırları: veritabanı çevirisi öncelikli, yoksa model çevirisi */
  const lines = matchResults.map((r, i) => {
    const dbTranslation = r.translationTr;
    const modelTranslation =
      modelTranslations.get(normalizeText(r.rawText)) ?? null;
    const translationTr =
      dbTranslation ?? modelTranslation ?? "(çevrilemedi)";
    return {
      rawText: r.rawText,
      translationTr,
      translationSource:
        dbTranslation !== null ? ("database" as const) : ("model" as const),
      status: verdict.items[i]!.displayStatus,
    };
  });

  const problematicIngredients = matchResults
    .map((r, i) => ({ r, assessment: verdict.items[i]!, item: verdictItems[i]! }))
    .filter(({ r, assessment }) => isProblematic(r, assessment.displayStatus))
    .map(({ r, item }) => ({
      rawText: r.rawText,
      matchedNameTr:
        r.ingredient?.canonicalNameTr ??
        modelTranslations.get(normalizeText(r.rawText)) ??
        r.rawText,
      sourceHint: r.sourceHint,
      resolvedSource: r.resolvedSource,
      insCode: r.ingredient?.insCode ?? null,
      matchConfidence: r.confidence,
      matchMethod: r.method,
      rulings: item.rulings.map((ruling) => ({
        madhhab: ruling.madhhab,
        status: ruling.status,
        principleKey: ruling.principleKey,
        reasoningTr: ruling.reasoningTr,
        sourceRef: ruling.sourceRef,
      })),
    }));

  const scanId = randomUUID();
  const result: AnalysisResult = {
    scanId,
    detectedLanguage: language,
    verdict: verdict.verdict,
    madhhabVerdicts: verdict.madhhabVerdicts,
    translation: {
      rawBlock: vision.rawBlock,
      fluentTr: vision.fluentTr,
      lines,
    },
    allergenLine: {
      rawText: allergenRaw,
      translationTr: allergenRaw ? vision.allergenLine.translationTr : null,
      containsPork: allergenContainsPork,
    },
    problematicIngredients,
    unmatchedCount: verdict.unmatchedCount,
  };

  /*
   * Tarama kaydı: fotoğraf SAKLANMAZ; yalnızca çıkarılan metin ve sonuç
   * saklanır (bkz. CLAUDE.md, Bölüm 6, scans).
   */
  await getDb().insert(scans).values({
    id: scanId,
    deviceId,
    detectedLanguage: language,
    rawText: vision.rawBlock,
    translatedText: vision.fluentTr,
    parsedIngredients: matchResults.map((r) => ({
      rawText: r.rawText,
      sourceHint: r.sourceHint,
      method: r.method,
      confidence: r.confidence,
      ingredientId: r.ingredient?.id ?? null,
      resolvedSource: r.resolvedSource,
    })),
    verdict: result,
  });

  return result;
}
