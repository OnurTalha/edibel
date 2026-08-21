import { MADHHABS, computeVerdict } from "./engine";
import type {
  ItemDisplayStatus,
  MadhhabKey,
  SimpleStatus,
  VerdictItem,
} from "./types";

/*
 * Menü karar motoru (lokanta menüsü taraması).
 *
 * Bu modül de tamamen saf fonksiyonlardan oluşur: veritabanına, ağa veya
 * ortam değişkenlerine erişmez. Hükümler yine YALNIZCA veritabanından gelen
 * madhhab_rulings kayıtlarından türetilir; modelin katkısı, yemeğin hangi
 * malzemelerden yapıldığını söylemekle sınırlıdır (mutfak bilgisi, dini
 * hüküm değil).
 *
 * NEDEN AYRI BİR SÖZLÜK:
 * Etiket taramasında malzemeler YAZILIDIR; okunan şey kesindir ve sonuç
 * HELAL olabilir. Menüde malzemeler yemeğin adından ÇIKARILIR ve üç ayrı
 * belirsizlik kaynağı vardır:
 *
 *   1. Aynı yemek her lokantada aynı pişmez (bu karaage mirin'li mi?).
 *   2. Japonya, Kore ve Çin'de kesim usulü genellikle İslami şartlara uygun
 *      değildir (bkz. CLAUDE.md, Bölüm 7: "Ehl-i kitap kesimi"), bu sebeple
 *      etli hiçbir yemek kesin olarak uygun sayılamaz.
 *   3. Ortak kızartma yağı, ortak wok, ortak tezgâh.
 *
 * Bu üçü yüzünden menü kararı hiçbir kod yolunda "helal" üretmez. En iyi
 * sonuç "muhtemelen uygun"dur ve bu ifade bilinçli olarak kesinlik iddia
 * etmez. Fıkhi dayanak, etiket motorundakiyle aynı temkin ilkesidir:
 * şüpheli olandan kaçınılır, emin olunmayana helal denmez.
 */

export type DishVerdict =
  /* Yemeği tanımlayan bir malzeme dört mezhebe göre de haram */
  | "kacinilmali"
  /* Sorunlu veya belirsiz madde var; kullanıcının lokantaya sorması gerekir */
  | "sorulmali"
  /* Bilinen sorunlu madde yok; yine de kesinlik iddia edilmez */
  | "muhtemelen_uygun";

/* Yemeğin tek bir malzemesinin değerlendirmesi */
export interface DishIngredientAssessment {
  rawText: string;
  translationTr: string;
  /* kesin: yemeği tanımlar, olasi: lokantaya göre değişir */
  certainty: "kesin" | "olasi";
  matched: boolean;
  status: ItemDisplayStatus;
  perMadhhab: Record<MadhhabKey, SimpleStatus> | null;
  /*
   * Alt listesi ayrıca çözümlenmiş kapsayıcı ad (天つゆ gibi). Eşleşmese
   * bile sorulacaklar listesine girmez: içeriği zaten tek tek listededir
   * ve kullanıcıya "tempura sosu" diye sormak yerine içindeki mirin
   * sorulur.
   */
  isCompoundParent: boolean;
}

export interface DishVerdictResult {
  verdict: DishVerdict;
  madhhabVerdicts: Record<MadhhabKey, SimpleStatus>;
  ingredients: DishIngredientAssessment[];
  /* Karara sebep olan malzemelerin sırası (ingredients dizisindeki konumları) */
  concernIndexes: number[];
}

export interface DishInput {
  item: VerdictItem;
  certainty: "kesin" | "olasi";
  translationTr: string;
}

/*
 * Sorulacak maddelerin sıralama ağırlığı. Haram en üstte, sonra şüpheli,
 * en sonda bilinmeyen. "kesin" malzeme aynı durumdaki "olasi" malzemeden
 * önce gelir: lokantaya göre değişmeyen bir sorun daha önemlidir.
 */
function severityRank(ing: DishIngredientAssessment): number {
  const statusRank =
    ing.status === "haram" ? 30 : ing.status === "supheli" ? 20 : 10;
  return statusRank + (ing.certainty === "kesin" ? 1 : 0);
}

