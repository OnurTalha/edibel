/*
 * Karar motorunun tipleri.
 *
 * Hükümler yalnızca veritabanındaki madhhab_rulings kayıtlarından gelir;
 * yapay zeka bu katmana hiçbir biçimde girmez (bkz. CLAUDE.md, Bölüm 1).
 */

export type MadhhabKey = "hanefi" | "safii" | "maliki" | "hanbeli";

/* Veritabanındaki hüküm değerleri (mekruh dahil) */
export type RulingStatus = "helal" | "haram" | "mekruh" | "supheli";

/* Sonuç nesnesindeki üçlü durum; mekruh temkinen supheli'ye eşlenir */
export type SimpleStatus = "helal" | "haram" | "supheli";

export type OverallVerdict =
  | "helal"
  | "haram"
  | "supheli"
  | "mezhebe_gore_degisir";

/* Çeviri satırlarında gösterilen madde durumu */
export type ItemDisplayStatus = "helal" | "haram" | "supheli" | "bilinmiyor";

export interface AppliedRuling {
  madhhab: MadhhabKey;
  status: RulingStatus;
  principleKey: string;
  reasoningTr: string;
  sourceRef: string;
}

/* Karar motorunun tek girdisi; eşleştirme sonuçlarından rulings.ts kurar */
export interface VerdictItem {
  /* Etiketteki özgün yazım (yalnızca raporlama için; karara girmez) */
  rawText: string;
  /* Malzeme veritabanında eşleşti mi */
  matched: boolean;
  /* Alt listesi açılmış kapsayıcı ad (bkz. parsing.ParsedEntry) */
  isCompoundParent: boolean;
  /*
   * Malzemeye uygulanan hükümler; eşleşen malzemede dört mezhep için birer
   * kayıt beklenir, eşleşmeyende boştur.
   */
  rulings: AppliedRuling[];
}

export interface ItemAssessment {
  rawText: string;
  displayStatus: ItemDisplayStatus;
  /* Eşleşen malzemede mezhep başına sadeleştirilmiş durum; eşleşmeyende null */
  perMadhhab: Record<MadhhabKey, SimpleStatus> | null;
}

export interface VerdictResult {
  verdict: OverallVerdict;
  madhhabVerdicts: Record<MadhhabKey, SimpleStatus>;
  /* Kapsayıcı adlar hariç eşleşmeyen malzeme sayısı */
  unmatchedCount: number;
  items: ItemAssessment[];
}
