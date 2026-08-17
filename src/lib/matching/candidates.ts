import {
  hiraganaToKatakana,
  katakanaToHiragana,
  simplifiedToTraditional,
  traditionalToSimplified,
  type DetectedLanguage,
} from "@/lib/parsing";

/*
 * Bir terim için aranacak yazım adayları (bkz. CLAUDE.md, Bölüm 5.4).
 *
 * İlk aday terimin kendisidir (tam eşleşme yöntemi bunu kullanır); sonraki
 * adaylar yazım toleransı varyantlarıdır (takma ad yöntemi bunları kullanır):
 *  - Japonca: katakana ↔ hiragana katlaması
 *  - Çince: basitleştirilmiş ↔ geleneksel eşleme
 *  - Latin: küçük harf
 */
export function buildCandidates(
  term: string,
  language: DetectedLanguage,
): string[] {
  const candidates = [term];

  if (language === "ja") {
    candidates.push(katakanaToHiragana(term), hiraganaToKatakana(term));
  } else if (language === "zh_hans") {
    candidates.push(simplifiedToTraditional(term));
  } else if (language === "zh_hant") {
    candidates.push(traditionalToSimplified(term));
  } else {
    candidates.push(term.toLowerCase());
  }

  /* Sıra korunarak tekilleştirme: ilk eleman her zaman özgün terim kalır */
  return [...new Set(candidates)];
}