export function computeDishVerdict(inputs: DishInput[]): DishVerdictResult {
  /*
   * Malzemesi çıkarılamayan yemek hakkında hiçbir şey bilmiyoruz demektir.
   * Boş liste "sorun bulunamadı" anlamına GELMEZ; temkin ilkesi gereği
   * sorulması gereken yemek sayılır.
   */
  if (inputs.length === 0) {
    return {
      verdict: "sorulmali",
      madhhabVerdicts: Object.fromEntries(
        MADHHABS.map((m) => [m, "supheli" as const]),
      ) as Record<MadhhabKey, SimpleStatus>,
      ingredients: [],
      concernIndexes: [],
    };
  }

  /*
   * Mezhep bazlı sonuçlar ve malzeme durumları etiket motorunun aynısıyla
   * hesaplanır; menüye özgü olan yalnızca bu sonuçların nasıl özetlendiğidir.
   */
  const base = computeVerdict(inputs.map((i) => i.item));

  const ingredients: DishIngredientAssessment[] = inputs.map((input, i) => {
    const assessment = base.items[i]!;
    return {
      rawText: input.item.rawText,
      translationTr: input.translationTr,
      certainty: input.certainty,
      matched: input.item.matched,
      status: assessment.displayStatus,
      perMadhhab: assessment.perMadhhab,
      isCompoundParent: input.item.isCompoundParent,
    };
  });

  /* Kapsayıcı adlar sorulacaklar listesinden çıkarılır (bkz. tip açıklaması) */
  const isConcern = (ing: DishIngredientAssessment): boolean =>
    ing.status !== "helal" && !(ing.isCompoundParent && !ing.matched);

  /*
   * KURAL 1: Yemeği TANIMLAYAN bir malzeme dört mezhebin tamamına göre
   * haramsa yemek kaçınılmalıdır. (CLAUDE.md Bölüm 7, madde 1'in menüye
   * uyarlanmış hâli; fark, kuralın yalnızca "kesin" malzemelere
   * uygulanmasıdır. Domuz kemiği suyu olmayan tonkotsu ramen, tonkotsu
   * ramen değildir; dolayısıyla bu çıkarım lokantaya göre değişmez.)
   */
  const definiteHaram = ingredients.some(
    (ing) => ing.certainty === "kesin" && ing.status === "haram",
  );
  if (definiteHaram) {
    return {
      verdict: "kacinilmali",
      madhhabVerdicts: base.madhhabVerdicts,
      ingredients,
      concernIndexes: ingredients
        .map((ing, i) => (ing.status === "haram" ? i : -1))
        .filter((i) => i >= 0)
        .sort(
          (a, b) => severityRank(ingredients[b]!) - severityRank(ingredients[a]!),
        ),
    };
  }

  /*
   * KURAL 2: Geriye kalan her sorunlu durum SORULMALI'dır. Buraya şunlar
   * girer: yalnızca "olasi" bir malzemeden gelen haramlık (o lokantada
   * kullanılmıyor olabilir), şüpheli hüküm, mezhepler arası fark ve
   * eşleşmeyen malzeme. Eşleşmeyen malzeme asla uygun sayılmaz
   * (CLAUDE.md Bölüm 7, madde 2).
   *
   * Sorulacak maddeler ŞİDDETE GÖRE sıralanır. Aynı damgayı taşıyan iki
   * yemekten biri muhtemelen domuz içeriyorken diğerinin tek sorunu
   * sostaki mirin olabilir; kullanıcı listenin başına bakınca hangisiyle
   * karşı karşıya olduğunu görmelidir.
   */
  const concernIndexes = ingredients
    .map((ing, i) => (isConcern(ing) ? i : -1))
    .filter((i) => i >= 0)
    .sort((a, b) => severityRank(ingredients[b]!) - severityRank(ingredients[a]!));

  if (concernIndexes.length > 0) {
    return {
      verdict: "sorulmali",
      madhhabVerdicts: base.madhhabVerdicts,
      ingredients,
      concernIndexes,
    };
  }

  /*
   * KURAL 3: Bütün malzemeler eşleşti ve dört mezhebe göre helal. Sonuç yine
   * de HELAL değil MUHTEMELEN UYGUN'dur; yukarıdaki üç belirsizlik kaynağı
   * (pişirme farkı, kesim usulü, ortak yağ/tezgâh) menüden görülemez.
   */
  return {
    verdict: "muhtemelen_uygun",
    madhhabVerdicts: base.madhhabVerdicts,
    ingredients,
    concernIndexes: [],
  };
}
