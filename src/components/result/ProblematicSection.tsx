"use client";

import { useState } from "react";
import { ChevronDownIcon } from "@/components/icons";
import { Section } from "@/components/result/Section";
import { StatusIcon, statusColor, statusLabel } from "@/components/result/status";
import type { AnalysisResult } from "@/lib/schemas";
import { htmlLang } from "@/lib/ui/lang";
import { STR } from "@/lib/ui/strings";

/*
 * Detay alanının üçüncü bölümü: sorunlu malzemeler
 * (bkz. CLAUDE.md, Bölüm 9, madde 3).
 * Her malzeme kartı dokunulduğunda açılır ve gerekçeyi gösterir.
 */

type Problematic = AnalysisResult["problematicIngredients"][number];

/*
 * Kart başlığındaki simge yalnızca gösterim içindir; sonuç nesnesinde hazır
 * duran hükümlerden özetlenir, yeni bir dini değerlendirme yapılmaz.
 * Eşleşmeyen malzeme hiçbir zaman helal sayılmaz (Bölüm 7, kural 2).
 */
function displayStatus(item: Problematic): string {
  if (item.matchMethod === "unmatched") return "bilinmiyor";
  const statuses = item.rulings.map((ruling) =>
    ruling.status === "mekruh" ? "supheli" : ruling.status,
  );
  if (statuses.length > 0 && statuses.every((status) => status === "haram")) {
    return "haram";
  }
  return "supheli";
}

function IngredientCard({
  item,
  lang,
}: {
  item: Problematic;
  lang: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const status = displayStatus(item);

  return (
    <li className="overflow-hidden rounded-2xl bg-surface ring-1 ring-black/5 dark:ring-white/10">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left"
      >
        <StatusIcon status={status} className="h-5 w-5" />
        <span className="min-w-0 flex-1">
          <span lang={lang} className="block break-words text-[15px] font-medium">
            {item.rawText}
          </span>
          <span className="block text-[13px] text-muted">
            {item.matchedNameTr}
          </span>
        </span>
        <span className={`text-[12px] font-semibold ${statusColor(status)}`}>
          {statusLabel(status)}
        </span>
        <ChevronDownIcon
          className={`h-5 w-5 shrink-0 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
        <span className="sr-only">
          {open ? STR.collapseDetails : STR.expandDetails}
        </span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-black/5 px-4 py-4 dark:border-white/10">
          <dl className="space-y-1.5 text-[13px]">
            {item.sourceHint ? (
              <div className="flex gap-2">
                <dt className="text-muted">{STR.sourceHintLabel}:</dt>
                <dd lang={lang} className="break-words">
                  {item.sourceHint}
                </dd>
              </div>
            ) : null}
            {item.resolvedSource ? (
              <div className="flex gap-2">
                <dt className="text-muted">{STR.sourceLabel}:</dt>
                <dd>
                  {STR.sourceNames[item.resolvedSource] ?? item.resolvedSource}
                </dd>
              </div>
            ) : null}
            {item.insCode ? (
              <div className="flex gap-2">
                <dt className="text-muted">{STR.insLabel}:</dt>
                <dd>{item.insCode}</dd>
              </div>
            ) : null}
            <div className="flex gap-2">
              <dt className="text-muted">{STR.matchLabel}:</dt>
              <dd>
                {STR.matchMethodLabels[item.matchMethod] ?? item.matchMethod}
              </dd>
            </div>
          </dl>

          {item.matchMethod === "unmatched" ? (
            <p className="rounded-xl bg-black/5 p-3 text-[13px] leading-relaxed text-muted dark:bg-white/5">
              {STR.unmatchedIngredientNote}
            </p>
          ) : null}

          {item.rulings.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                {STR.rulingsTitle}
              </p>
              <ul className="space-y-2">
                {item.rulings.map((ruling) => (
                  <li
                    key={`${ruling.madhhab}-${ruling.principleKey}`}
                    className="rounded-xl bg-black/[0.03] p-3 dark:bg-white/5"
                  >
                    <p className="flex items-center justify-between gap-2 text-[14px] font-medium">
                      <span>
                        {STR.madhhabNames[ruling.madhhab] ?? ruling.madhhab}
                      </span>
                      <span
                        className={`text-[12px] font-semibold uppercase ${statusColor(
                          ruling.status,
                        )}`}
                      >
                        {statusLabel(ruling.status)}
                      </span>
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">
                      {ruling.reasoningTr}
                    </p>
                    <p className="mt-1.5 text-[11px] text-muted">
                      {STR.sourceRefLabel}: {ruling.sourceRef}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function ProblematicSection({ result }: { result: AnalysisResult }) {
  const lang = htmlLang(result.detectedLanguage);

  return (
    <Section title={STR.sectionProblematic}>
      {result.problematicIngredients.length === 0 ? (
        <p className="rounded-2xl bg-surface p-4 text-[14px] text-muted ring-1 ring-black/5 dark:ring-white/10">
          {STR.problematicNone}
        </p>
      ) : (
        <ul className="space-y-2">
          {result.problematicIngredients.map((item, index) => (
            <IngredientCard
              key={`${item.rawText}-${index}`}
              item={item}
              lang={lang}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}
