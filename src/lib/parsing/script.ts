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
 */
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
    if (hantOnly > hansOnly) return "zh_hant";
    /* Ayırt edici karakter yoksa basitleştirilmiş varsayılır */
    return "zh_hans";
  }
  if (latin > 0) return "en";
  return "other";
}
