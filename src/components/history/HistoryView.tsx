"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CameraIcon, SpinnerIcon, WarningIcon } from "@/components/icons";
import { StatusIcon } from "@/components/result/status";
import { errorMessage, fetchScanList } from "@/lib/ui/api";
import { getDeviceId } from "@/lib/ui/device";
import { htmlLang } from "@/lib/ui/lang";
import { STR } from "@/lib/ui/strings";

/*
 * Geçmiş taramalar (bkz. CLAUDE.md, Faz 8).
 * Kayıtlar anonim cihaz kimliğiyle sorgulanır; kimlik yalnızca tarayıcıda
 * üretilir ve saklanır.
 */

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

/* Karar kartındaki renk kodunun küçük karşılığı */
const VERDICT_CHIP: Record<string, string> = {
  helal: "bg-emerald-700 text-white",
  haram: "bg-red-800 text-white",
  supheli: "bg-amber-500 text-[#1b1405]",
  mezhebe_gore_degisir: "bg-indigo-700 text-white",
};

export function HistoryView() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  useEffect(() => setDeviceId(getDeviceId()), []);

  const query = useQuery({
    queryKey: ["scan-list", deviceId],
    queryFn: () => fetchScanList(deviceId!),
    enabled: deviceId !== null,
  });

  return (
    <div className="px-5 pb-14 pt-4">
      {query.isPending ? (
        <div className="flex items-center gap-2 py-10 text-muted">
          <SpinnerIcon className="h-5 w-5 animate-spin" />
          <span className="text-[15px]">{STR.loading}</span>
        </div>
      ) : query.isError ? (
        <p className="flex items-start gap-2 rounded-2xl bg-surface p-4 text-[15px] leading-relaxed ring-1 ring-black/5 dark:ring-white/10">
          <WarningIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          {errorMessage(query.error)}
        </p>
      ) : query.data.length === 0 ? (
        <div className="space-y-5 py-6">
          <p className="text-[15px] leading-relaxed text-muted">
            {STR.historyEmpty}
          </p>
          <Link
            href="/tara"
            className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-2xl bg-emerald-700 px-5 text-[16px] font-semibold text-white dark:bg-emerald-600"
          >
            <CameraIcon className="h-5 w-5" />
            {STR.scan}
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {query.data.map((scan) => (
            <li key={scan.scanId}>
              <Link
                href={`/sonuc/${scan.scanId}`}
                className="flex min-h-[72px] items-center gap-3 rounded-2xl bg-surface p-4 ring-1 ring-black/5 dark:ring-white/10"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        VERDICT_CHIP[scan.verdict] ?? VERDICT_CHIP.supheli!
                      }`}
                    >
                      {STR.verdictLabels[scan.verdict] ?? scan.verdict}
                    </span>
                    <span className="text-[12px] text-muted">
                      {dateFormat.format(new Date(scan.createdAt))}
                    </span>
                  </span>
                  <span
                    lang={htmlLang(scan.detectedLanguage)}
                    className="mt-1.5 block truncate text-[14px] text-muted"
                  >
                    {scan.preview}
                  </span>
                  {scan.unmatchedCount > 0 ? (
                    <span className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
                      <StatusIcon status="bilinmiyor" className="h-4 w-4" />
                      {STR.historyUnmatched(scan.unmatchedCount)}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-[12px] leading-relaxed text-muted">
        {STR.historyStoredNote}
      </p>
    </div>
  );
}
