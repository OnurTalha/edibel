/*
 * Ayrıştırma katmanının tipleri.
 *
 * ÖNEMLİ AYRIM: Bu katman yalnızca etiketten okunan ÖZGÜN metin üzerinde
 * çalışır. Çevirinin karar zincirinde hiçbir rolü yoktur; çeviri yalnızca
 * kullanıcıya gösterilir. Eşleştirme (Faz 4) ve karar (Faz 5) her zaman
 * buradaki özgün metin alanlarını kullanır.
 */

export type DetectedLanguage =
  | "ja"
  | "ko"
  | "zh_hans"
  | "zh_hant"
  | "en"
  | "other";

/* Etiketten ayrıştırılan tek bir malzeme girdisi */
export interface ParsedEntry {
  /* Etiketteki özgün yazım (parantez grupları çıkarılmış ad) */
  rawText: string;
  /*
   * Parantez içinden çıkarılan ham ifade, örnek: 大豆由来, 国内製造.
   * Kaynak olup olmadığına eşleştirme motoru source_hints tablosuyla karar
   * verir; burada yorum yapılmaz.
   */
  sourceHint: string | null;
  /*
   * Girdi, alt listesi ayrı girdilere açılmış bir kapsayıcı ad mı
   * (örnek: スープ(ポークエキス,豚脂) girdisindeki スープ)? Kapsayıcının
   * içeriği zaten tek tek analiz edildiğinden, karar motoru eşleşmeyen
   * kapsayıcı adları bilinmeyen malzeme SAYMAZ. Alt listesi olmayan yalın
   * bir ad bu bayrağı almaz ve eşleşmezse bilinmeyen kalır.
   */
  isCompoundParent?: boolean;
}

export interface ParsedAllergen {
  /* Alerjen satırının özgün hali; bulunamadıysa null */
  rawText: string | null;
  /* Alerjen bildirimi domuz içeriyor mu (豚 / 돼지 / 猪 / 豬) */
  containsPork: boolean;
}

export interface ParsedLabel {
  detectedLanguage: DetectedLanguage;
  /* NFKC + ayırıcı + boşluk normalleştirmesi uygulanmış tam metin */
  normalizedText: string;
  /* İçindekiler başlığı (原材料名, 원재료명, 配料 vb.) bulundu mu */
  headerFound: boolean;
  /* İçindekiler bölümü; başlık bulunamadıysa tüm metin */
  sectionText: string;
  entries: ParsedEntry[];
  allergen: ParsedAllergen;
  /*
   * Metnin bir içindekiler listesi olma olasılığı. Başlık yoksa ve girdi
   * sayısı azsa false döner; kullanıcıya "içindekiler bölümünü çekin"
   * yönlendirmesi bu bayrakla yapılır.
   */
  looksLikeIngredientList: boolean;
}
