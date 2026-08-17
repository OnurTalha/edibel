import type { DetectedLanguage, ParsedAllergen } from "./types";

/*
 * Alerjen satırının ayrıştırılması (bkz. CLAUDE.md, Bölüm 5.2).
 *
 * Bu satır projenin en değerli tespit kaynağıdır: Japonya'da mevzuat gereği
 * alerjen bildirimi zorunludur ve 豚肉 (domuz eti) bildirime dahildir.
 * Alerjen satırında domuz geçiyorsa, listedeki belirsiz hayvansal maddelerin
 * kaynağı büyük olasılıkla domuzdur; bu bilgi eşleştirme motoruna kaynak
 * ipucu olarak beslenir.
 *
 * Ayırıcı birleştirmeden sonra çalışır (、 ve ， artık virgüldür); Japonca
 * bildirimlerdeki ・ ayırıcısı korunmuştur.
 *
 * `group`: alerjen ifadesi olarak alınacak yakalama grubu. 0 = eşleşmenin
 * tamamı. Korece desenlerinde sınır karakterini dışarıda bırakmak için 1
 * kullanılır.
 */

interface AllergenPattern {
  re: RegExp;
  group: 0 | 1;
}

const JA_PATTERNS: AllergenPattern[] = [
  { re: /[(（]?一部に(.+?)を含む[)）]?/, group: 0 },
  { re: /原材料の一部に(.+?)を含(?:む|みます)/, group: 0 },
  { re: /本品は(.+?)を含む/, group: 0 },
  { re: /アレルギー物質[^:：\n]*[:：]?[ ]*([^\n]+)/, group: 0 },
];

const KO_PATTERNS: AllergenPattern[] = [
  /* Parantez içi bildirim: (돼지고기 함유) */
  { re: /\(([^)]*함유[^)]*)\)/, group: 1 },
  /* Cümle sınırından sonra gelen bildirim: "... 돼지고기, 대두 함유" */
  { re: /(?:^|[\n)\].:])[ ]*([가-힣0-9,· ]{1,60}?함유)/, group: 1 },
  /* Son çare: 함유'dan hemen önceki virgülsüz ifade */
  { re: /([가-힣· ]{1,30}?함유)/, group: 1 },
  { re: /알레르기[ ]*유발[ ]*물질[^:：\n]*[:：]?[ ]*([^\n]+)/, group: 0 },
];

const ZH_PATTERNS: AllergenPattern[] = [
  { re: /致敏物质[^:：\n]*[:：]?[ ]*([^\n]+)/, group: 0 },
  { re: /致敏物質[^:：\n]*[:：]?[ ]*([^\n]+)/, group: 0 },
  { re: /过敏原[^:：\n]*[:：]?[ ]*([^\n]+)/, group: 0 },
  { re: /過敏原[^:：\n]*[:：]?[ ]*([^\n]+)/, group: 0 },
  { re: /本产品含有([^\n。]+)/, group: 0 },
  { re: /本產品含有([^\n。]+)/, group: 0 },
];

const PORK_MARKERS = /豚|돼지|猪|豬/;

export function extractAllergenLine(
  normalizedText: string,
  language: DetectedLanguage,
): ParsedAllergen {
  const patterns =
    language === "ja"
      ? JA_PATTERNS
      : language === "ko"
        ? KO_PATTERNS
        : language === "zh_hans" || language === "zh_hant"
          ? ZH_PATTERNS
          : [];

  for (const { re, group } of patterns) {
    const m = re.exec(normalizedText);
    if (m) {
      const rawText = (group === 1 ? (m[1] ?? m[0]) : m[0]).trim();
      return { rawText, containsPork: PORK_MARKERS.test(rawText) };
    }
  }
  return { rawText: null, containsPork: false };
}
