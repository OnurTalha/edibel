"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AllergenSection } from "@/components/result/AllergenSection";
import { MadhhabTable } from "@/components/result/MadhhabTable";
import { PrinciplesSection } from "@/components/result/PrinciplesSection";
import { ProblematicSection } from "@/components/result/ProblematicSection";
import { RawTextSection } from "@/components/result/RawTextSection";
import { TranslationSection } from "@/components/result/TranslationSection";
import { VerdictCard } from "@/components/result/VerdictCard";
import { MenuResultBody } from "@/components/result/MenuResultBody";
import { CameraIcon, SpinnerIcon, WarningIcon } from "@/components/icons";
import { errorMessage, fetchScan } from "@/lib/ui/api";
import { STR } from "@/lib/ui/strings";

/*
 * Ekran 4: sonuç (bkz. CLAUDE.md, Bölüm 9).
 * Üst bölüm ekranı kaplayan karar kartıdır; alt bölüm kaydırınca açılan
 * detay alanıdır ve bölümler şu sırayla yer alır: içindekiler tercümesi,
 * alerjen bildirimi, sorunlu malzemeler, mezhep karşılaştırma tablosu,
 * gerekçeler, okunan ham metin, uyarı metni.
 *
 * Menü taramasında tek bir karar yerine yemek listesi gösterilir; bu
 * görünüm MenuResultBody bileşenindedir.
 */
export function ResultView({ scanId }: { scanId: string }) {
  const query = useQuery({
    queryKey: ["scan", scanId],
    queryFn: () => fetchScan(scanId),
  });

  if (query.isPending) {
    return (
      <main className="screen-h flex flex-col items-center justify-center gap-3 px-6">
        <SpinnerIcon className="h-7 w-7 animate-spin text-muted" />
        <p className="text-[15px] text-muted">{STR.loading}</p>
      </main>
    );
  }

  if (query.isError) {
    return (
      <main className="screen-h flex flex-col items-center justify-center gap-5 px-6 text-center">
        <WarningIcon className="h-9 w-9 text-amber-600" />
        <p className="text-[15px] leading-relaxed">
          {errorMessage(query.error)}
        </p>
        <Link
          href="/"
          className="flex min-h-[52px] w-full max-w-[280px] items-center justify-center rounded-2xl bg-emerald-700 px-5 text-[15px] font-semibold text-white dark:bg-emerald-600"
        >
          {STR.goHome}
        </Link>
      </main>
    );
  }

  /* Menü taraması ayrı görünüme gider (karar sözlüğü ve düzeni farklıdır) */
  if (query.data.scanType === "menu") {
    return (
      <MenuResultBody
        result={query.data.result}
        principles={query.data.principles}
      />
    );
  }

  const { result, principles } = query.data;

  return (
    <main>
      <VerdictCard result={result} />

      <div className="space-y-8 px-5 pb-14 pt-8">
        {result.unmatchedCount > 0 ? (
          <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-[14px] leading-relaxed text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900">
            <WarningIcon className="mt-0.5 h-5 w-5 shrink-0" />
            {STR.unmatchedNote(result.unmatchedCount)}
          </p>
        ) : null}

        <TranslationSection result={result} />
        <AllergenSection result={result} />
        <ProblematicSection result={result} />
        <MadhhabTable result={result} />
        <PrinciplesSection principles={principles} />
        <RawTextSection result={result} />

        {/* Uyarı metni kaldırılamaz ve küçültülemez (bkz. CLAUDE.md, Bölüm 15) */}
        <p className="rounded-2xl bg-surface p-4 text-[13px] leading-relaxed text-muted ring-1 ring-black/5 dark:ring-white/10">
          {STR.disclaimer}
        </p>

        <Link
          href="/tara"
          className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-2xl bg-emerald-700 px-5 text-[16px] font-semibold text-white dark:bg-emerald-600"
        >
          <CameraIcon className="h-5 w-5" />
          {STR.newScan}
        </Link>
      </div>
    </main>
  );
}
