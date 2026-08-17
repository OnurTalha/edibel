import { normalizeText } from "./normalize";
import { detectLanguage } from "./script";
import { extractIngredientSection } from "./section";
import { extractAllergenLine } from "./allergen";
import { tokenizeIngredients } from "./tokenize";
import type { ParsedLabel } from "./types";

export * from "./types";
export {
  normalizeText,
  katakanaToHiragana,
  hiraganaToKatakana,
  traditionalToSimplified,
  simplifiedToTraditional,
} from "./normalize";
export { detectLanguage } from "./script";
export { extractIngredientSection } from "./section";
export { extractAllergenLine } from "./allergen";
export { tokenizeIngredients, splitTopLevel, splitEntry } from "./tokenize";

/*
 * Ana ayrıştırma hattı. Etiketten okunan ham metni alır; normalleştirir,
 * dili tespit eder, içindekiler bölümünü ayırır, alerjen satırını çıkarır
 * ve malzeme girdilerini üretir.
 *
 * Saf fonksiyondur; veritabanına veya ağa erişmez. Çeviri bu katmana hiçbir
 * biçimde girmez — eşleştirme ve karar yalnızca özgün metinle çalışır.
 */
export function parseLabel(rawText: string): ParsedLabel {
  const normalizedText = normalizeText(rawText);
  const detectedLanguage = detectLanguage(normalizedText);

  const { headerFound, sectionText } = extractIngredientSection(
    normalizedText,
    detectedLanguage,
  );

  const allergen = extractAllergenLine(normalizedText, detectedLanguage);

  /*
   * Alerjen bildirimi listenin sonuna bitişik yazılır; malzeme olarak
   * sayılmaması için bölüm metninden çıkarılıp ayrı alanda tutulur.
   */
  let listText = sectionText;
  if (allergen.rawText) {
    listText = listText.replace(allergen.rawText, "");
  }

  const entries = tokenizeIngredients(listText);

  /*
   * Sezgisel içindekiler kontrolü: başlık bulunduysa güvenilirdir; başlık
   * yoksa en az iki girdi bekleriz. Tek parça metin (ör. yalnızca besin
   * değerleri tablosu) içindekiler listesi sayılmaz.
   */
  const looksLikeIngredientList = headerFound || entries.length >= 2;

  return {
    detectedLanguage,
    normalizedText,
    headerFound,
    sectionText,
    entries,
    allergen,
    looksLikeIngredientList,
  };
}
