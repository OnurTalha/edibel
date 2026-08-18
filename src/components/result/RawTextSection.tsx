"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { SpinnerIcon } from "@/components/icons";
import { Section } from "@/components/result/Section";
import type { AnalysisResult } from "@/lib/schemas";
import { errorMessage, isAbortError, requestAnalysis } from "@/lib/ui/api";
import { getDeviceId } from "@/lib/ui/device";
import { htmlLang } from "@/lib/ui/lang";
import { STR } from "@/lib/ui/strings";

/*
 * Detay alanının altıncı bölümü: okunan ham metin
 * (bkz. CLAUDE.md, Bölüm 9, madde 6).
 * Kullanıcı okumanın doğru çalışıp çalışmadığını görür; yanlış okuma varsa
 * metni düzenleyip yeniden analiz başlatabilir. Düzeltilmiş metin de aynı
 * hattan geçer: eşleştirme yine yalnızca özgün metin üzerinden yapılır.
 *
 * Form alanı yazı tipi boyutu 16 pikseldir; daha küçük değerlerde iOS Safari
 * sayfayı otomatik yakınlaştırır (Bölüm 8).
 */
export function RawTextSection({ result }: { result: AnalysisResult }) {
  const router = useRouter();
  const [text, setText] = useState(result.translation.rawBlock);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lang = htmlLang(result.detectedLanguage);

  useEffect(() => () => abortRef.current?.abort(), []);

  const reanalysis = useMutation({
    mutationFn: async (rawText: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      return requestAnalysis(
        { mode: "text", rawText, deviceId: getDeviceId() },
        controller.signal,
      );
    },
    onSuccess: (next) => router.push(`/sonuc/${next.scanId}`),
    onError: (err) => {
      if (!isAbortError(err)) setError(errorMessage(err));
    },
  });

  const changed = text.trim() !== result.translation.rawBlock.trim();

  return (
    <Section title={STR.sectionRawText}>
      <p className="text-[13px] text-muted">{STR.rawTextHint}</p>
      <label className="sr-only" htmlFor="raw-text">
        {STR.rawTextLabel}
      </label>
      <textarea
        id="raw-text"
        lang={lang}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setError(null);
        }}
        rows={6}
        className="w-full resize-y rounded-2xl bg-surface p-4 text-base leading-relaxed ring-1 ring-black/5 outline-none focus:ring-2 focus:ring-emerald-600 dark:ring-white/10"
      />

      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-[14px] text-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={reanalysis.isPending || !changed || text.trim().length < 2}
        onClick={() => {
          if (text.trim().length < 2) {
            setError(STR.rawTextEmpty);
            return;
          }
          reanalysis.mutate(text.trim());
        }}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-[15px] font-semibold text-white disabled:opacity-40 dark:bg-emerald-600"
      >
        {reanalysis.isPending ? (
          <>
            <SpinnerIcon className="h-5 w-5 animate-spin" />
            {STR.reanalyzing}
          </>
        ) : (
          STR.reanalyze
        )}
      </button>
    </Section>
  );
}
