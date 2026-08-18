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
/*
 * Doğu Asya etiketlerinde malzeme adının yanında miktar bildirimi sıkça
 * bulunur: 오징어90.3%, 배추52%, 小麦粉 55%. Bu bildirim adın parçası
 * değildir ve eşleştirmeyi engeller. Yalnızca ARAMA için temizlenir;
 * etiketteki özgün yazım rawText alanında olduğu gibi korunur ve
 * kullanıcıya öyle gösterilir.
 */
export function stripQuantityAnnotations(term: string): string {
  return term
    .replace(/\d+(?:[.,]\d+)?\s*%/g, "")
    .replace(/^[\s,、,;:：]+|[\s,、,;:：]+$/g, "")
    .trim();
}

export function buildCandidates(
  term: string,
  language: DetectedLanguage,
): string[] {
  /* Önce özgün terim, sonra miktar bildirimi temizlenmiş biçim denenir */
  const bases = [term];
  const stripped = stripQuantityAnnotations(term);
  if (stripped.length > 0 && stripped !== term) bases.push(stripped);

  const candidates: string[] = [];
  for (const base of bases) {
    candidates.push(base);
    if (language === "ja") {
      candidates.push(katakanaToHiragana(base), hiraganaToKatakana(base));
    } else if (language === "zh_hans") {
      candidates.push(simplifiedToTraditional(base));
    } else if (language === "zh_hant") {
      candidates.push(traditionalToSimplified(base));
    } else {
      candidates.push(base.toLowerCase());
    }
  }

  /* Sıra korunarak tekilleştirme: ilk eleman her zaman özgün terim kalır */
  return [...new Set(candidates)];
}
