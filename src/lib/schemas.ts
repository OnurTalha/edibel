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
 * Menü taraması sonucu (lokanta menüsü).
 *
 * Etiket sonucundan ayrılan noktalar:
 *  - Tek bir karar yerine yemek başına karar vardır; ekran liste gösterir.
 *  - Karar sözlüğü farklıdır ve "helal" içermez; menüden okunan malzemeler
 *    yazılı değil çıkarımdır (bkz. src/lib/verdict/menu.ts).
 *  - Her malzemede "certainty" alanı bulunur: yemeği tanımlayan malzeme mi,
 *    yoksa lokantaya göre değişen bir malzeme mi.
 */
export const dishVerdictSchema = z.enum([
  "kacinilmali",
  "sorulmali",
  "muhtemelen_uygun",
]);

export const menuResultSchema = z.object({
  scanId: z.string(),
  detectedLanguage: detectedLanguageSchema,
  /* Menüden okunan özgün metnin tamamı; kullanıcı okumayı denetleyebilir */
  rawBlock: z.string(),
  dishes: z.array(
    z.object({
      /* Menüdeki özgün yazım */
      rawName: z.string(),
      nameTr: z.string(),
      verdict: dishVerdictSchema,
      madhhabVerdicts: z.object({
        hanefi: simpleStatusSchema,
        safii: simpleStatusSchema,
        maliki: simpleStatusSchema,
        hanbeli: simpleStatusSchema,
      }),
      ingredients: z.array(
        z.object({
          rawText: z.string(),
          translationTr: z.string(),
          translationSource: z.enum(["database", "model"]),
          certainty: z.enum(["kesin", "olasi"]),
          status: lineStatusSchema,
          matchMethod: z.enum([
            "exact",
            "alias",
            "fuzzy",
            "embedding",
            "unmatched",
          ]),
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
      /*
       * Karara sebep olan maddeler (lokantaya sorulacaklar), şiddete göre
       * sıralı: önce haram, sonra şüpheli, en sonda bilinmeyen.
       */
      concerns: z.array(
        z.object({
          nameTr: z.string(),
          status: lineStatusSchema,
          certainty: z.enum(["kesin", "olasi"]),
        }),
      ),
    }),
  ),
  summary: z.object({
    kacinilmali: z.number().int(),
    sorulmali: z.number().int(),
    muhtemelenUygun: z.number().int(),
  }),
});

export type MenuResult = z.infer<typeof menuResultSchema>;
export type MenuDish = MenuResult["dishes"][number];

export const analyzeMenuRequestSchema = z.object({
  imageBase64: z.string().min(100),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  deviceId: z.string().min(1).max(128),
});

export type AnalyzeMenuRequest = z.infer<typeof analyzeMenuRequestSchema>;

export const menuScanResponseSchema = z.object({
  result: menuResultSchema,
  principles: z.array(
    z.object({
      key: z.string(),
      titleTr: z.string(),
      explanationTr: z.string(),
    }),
  ),
});

export type MenuScanResponse = z.infer<typeof menuScanResponseSchema>;

/*
 * /api/scans/[scanId] yanıtı: kaydedilmiş sonuç nesnesi ve sonuçta geçen
 * fıkhi ilkelerin açıklamaları (sonuç ekranındaki "Gerekçeler" bölümü).
 */
export const fiqhPrincipleSchema = z.object({
  key: z.string(),
  titleTr: z.string(),
  explanationTr: z.string(),
});

/*
 * Tarama iki türde olabilir; sonuç ekranı türe göre farklı görünüm açar.
 * Ayrım "scanType" alanıyla yapılır, böylece eski kayıtlar (tür alanı
 * olmayanlar) etiket sayılır.
 */
export const scanResponseSchema = z.discriminatedUnion("scanType", [
  z.object({
    scanType: z.literal("etiket"),
    result: analysisResultSchema,
    principles: z.array(fiqhPrincipleSchema),
  }),
  z.object({
    scanType: z.literal("menu"),
    result: menuResultSchema,
    principles: z.array(fiqhPrincipleSchema),
  }),
]);

export type FiqhPrincipleView = z.infer<typeof fiqhPrincipleSchema>;
export type ScanResponse = z.infer<typeof scanResponseSchema>;

/* /api/scans?deviceId=... yanıtı: cihazın geçmiş taramaları */
export const scanListItemSchema = z.discriminatedUnion("scanType", [
  z.object({
    scanType: z.literal("etiket"),
    scanId: z.string(),
    createdAt: z.string(),
    detectedLanguage: detectedLanguageSchema,
    verdict: analysisResultSchema.shape.verdict,
    unmatchedCount: z.number().int(),
    preview: z.string(),
  }),
  z.object({
    scanType: z.literal("menu"),
    scanId: z.string(),
    createdAt: z.string(),
    detectedLanguage: detectedLanguageSchema,
    dishCount: z.number().int(),
    summary: menuResultSchema.shape.summary,
    preview: z.string(),
  }),
]);

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
