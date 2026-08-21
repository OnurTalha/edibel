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

/*
 * /api/analyze isteği iki biçimdedir:
 *  - image: tarayıcıda kırpılıp küçültülmüş JPEG/PNG/WebP, base64
 *  - text : kullanıcının sonuç ekranında düzelttiği ham etiket metni
 *           (okuma hatalarını düzeltip yeniden analiz için)
 */
export const analyzeRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("image"),
    imageBase64: z.string().min(100),
    mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    deviceId: z.string().min(1).max(128),
  }),
  z.object({
    mode: z.literal("text"),
    rawText: z.string().min(2).max(6000),
    deviceId: z.string().min(1).max(128),
  }),
]);

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

/*
 * /api/scans/[scanId] yanıtı: kaydedilmiş sonuç nesnesi ve sonuçta geçen
 * fıkhi ilkelerin açıklamaları (sonuç ekranındaki "Gerekçeler" bölümü).
 */
export const fiqhPrincipleSchema = z.object({
  key: z.string(),
  titleTr: z.string(),
  explanationTr: z.string(),
});

export const scanResponseSchema = z.object({
  result: analysisResultSchema,
  principles: z.array(fiqhPrincipleSchema),
});

export type FiqhPrincipleView = z.infer<typeof fiqhPrincipleSchema>;
export type ScanResponse = z.infer<typeof scanResponseSchema>;

/* /api/scans?deviceId=... yanıtı: cihazın geçmiş taramaları */
export const scanListItemSchema = z.object({
  scanId: z.string(),
  createdAt: z.string(),
  detectedLanguage: detectedLanguageSchema,
  verdict: analysisResultSchema.shape.verdict,
  unmatchedCount: z.number().int(),
  preview: z.string(),
});

export const scanListSchema = z.object({
  scans: z.array(scanListItemSchema),
});

export type ScanListItem = z.infer<typeof scanListItemSchema>;
export type ScanList = z.infer<typeof scanListSchema>;

/* /api/admin/unmatched-terms yanıtı: içerik veritabanını büyütme listesi */
export const unmatchedTermSchema = z.object({
  id: z.string(),
  term: z.string(),
  language: z.string(),
  modelTranslationTr: z.string().nullable(),
  occurrenceCount: z.number().int(),
  lastSeenAt: z.string(),
  /*
   * Terimin GÜNCEL içerik veritabanına karşı yeniden denenmiş hâli.
   * unmatched_terms geçmiş kaydıdır: bir terim kaydedildikten sonra
   * veritabanına eklenmiş olabilir. Bu alan, hangi satırların hâlâ eksik
   * olduğunu gösterir.
   */
  resolved: z.object({
    matched: z.boolean(),
    /* Hangi yöntemle eşleşti; gömme yöntemi bu denemede çalıştırılmaz */
    method: z.enum(["exact", "alias", "fuzzy"]).nullable(),
    ingredientNameTr: z.string().nullable(),
  }),
});

export const unmatchedTermsSchema = z.object({
  terms: z.array(unmatchedTermSchema),
});

export type UnmatchedTermView = z.infer<typeof unmatchedTermSchema>;
