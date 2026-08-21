import { Section } from "@/components/result/Section";
import { StatusIcon, statusColor, statusLabel } from "@/components/result/status";
import type { AnalysisResult } from "@/lib/schemas";
import { htmlLang } from "@/lib/ui/lang";
import { MADHHAB_ORDER } from "@/lib/ui/madhhab";
import { STR } from "@/lib/ui/strings";

/*
 * Detay alanının dördüncü bölümü: mezhep karşılaştırma tablosu
 * (bkz. CLAUDE.md, Bölüm 9, madde 4).
 * Satırlarda malzemeler, sütunlarda dört mezhep bulunur. Tablo yatay
 * kaydırılabilir bir kutu içindedir; ana gövdede yatay kaydırma olmaz
 * (Bölüm 8).
 */


export function MadhhabTable({ result }: { result: AnalysisResult }) {
  if (result.problematicIngredients.length === 0) return null;
  const lang = htmlLang(result.detectedLanguage);

  return (
    <Section title={STR.sectionMadhhabTable}>
      <div className="overflow-x-auto rounded-2xl bg-surface ring-1 ring-black/5 dark:ring-white/10">
        <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-black/5 dark:border-white/10">
              <th className="px-3 py-2.5 font-semibold">
                {STR.tableIngredient}
              </th>
              {MADHHAB_ORDER.map((madhhab) => (
                <th key={madhhab} className="px-3 py-2.5 font-semibold">
                  {STR.madhhabNames[madhhab]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.problematicIngredients.map((item, index) => {
              const byMadhhab = new Map(
                item.rulings.map((ruling) => [ruling.madhhab, ruling.status]),
              );
              return (
                <tr
                  key={`${item.rawText}-${index}`}
                  className="border-b border-black/5 last:border-0 dark:border-white/10"
                >
                  <th
                    scope="row"
                    className="max-w-[160px] px-3 py-2.5 align-top font-medium"
                  >
                    <span lang={lang} className="block break-words">
                      {item.rawText}
                    </span>
                    <span className="block text-[12px] font-normal text-muted">
                      {item.matchedNameTr}
                    </span>
                  </th>
                  {MADHHAB_ORDER.map((madhhab) => {
                    /* Hüküm yoksa malzeme eşleşmemiştir: bilinmiyor */
                    const status = byMadhhab.get(madhhab) ?? "bilinmiyor";
                    return (
                      <td key={madhhab} className="px-3 py-2.5 align-top">
                        <span className="flex items-center gap-1.5">
                          <StatusIcon status={status} className="h-4 w-4" />
                          <span className={statusColor(status)}>
                            {statusLabel(status)}
                          </span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-muted">{STR.tableScrollHint}</p>
    </Section>
  );
}
