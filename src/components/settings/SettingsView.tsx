"use client";

import { useEffect, useState } from "react";
import { CheckCircleIcon } from "@/components/icons";
import { STR } from "@/lib/ui/strings";
import { useSettings, type CameraMode, type Madhhab } from "@/lib/ui/store";

/*
 * Ayarlar ekranı (bkz. CLAUDE.md, Bölüm 9: Ekran 1).
 * Mezhep tercihi yalnızca sonuç ekranındaki GÖSTERİM sırasını değiştirir;
 * hüküm hesabı her zaman dört mezhep için veritabanından yapılır.
 */

const MADHHABS: Madhhab[] = ["hanefi", "safii", "maliki", "hanbeli"];

function OptionRow({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex min-h-[52px] w-full items-center justify-between gap-3 px-4 text-left text-[15px] ${
        selected ? "font-medium" : ""
      }`}
    >
      <span>{label}</span>
      {selected ? (
        <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-full border border-black/15 dark:border-white/20" />
      )}
    </button>
  );
}

export function SettingsView() {
  /* Kalıcı tercihler yalnızca istemcide okunur */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const madhhab = useSettings((state) => state.madhhab);
  const setMadhhab = useSettings((state) => state.setMadhhab);
  const cameraMode = useSettings((state) => state.cameraMode);
  const setCameraMode = useSettings((state) => state.setCameraMode);

  if (!mounted) return <div className="px-5 py-6" />;

  const cameraOptions: Array<[CameraMode, string]> = [
    ["primary", STR.cameraModePrimary],
    ["live", STR.cameraModeLive],
  ];

  return (
    <div className="space-y-8 px-5 pb-14 pt-4">
      <section className="space-y-3">
        <h2 className="text-[17px] font-semibold tracking-tight">
          {STR.settingsMadhhabTitle}
        </h2>
        <p className="text-[13px] leading-relaxed text-muted">
          {STR.settingsMadhhabHelp}
        </p>
        <div className="divide-y divide-black/5 overflow-hidden rounded-2xl bg-surface ring-1 ring-black/5 dark:divide-white/5 dark:ring-white/10">
          {MADHHABS.map((option) => (
            <OptionRow
              key={option}
              label={STR.madhhabNames[option] ?? option}
              selected={madhhab === option}
              onSelect={() => setMadhhab(option)}
            />
          ))}
          <OptionRow
            label={STR.settingsMadhhabNone}
            selected={madhhab === null}
            onSelect={() => setMadhhab(null)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[17px] font-semibold tracking-tight">
          {STR.settingsCameraTitle}
        </h2>
        <p className="text-[13px] leading-relaxed text-muted">
          {STR.settingsCameraHelp}
        </p>
        <div className="divide-y divide-black/5 overflow-hidden rounded-2xl bg-surface ring-1 ring-black/5 dark:divide-white/5 dark:ring-white/10">
          {cameraOptions.map(([option, label]) => (
            <OptionRow
              key={option}
              label={label}
              selected={cameraMode === option}
              onSelect={() => setCameraMode(option)}
            />
          ))}
        </div>
      </section>

      <p className="text-[12px] text-muted">{STR.settingsStoredLocally}</p>

      <p className="rounded-2xl bg-surface p-4 text-[13px] leading-relaxed text-muted ring-1 ring-black/5 dark:ring-white/10">
        {STR.disclaimer}
      </p>
    </div>
  );
}
