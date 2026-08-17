import type { DetectedLanguage } from "./types";
import { SIMPLIFIED_ONLY_CHARS, TRADITIONAL_ONLY_CHARS } from "./normalize";

/*
 * Yazı sistemi tespiti (bkz. CLAUDE.md, Bölüm 5.5).
 *
 * Karakter aralıklarına bakılır: Hangul → Korece, kana → Japonca, yalnızca
 * Han karakterleri → Çince. Çincede basitleştirilmiş/geleneksel ayrımı,
 * yalnızca bir yazımda bulunan ayırt edici karakterlerle yapılır; kısa
 * metinlerde ayrım kesin yapılamayabilir, bu durumda zh_hans varsayılır ve
 * eşleştirme her iki takma ad kümesinde de arama yapar.
 *
 * Tamamı kanji olan Japonca metin (kana içermeyen kısa etiket parçaları)
 * salt karakter sayımıyla Çince sanılır. Bunu önlemek için iki ek sinyal
 * kullanılır: Japon etiketlerine özgü kalıp kelimeler (原材料名, 賞味期限)
 * ve yalnızca Japonca'da bulunan shinjitai karakter biçimleri (塩, 栄, 発;
 * Çince karşılıkları 盐/鹽, 荣/榮, 发/發'tır).
 */

const JA_LABEL_MARKERS =
  /原材料名|栄養成分|賞味期限|消費期限|内容量|保存方法|製造者|添加物|お客様/;

const JA_SHINJITAI_ONLY = new Set(
  "塩栄発売変実県児駅労歴済斉粋価団図帰広拡剤麺".split(""),
);
export function detectLanguage(text: string): DetectedLanguage {
  let hangul = 0;
  let kana = 0;
  let han = 0;
  let latin = 0;
  let hansOnly = 0;
  let hantOnly = 0;

  for (const ch of text) {
    if (/\p{Script=Hangul}/u.test(ch)) hangul++;
    else if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(ch)) kana++;
    else if (/\p{Script=Han}/u.test(ch)) {
      han++;
      if (SIMPLIFIED_ONLY_CHARS.has(ch)) hansOnly++;
      if (TRADITIONAL_ONLY_CHARS.has(ch)) hantOnly++;
    } else if (/[A-Za-z]/.test(ch)) latin++;
  }

  /* Hangul varlığı Korece için belirleyicidir (Korece'de Han nadiren geçer) */
  if (hangul > 0 && hangul >= kana) return "ko";
  /* Kana varlığı Japonca için belirleyicidir (kanji ile karışık yazılır) */
  if (kana > 0) return "ja";
  if (han > 0) {
    /* Kana yok: Japonca'ya özgü kalıp veya shinjitai biçimi aranır */
    if (JA_LABEL_MARKERS.test(text)) return "ja";
    for (const ch of text) {
      if (JA_SHINJITAI_ONLY.has(ch)) return "ja";
    }
    if (hantOnly > hansOnly) return "zh_hant";
    /* Ayırt edici karakter yoksa basitleştirilmiş varsayılır */
    return "zh_hans";
  }
  if (latin > 0) return "en";
  return "other";
}
