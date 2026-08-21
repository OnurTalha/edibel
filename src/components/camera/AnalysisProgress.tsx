"use client";

import { useEffect, useState } from "react";
import { CheckCircleIcon, SpinnerIcon } from "@/components/icons";
import { STR } from "@/lib/ui/strings";
import { useWakeLock } from "@/lib/ui/wake-lock";

/*
 * Ekran 3: analiz (bkz. CLAUDE.md, Bölüm 9).
 * Adımlar tek bir sunucu isteğinin ilerleyişini anlatır; istek tamamlanana
 * kadar son adımda beklenir. Analiz sırasında ekranın kilitlenmemesi için
 * uyanık tutma arayüzü kullanılır (Bölüm 8) ve kullanıcı isteği iptal
 * edebilir (Bölüm 12).
 */

const STEP_INTERVAL_MS = 2500;

export function AnalysisProgress({
  onCancel,
  /* Menü taramasında adım metinleri farklıdır; varsayılan etikettir */
  steps = STR.analysisSteps,
}: {
  onCancel: () => void;
  steps?: readonly string[];
}) {
  const [step, setStep] = useState(0);
  useWakeLock(true);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep((current) => Math.min(current + 1, steps.length - 1));
    }, STEP_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-10">
      <h1 className="text-xl font-semibold text-white">{STR.analysisTitle}</h1>

      <ol className="mt-8 space-y-4">
        {steps.map((label, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <li key={label} className="flex items-center gap-3">
              {done ? (
                <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-400" />
              ) : active ? (
                <SpinnerIcon className="h-5 w-5 shrink-0 animate-spin text-white" />
              ) : (
                <span className="h-5 w-5 shrink-0 rounded-full border border-white/25" />
              )}
              <span
                className={
                  done
                    ? "text-[15px] text-white/60"
                    : active
                      ? "text-[15px] font-medium text-white"
                      : "text-[15px] text-white/40"
                }
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex-1" />

      <p className="text-center text-sm text-white/60">
        {STR.analysisKeepOpen}
      </p>
      <button
        type="button"
        onClick={onCancel}
        className="mt-5 min-h-[52px] w-full rounded-2xl border border-white/30 px-4 text-[15px] font-medium text-white"
      >
        {STR.analysisCancel}
      </button>
    </div>
  );
}
