import type { AnalysisResult } from "@/lib/schemas";

/*
 * Etiketten okunan özgün metin, tarayıcının doğru yazı tipini seçebilmesi
 * için lang özniteliğiyle işaretlenir (bkz. CLAUDE.md, Bölüm 8: Doğu Asya
 * yazı tipi geri dönüş zinciri Japonca, Korece ve Çince için ayrı çalışır).
 */
export function htmlLang(
  detected: AnalysisResult["detectedLanguage"],
): string | undefined {
  switch (detected) {
    case "ja":
      return "ja";
    case "ko":
      return "ko";
    case "zh_hans":
      return "zh-Hans";
    case "zh_hant":
      return "zh-Hant";
    case "en":
      return "en";
    default:
      return undefined;
  }
}
