"use client";

import { useEffect } from "react";
import Link from "next/link";
import { WarningIcon } from "@/components/icons";
import { STR } from "@/lib/ui/strings";

/*
 * Beklenmeyen arayüz hatası ekranı (bkz. CLAUDE.md, Bölüm 12).
 * Kullanıcıya teknik kod gösterilmez; hata yalnızca tarayıcı günlüğüne
 * yazılır.
 */
export default function ErrorScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("arayüz hatası:", error);
  }, [error]);

  return (
    <main className="screen-h flex flex-col items-center justify-center gap-5 px-6 text-center">
      <WarningIcon className="h-10 w-10 text-amber-600" />
      <h1 className="text-xl font-semibold">{STR.errorTitle}</h1>
      <p className="max-w-[300px] text-[15px] leading-relaxed text-muted">
        {STR.errorBody}
      </p>
      <button
        type="button"
        onClick={reset}
        className="flex min-h-[52px] w-full max-w-[280px] items-center justify-center rounded-2xl bg-emerald-700 px-5 text-[15px] font-semibold text-white dark:bg-emerald-600"
      >
        {STR.retry}
      </button>
      <Link
        href="/"
        className="flex min-h-[48px] items-center justify-center px-5 text-[15px] font-medium text-muted"
      >
        {STR.goHome}
      </Link>
    </main>
  );
}
