import { WarningIcon } from "@/components/icons";
import { Section } from "@/components/result/Section";
import type { AnalysisResult } from "@/lib/schemas";
import { htmlLang } from "@/lib/ui/lang";
import { STR } from "@/lib/ui/strings";

/*
 * Detay alanının ikinci bölümü: alerjen bildirimi
 * (bkz. CLAUDE.md, Bölüm 5.2 ve Bölüm 9, madde 2).
 *
 * Japonya'da domuz eti bildirimi mevzuat gereği zorunludur; bu satır
 * projenin en değerli tespit kaynağıdır. Domuz bildirimi varsa bölüm
 * belirgin biçimde vurgulanır.
 */
export function AllergenSection({ result }: { result: AnalysisResult }) {
  const { allergenLine } = result;
  const lang = htmlLang(result.detectedLanguage);

  return (
    <Section title={STR.sectionAllergen}>
      {allergenLine.rawText === null ? (
        <p className="rounded-2xl bg-surface p-4 text-[14px] text-muted ring-1 ring-black/5 dark:ring-white/10">
          {STR.allergenNone}
        </p>
      ) : (
        <div
          className={`space-y-3 rounded-2xl p-4 ring-1 ${
            allergenLine.containsPork
              ? "bg-red-50 ring-red-200 dark:bg-red-950/40 dark:ring-red-900"
              : "bg-surface ring-black/5 dark:ring-white/10"
          }`}
        >
          {allergenLine.containsPork ? (
            <p className="flex items-start gap-2 text-[15px] font-semibold text-red-800 dark:text-red-300">
              <WarningIcon className="mt-0.5 h-5 w-5 shrink-0" />
              {STR.allergenPorkWarning}
            </p>
          ) : null}

          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted">
              {STR.allergenOriginalLabel}
            </p>
            <p lang={lang} className="mt-1 break-words text-[15px]">
              {allergenLine.rawText}
            </p>
          </div>

          {allergenLine.translationTr ? (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted">
                {STR.allergenTranslationLabel}
              </p>
              <p className="mt-1 text-[15px] text-muted">
                {allergenLine.translationTr}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </Section>
  );
}
