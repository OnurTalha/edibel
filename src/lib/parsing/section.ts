import type { DetectedLanguage } from "./types";

/*
 * İçindekiler bölümünün bulunması (bkz. CLAUDE.md, Bölüm 5.1).
 *
 * Başlıklardan sonra gelen ve besin değerleri tablosuna (veya bir sonraki
 * etiket alanına) kadar süren metin içindekiler listesidir.
 *
 * Not: Bölüm 5.1 tablosundaki 名称 (Japonca) ve 식품유형 (Korece) ürün adı /
 * gıda türü alanlarının başlıklarıdır; içindekiler bölümünü BAŞLATMAZ,
 * etiket alanı sınırı olarak bölümü SONLANDIRIR. Bu sebeple başlangıç değil
 * bitiş işaretleri arasında yer alırlar.
 */

interface SectionMarkers {
  start: RegExp[];
  end: RegExp[];
}

const MARKERS: Record<string, SectionMarkers> = {
  ja: {
    start: [/原材料名/, /原材料/, /添加物/],
    end: [
      /栄養成分表示/, /栄養成分/, /名称/, /内容量/, /賞味期限/, /消費期限/,
      /保存方法/, /製造者/, /販売者/, /輸入者/, /原産国/, /製造所/,
    ],
  },
  ko: {
    start: [/원재료명/, /원재료/, /성분명/, /성분/],
    end: [
      /영양정보/, /영양성분/, /식품유형/, /품목보고번호/, /유통기한/,
      /소비기한/, /보관방법/, /제조원/, /판매원/, /내용량/,
    ],
  },
  zh: {
    start: [/配料表/, /配料/, /成分/, /原料/],
    end: [
      /营养成分表/, /營養成分/, /营养成分/, /保质期/, /保存期限/, /保存方法/,
      /生产日期/, /製造日期/, /净含量/, /淨含量/, /生产商/, /製造商/, /贮存条件/,
    ],
  },
};

export interface ExtractedSection {
  headerFound: boolean;
  sectionText: string;
}

export function extractIngredientSection(
  normalizedText: string,
  language: DetectedLanguage,
): ExtractedSection {
  const markers =
    language === "ja"
      ? MARKERS.ja!
      : language === "ko"
        ? MARKERS.ko!
        : language === "zh_hans" || language === "zh_hant"
          ? MARKERS.zh!
          : null;

  if (!markers) {
    /* Latin veya bilinmeyen dil: başlık aranmaz, metnin tamamı kullanılır */
    return { headerFound: false, sectionText: normalizedText };
  }

  /* En erken eşleşen başlangıç başlığı bulunur */
  let startIdx = -1;
  let startLen = 0;
  for (const re of markers.start) {
    const m = re.exec(normalizedText);
    if (m && (startIdx === -1 || m.index < startIdx)) {
      startIdx = m.index;
      startLen = m[0].length;
    }
  }

  if (startIdx === -1) {
    return { headerFound: false, sectionText: normalizedText };
  }

  let section = normalizedText.slice(startIdx + startLen);
  /* Başlıktan hemen sonra gelen iki nokta ve boşluklar atılır */
  section = section.replace(/^[\s:：]+/, "");

  /* Başlangıçtan sonraki en erken bitiş işaretinde kesilir */
  let endIdx = section.length;
  for (const re of markers.end) {
    const m = re.exec(section);
    if (m && m.index < endIdx) endIdx = m.index;
  }

  return { headerFound: true, sectionText: section.slice(0, endIdx).trim() };
}
