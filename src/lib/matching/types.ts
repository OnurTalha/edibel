import type { DetectedLanguage } from "@/lib/parsing";

/*
 * Eşleştirme motorunun tipleri.
 *
 * Eşleştirme HER ZAMAN etiketteki özgün metin üzerinden yapılır; çeviri
 * hiçbir eşleştirme sorgusuna girmez, yalnızca sonuçta kullanıcıya gösterilmek
 * üzere veritabanından okunur (bkz. CLAUDE.md, Bölüm 4).
 */

export type MatchMethod = "exact" | "alias" | "fuzzy" | "embedding" | "unmatched";

export type ResolvedSource =
  | "domuz"
  | "sigir"
  | "tavuk"
  | "balik"
  | "soya"
  | "misir"
  | "palm"
  | "bitkisel"
  | "mikrobiyal"
  | "sentetik"
  | "bilinmiyor";

export interface MatchedIngredient {
  id: string;
  canonicalNameTr: string;
  canonicalNameEn: string;
  insCode: string | null;
  eCode: string | null;
  category: string;
  sourceType: string;
  defaultStatus: "helal" | "haram" | "supheli";
  descriptionTr: string;
}

export interface MatchInput {
  /* Etiketteki özgün yazım (ayrıştırma katmanından) */
  rawText: string;
  /* Parantez içi ham ifade; kaynak olup olmadığına bu katman karar verir */
  sourceHint: string | null;
  /* Alt listesi açılmış kapsayıcı ad (bkz. parsing.ParsedEntry) */
  isCompoundParent?: boolean;
}

export interface MatchResult {
  rawText: string;
  sourceHint: string | null;
  method: MatchMethod;
  /* exact=1, alias≈0.97, fuzzy/embedding=benzerlik, unmatched=0 */
  confidence: number;
  ingredient: MatchedIngredient | null;
  /*
   * Veritabanından gelen Türkçe karşılık (takma ad çevirisi veya standart
   * ad). Eşleşmeyen terimlerde null'dur; çeviri o durumda modelden gelir ve
   * arayüzde otomatik çeviri olarak işaretlenir.
   */
  translationTr: string | null;
  /* Çözümlenen kaynak ve çözümün dayanağı */
  resolvedSource: ResolvedSource | null;
  sourceHintTranslationTr: string | null;
  sourceResolution: "hint" | "allergen" | null;
  /*
   * Kapsayıcı ad bayrağı girdiden taşınır; karar motoru eşleşmeyen
   * kapsayıcıları bilinmeyen malzeme saymaz (içerikleri ayrıca analiz edilir).
   */
  isCompoundParent: boolean;
}

export interface MatchOptions {
  language: DetectedLanguage;
  /* Alerjen satırında domuz bildirimi var mı (bkz. CLAUDE.md, Bölüm 5.2) */
  allergenContainsPork: boolean;
  /* Eşleşmeyen terimlerin unmatched_terms tablosuna yazılması (varsayılan açık) */
  recordUnmatched?: boolean;
}
