import { z } from "zod";

/*
 * Sunucunun döndürdüğü sonuç nesnesinin şeması (bkz. CLAUDE.md, Bölüm 10).
 * Arayüz (Faz 7) bu tipleri kullanır; sunucu her yanıtı bu şemayla üretir.
 */

export const detectedLanguageSchema = z.enum([
  "ja",
  "ko",
  "zh_hans",
  "zh_hant",
  "en",
  "other",
]);

export const simpleStatusSchema = z.enum(["helal", "haram", "supheli"]);
export const lineStatusSchema = z.enum([
  "helal",
  "haram",
  "supheli",
  "bilinmiyor",
]);

export const analysisResultSchema = z.object({
  scanId: z.string(),
  detectedLanguage: detectedLanguageSchema,
  verdict: z.enum(["helal", "haram", "supheli", "mezhebe_gore_degisir"]),
  madhhabVerdicts: z.object({
    hanefi: simpleStatusSchema,
    safii: simpleStatusSchema,
    maliki: simpleStatusSchema,
    hanbeli: simpleStatusSchema,
  }),
  translation: z.object({
    /* Etiketten okunan içindekiler metninin tamamı (özgün) */
    rawBlock: z.string(),
    /* Metnin tamamının akıcı Türkçe çevirisi */
    fluentTr: z.string(),
    lines: z.array(
      z.object({
        /* Etiketteki özgün yazım */
        rawText: z.string(),
        translationTr: z.string(),
        translationSource: z.enum(["database", "model"]),
        status: lineStatusSchema,
      }),
    ),
  }),
  allergenLine: z.object({
    rawText: z.string().nullable(),
    translationTr: z.string().nullable(),
    containsPork: z.boolean(),
  }),
  problematicIngredients: z.array(
    z.object({
      rawText: z.string(),
      matchedNameTr: z.string(),
      sourceHint: z.string().nullable(),
      resolvedSource: z.string().nullable(),
      insCode: z.string().nullable(),
      matchConfidence: z.number(),
      matchMethod: z.enum(["exact", "alias", "fuzzy", "embedding", "unmatched"]),
      rulings: z.array(
        z.object({
          madhhab: z.string(),
          status: z.string(),
          principleKey: z.string(),
          reasoningTr: z.string(),
          sourceRef: z.string(),
        }),
      ),
    }),
  ),
  unmatchedCount: z.number().int(),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

/* /api/analyze isteği: tarayıcıda küçültülmüş JPEG/PNG/WebP, base64 */
export const analyzeRequestSchema = z.object({
  imageBase64: z.string().min(100),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  deviceId: z.string().min(1).max(128),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
