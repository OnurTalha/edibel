import {
  CheckCircleIcon,
  QuestionIcon,
  WarningIcon,
  XCircleIcon,
} from "@/components/icons";
import { STR } from "@/lib/ui/strings";

/*
 * Durum göstergesi. Renk tek başına bilgi taşımaz: her durumun ayrı simge
 * biçimi ve ekran okuyucular için metin karşılığı vardır
 * (bkz. CLAUDE.md, Bölüm 9).
 */

const STATUS_TEXT_COLOR: Record<string, string> = {
  helal: "text-emerald-700 dark:text-emerald-400",
  haram: "text-red-700 dark:text-red-400",
  supheli: "text-amber-700 dark:text-amber-400",
  mekruh: "text-amber-700 dark:text-amber-400",
  bilinmiyor: "text-slate-600 dark:text-slate-400",
};

export function statusColor(status: string): string {
  return STATUS_TEXT_COLOR[status] ?? "text-slate-600 dark:text-slate-400";
}

export function statusLabel(status: string): string {
  return STR.statusLabels[status] ?? status;
}

export function StatusIcon({
  status,
  className = "h-[18px] w-[18px]",
}: {
  status: string;
  className?: string;
}) {
  const iconClass = `${className} shrink-0 ${statusColor(status)}`;
  return (
    <span className="inline-flex items-center">
      {status === "helal" ? (
        <CheckCircleIcon className={iconClass} />
      ) : status === "haram" ? (
        <XCircleIcon className={iconClass} />
      ) : status === "bilinmiyor" ? (
        <QuestionIcon className={iconClass} />
      ) : (
        <WarningIcon className={iconClass} />
      )}
      <span className="sr-only">{statusLabel(status)}</span>
    </span>
  );
}
