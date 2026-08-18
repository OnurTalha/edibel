import { Section } from "@/components/result/Section";
import type { FiqhPrincipleView } from "@/lib/schemas";
import { STR } from "@/lib/ui/strings";

/*
 * Detay alanının beşinci bölümü: gerekçeler
 * (bkz. CLAUDE.md, Bölüm 9, madde 5).
 * Mezhepler arasındaki farkın hangi fıkhi ilkeden kaynaklandığı sade bir
 * dille açıklanır. Metinler fiqh_principles tablosundan gelir.
 */
export function PrinciplesSection({
  principles,
}: {
  principles: FiqhPrincipleView[];
}) {
  if (principles.length === 0) return null;

  return (
    <Section title={STR.sectionPrinciples}>
      <p className="text-[13px] text-muted">{STR.principlesIntro}</p>
      <ul className="space-y-2">
        {principles.map((principle) => (
          <li
            key={principle.key}
            className="rounded-2xl bg-surface p-4 ring-1 ring-black/5 dark:ring-white/10"
          >
            <p className="text-[15px] font-medium">{principle.titleTr}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">
              {principle.explanationTr}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
