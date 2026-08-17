import type {
  ItemAssessment,
  ItemDisplayStatus,
  MadhhabKey,
  RulingStatus,
  SimpleStatus,
  VerdictItem,
  VerdictResult,
} from "./types";

/*
 * Karar motoru (bkz. CLAUDE.md, Bölüm 7 "Sonuç toplama kuralları").
 *
 * Bu modül tamamen saf fonksiyonlardan oluşur: veritabanına, ağa veya
 * ortam değişkenlerine erişmez; aynı girdi her zaman aynı çıktıyı üretir.
 * Sıralama bilinçli olarak temkinlidir: sistem, emin olmadığı hiçbir
 * durumda helal demez.
 */

export const MADHHABS: readonly MadhhabKey[] = [
  "hanefi",
  "safii",
  "maliki",
  "hanbeli",
];

/*
 * Mekruh, sonuç nesnesinin üçlü durumuna temkinen "supheli" olarak eşlenir
 * (fıkhi ilke: şüpheli şeylerden kaçınma). Orijinal mekruh değeri, sorunlu
 * malzeme kartlarındaki hüküm listesinde korunur.
 */
export function toSimpleStatus(status: RulingStatus): SimpleStatus {
  return status === "mekruh" ? "supheli" : status;
}

/* Bir malzemenin belirli bir mezhepteki sadeleştirilmiş durumu */
function statusFor(item: VerdictItem, madhhab: MadhhabKey): SimpleStatus {
  const ruling = item.rulings.find((r) => r.madhhab === madhhab);
  /*
   * Eşleşmiş malzemede hüküm kaydı eksikse (veri boşluğu) temkinen şüpheli
   * sayılır; içerik veritabanı her malzeme için dört mezhebi zorunlu kılar,
   * bu dal yalnızca savunma amaçlıdır.
   */
  if (!ruling) return "supheli";
  return toSimpleStatus(ruling.status);
}

/* Çeviri satırında gösterilen madde durumu */
function displayStatusFor(item: VerdictItem): ItemDisplayStatus {
  if (!item.matched) return "bilinmiyor";
  const statuses = MADHHABS.map((m) => statusFor(item, m));
  if (statuses.every((s) => s === "helal")) return "helal";
  if (statuses.every((s) => s === "haram")) return "haram";
  /* Mezhepler arası fark veya şüphe: satırda şüpheli gösterilir */
  return "supheli";
}

export function computeVerdict(items: VerdictItem[]): VerdictResult {
  /*
   * Kapsayıcı adlar (スープ gibi, alt listesi ayrıca analiz edilenler)
   * eşleşmediyse bilinmeyen SAYILMAZ; içerikleri zaten tek tek listededir.
   * Alt listesi olmayan eşleşmemiş her malzeme bilinmeyendir.
   */
  const unmatchedCount = items.filter(
    (i) => !i.matched && !i.isCompoundParent,
  ).length;

  /* Karara giren malzemeler: eşleşenler + kapsayıcı olmayan eşleşmeyenler */
  const decisive = items.filter((i) => i.matched || !i.isCompoundParent);

  /*
   * Mezhep bazlı sonuçlar: her mezhep için en kötü durum geçerlidir.
   * Eşleşmeyen malzeme her mezhepte şüphelidir (asla helal sayılmaz).
   */
  const madhhabVerdicts = {} as Record<MadhhabKey, SimpleStatus>;
  for (const m of MADHHABS) {
    const statuses = decisive.map((i) =>
      i.matched ? statusFor(i, m) : ("supheli" as const),
    );
    madhhabVerdicts[m] = statuses.includes("haram")
      ? "haram"
      : statuses.includes("supheli")
        ? "supheli"
        : "helal";
  }

  const items_: ItemAssessment[] = items.map((i) => ({
    rawText: i.rawText,
    displayStatus: displayStatusFor(i),
    perMadhhab: i.matched
      ? (Object.fromEntries(
          MADHHABS.map((m) => [m, statusFor(i, m)]),
        ) as Record<MadhhabKey, SimpleStatus>)
      : null,
  }));

  const base = { madhhabVerdicts, unmatchedCount, items: items_ };

  /*
   * KURAL 1 (Bölüm 7, madde 1): Listede en az bir malzeme dört mezhebin
   * TAMAMINA göre haram ise sonuç HARAM olur.
   */
  const anyHaramForAll = decisive.some(
    (i) => i.matched && MADHHABS.every((m) => statusFor(i, m) === "haram"),
  );
  if (anyHaramForAll) {
    return { verdict: "haram", ...base };
  }

  /*
   * KURAL 2 (Bölüm 7, madde 2): Eşleştirilemeyen en az bir malzeme varsa
   * sonuç ŞÜPHELİ olur. Bu kural, birinci kural dışındaki her durumu
   * geçersiz kılar.
   */
  if (unmatchedCount > 0) {
    return { verdict: "supheli", ...base };
  }

  /*
   * KURAL 3 (Bölüm 7, madde 3): Tüm malzemeler eşleşmiş ve hüküm mezhepler
   * arasında farklılaşıyorsa sonuç MEZHEBE GÖRE DEĞİŞİR olur.
   */
  const distinct = new Set(Object.values(madhhabVerdicts));
  if (distinct.size > 1) {
    return { verdict: "mezhebe_gore_degisir", ...base };
  }

  /*
   * KURAL 4 (Bölüm 7, madde 4): Tüm malzemeler dört mezhebe göre helal ise
   * sonuç HELAL olur.
   */
  const uniform = [...distinct][0] ?? "helal";
  if (uniform === "helal") {
    return { verdict: "helal", ...base };
  }

  /*
   * Bölüm 7'nin dört kuralının kapsamadığı durumlar:
   *  - Tüm mezhepler aynı fikirde HARAM, ancak bu tek bir malzemeden değil
   *    farklı malzemelerin farklı mezheplerdeki haramlığından doğuyor
   *    (kural 1 tetiklenmez): mezhep sonuçları oybirliğiyle haramsa sonuç
   *    HARAM'dır.
   *  - Tüm malzemeler eşleşmiş, fark yok, ama en az biri her mezhebe göre
   *    şüpheli: temkin ilkesi (şüpheliden kaçınma) gereği sonuç ŞÜPHELİ'dir.
   *    (Faz 1 raporunda onaylanan boşluk kapatması.)
   */
  return { verdict: uniform === "haram" ? "haram" : "supheli", ...base };
}
