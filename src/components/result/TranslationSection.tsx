"use client";

import { useState } from "react";
import { Section } from "@/components/result/Section";
import { StatusIcon } from "@/components/result/status";
import type { AnalysisResult } from "@/lib/schemas";
import { htmlLang } from "@/lib/ui/lang";
import { STR } from "@/lib/ui/strings";

/*
 * Detay alanının ilk bölümü: içindekiler tercümesi
 * (bkz. CLAUDE.md, Bölüm 9, madde 1).
 *
 * Amaç, kullanıcının uygulamanın kararına bağımlı kalmadan malzemeleri kendi
 * dilinde okuyup kendi değerlendirmesini yapabilmesidir. Bu bölüm hatalı
 * sonuçlara karşı ana güvenlik mekanizmasıdır; hiçbir koşulda gizlenmez.
 *
 * Bilinen malzemelerin çevirisi veritabanındaki translationTr alanından
 * gelir; yalnızca veritabanında bulunmayanlar modelden gelir ve "otomatik"
 * işaretiyle görsel olarak ayırt edilir.
 */
export function TranslationSection({ result }: { result: AnalysisResult }) {
  const [view, setView] = useState<"lines" | "fluent">("lines");
  const lang = htmlLang(result.detectedLanguage);
  const hasModelTranslation = result.translation.lines.some(
    (line) => line.translationSource === "model",
  );

  return (
    <Section title={STR.sectionTranslation}>
      <div className="flex gap-2">
        {(
          [
            ["lines", STR.translationViewLines],
            ["fluent", STR.translationViewFluent],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            aria-pressed={view === key}
            className={`min-h-[44px] flex-1 rounded-xl px-3 text-sm font-medium ${
              view === key
                ? "bg-foreground text-background"
                : "bg-surface text-muted ring-1 ring-black/5 dark:ring-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "lines" ? (
        <ul className="divide-y divide-black/5 overflow-hidden rounded-2xl bg-surface ring-1 ring-black/5 dark:divide-white/5 dark:ring-white/10">
          {result.translation.lines.map((line, index) => (
            <li
              key={`${line.rawText}-${index}`}
              className="flex items-start gap-3 px-4 py-3"
            >
              <span className="pt-0.5">
                <StatusIcon status={line.status} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  lang={lang}
                  className="block break-words text-[15px] font-medium leading-snug"
                >
                  {line.rawText}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[14px] leading-snug text-muted">
                    {line.translationTr}
                  </span>
                  {line.translationSource === "model" ? (
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-muted dark:bg-white/10">
                      {STR.modelTranslationMark}
                    </span>
                  ) : null}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-surface p-4 text-[15px] leading-relaxed ring-1 ring-black/5 dark:ring-white/10">
          {result.translation.fluentTr.trim().length > 0
            ? result.translation.fluentTr
            : STR.translationEmpty}
        </p>
      )}

      {hasModelTranslation && view === "lines" ? (
        <p className="text-[12px] leading-relaxed text-muted">
          {STR.modelTranslationNote}
        </p>
      ) : null}
    </Section>
  );
}
