"use client";

import { useEffect, useState } from "react";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ScaleIcon,
  WarningIcon,
  XCircleIcon,
} from "@/components/icons";
import type { AnalysisResult } from "@/lib/schemas";
import { STR } from "@/lib/ui/strings";
import { useSettings } from "@/lib/ui/store";

/*
 * Sonuç ekranı üst bölümü (bkz. CLAUDE.md, Bölüm 9).
 * Ekranın tamamını kaplar ve yalnızca ana hükmü, renk kodunu, mezhep
 * bilgisini ve aşağı kaydırma işaretini içerir. Başka hiçbir bilgi
 * bulunmaz; kullanıcı tek bakışta kararı görebilmelidir.
 *
 * Renk tek başına bilgi taşımaz: her hükmün ayrıca metni ve simgesi vardır.
 *
 * Ayarlarda mezhep seçilmişse önce o mezhebin hükmü gösterilir, diğer üç
 * mezhebin hükmü hemen altında listelenir. Seçim yoksa dört mezhep birlikte
 * gösterilir. Bu tercih yalnızca gösterimi etkiler.
 */

const VERDICT_THEME: Record<string, string> = {
  helal: "bg-emerald-700 text-white",
  haram: "bg-red-800 text-white",
  supheli: "bg-amber-500 text-[#1b1405]",
  mezhebe_gore_degisir: "bg-indigo-700 text-white",
};

const MADHHABS = ["hanefi", "safii", "maliki", "hanbeli"] as const;

function VerdictIcon({ verdict }: { verdict: string }) {
  const className = "h-16 w-16";
  if (verdict === "helal") return <CheckCircleIcon className={className} />;
  if (verdict === "haram") return <XCircleIcon className={className} />;
  if (verdict === "mezhebe_gore_degisir")
    return <ScaleIcon className={className} />;
  return <WarningIcon className={className} />;
}

function MadhhabList({
  title,
  entries,
}: {
  title: string;
  entries: Array<[string, string]>;
}) {
  return (
    <div className="mt-8 w-full max-w-[300px]">
      <p className="text-xs uppercase tracking-wide opacity-80">{title}</p>
      <ul className="mt-3 space-y-1.5">
        {entries.map(([madhhab, status]) => (
          <li
            key={madhhab}
            className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-sm"
          >
            <span>{STR.madhhabNames[madhhab] ?? madhhab}</span>
            <span className="font-semibold uppercase">
              {STR.statusLabels[status] ?? status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VerdictCard({ result }: { result: AnalysisResult }) {
  /* Kalıcı tercih yalnızca istemcide okunur */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const preferred = useSettings((state) => state.madhhab);
  const selected = mounted ? preferred : null;

  const headline = selected ? result.madhhabVerdicts[selected] : result.verdict;
  const theme = VERDICT_THEME[headline] ?? VERDICT_THEME.supheli!;

  const helalMadhhabs = MADHHABS.filter(
    (madhhab) => result.madhhabVerdicts[madhhab] === "helal",
  );

  return (
    <section
      className={`screen-h flex flex-col items-center justify-center px-6 py-12 text-center ${theme}`}
    >
      <VerdictIcon verdict={headline} />

      <h1 className="mt-6 text-[34px] font-bold leading-tight tracking-tight">
        {STR.verdictLabels[headline] ?? headline}
      </h1>
      <p className="mt-3 max-w-[300px] text-balance text-[15px] leading-relaxed opacity-90">
        {selected
          ? STR.verdictAccordingTo(STR.madhhabNames[selected] ?? selected)
          : (STR.verdictSub[result.verdict] ?? "")}
      </p>

      {selected ? (
        <MadhhabList
          title={STR.verdictOtherMadhhabs}
          entries={MADHHABS.filter((madhhab) => madhhab !== selected).map(
            (madhhab) => [madhhab, result.madhhabVerdicts[madhhab]],
          )}
        />
      ) : result.verdict === "helal" && helalMadhhabs.length > 0 ? (
        <div className="mt-8">
          <p className="text-xs uppercase tracking-wide opacity-80">
            {STR.verdictBadgesTitle}
          </p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {helalMadhhabs.map((madhhab) => (
              <li
                key={madhhab}
                className="rounded-full bg-black/20 px-3 py-1.5 text-sm font-medium"
              >
                {STR.madhhabNames[madhhab]}
              </li>
            ))}
          </ul>
        </div>
      ) : result.verdict === "mezhebe_gore_degisir" ? (
        <MadhhabList
          title={STR.verdictDiffTitle}
          entries={MADHHABS.map((madhhab) => [
            madhhab,
            result.madhhabVerdicts[madhhab],
          ])}
        />
      ) : null}

      <div className="mt-auto flex flex-col items-center gap-1 pt-10 opacity-90">
        <span className="text-sm font-medium">{STR.scrollForDetails}</span>
        <ChevronDownIcon className="h-5 w-5 animate-bounce" />
      </div>
    </section>
  );
}
