"use client";

import { useState } from "react";
import Link from "next/link";
import { PrinciplesSection } from "@/components/result/PrinciplesSection";
import { Section } from "@/components/result/Section";
import { StatusIcon, statusColor } from "@/components/result/status";
import {
  CameraIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  QuestionIcon,
  XCircleIcon,
} from "@/components/icons";
import { STR } from "@/lib/ui/strings";
import { MADHHAB_ORDER } from "@/lib/ui/madhhab";
import { useSettings } from "@/lib/ui/store";
import type { FiqhPrincipleView, MenuDish, MenuResult } from "@/lib/schemas";

/*
 * Menü sonucu ekranı: tek bir karar kartı yerine yemek listesi.
 *
 * Karar sözlüğü etiket taramasından ayrıdır ve "helal" içermez; sebebi
 * src/lib/verdict/menu.ts başındaki açıklamadadır. Ekran bu sınırı
 * kullanıcıdan gizlemez, menuInferenceNote metniyle açıkça yazar.
 */

const DISH_STYLE: Record<
  string,
  { ring: string; text: string; bg: string }
> = {
  kacinilmali: {
    ring: "ring-red-200 dark:ring-red-900",
    text: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30",
  },
  sorulmali: {
    ring: "ring-amber-200 dark:ring-amber-900",
    text: "text-amber-700 dark:text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/30",
  },
  muhtemelen_uygun: {
    ring: "ring-emerald-200 dark:ring-emerald-900",
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
  },
};

/* Renk tek başına bilgi taşımaz: her karara ayrı simge ve metin eşlik eder */
function DishIcon({ verdict, className }: { verdict: string; className: string }) {
  if (verdict === "kacinilmali") return <XCircleIcon className={className} />;
  if (verdict === "muhtemelen_uygun")
    return <CheckCircleIcon className={className} />;
  return <QuestionIcon className={className} />;
}

type Ruling = MenuDish["ingredients"][number]["rulings"][number];

/*
 * Hüküm listesi. Dört mezhep aynı hükümde ve aynı gerekçedeyse (domuz eti
 * gibi ihtilafsız maddeler) gerekçe dört kez tekrar edilmez, tek satırda
 * "Dört mezhep" olarak yazılır. Kaynak referansı her durumda görünür
 * (bkz. CLAUDE.md, Bölüm 15: kaynağı olmayan hüküm gösterilmez).
 */
function RulingList({ rulings }: { rulings: Ruling[] }) {
  if (rulings.length === 0) return null;

  const ordered = MADHHAB_ORDER.map((m) =>
    rulings.find((r) => r.madhhab === m),
  ).filter((r): r is Ruling => r !== undefined);
  if (ordered.length === 0) return null;

  const first = ordered[0]!;
  const uniform =
    ordered.length === MADHHAB_ORDER.length &&
    ordered.every(
      (r) => r.status === first.status && r.reasoningTr === first.reasoningTr,
    );

  return (
    <ul className="mt-1.5 space-y-1">
      {(uniform ? [null] : ordered).map((entry, i) => {
        const ruling = entry ?? first;
        return (
          <li
            key={entry?.madhhab ?? `tumu-${i}`}
            className="text-[12px] leading-snug text-muted"
          >
            <span className="font-medium">
              {entry ? STR.madhhabNames[entry.madhhab] : STR.allMadhhabs}
            </span>
            :{" "}
            <span className={statusColor(ruling.status)}>
              {STR.statusLabels[ruling.status] ?? ruling.status}
            </span>{" "}
            — {ruling.reasoningTr}{" "}
            <span className="opacity-70">({ruling.sourceRef})</span>
          </li>
        );
      })}
    </ul>
  );
}

function DishCard({ dish }: { dish: MenuDish }) {
  const [open, setOpen] = useState(false);
  const style = DISH_STYLE[dish.verdict] ?? DISH_STYLE.sorulmali!;
  const madhhab = useSettings((state) => state.madhhab);

  return (
    <li className={`rounded-2xl ring-1 ${style.ring} ${style.bg}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[56px] w-full items-start gap-3 px-4 py-3.5 text-left"
      >
        <DishIcon
          verdict={dish.verdict}
          className={`mt-0.5 h-5 w-5 shrink-0 ${style.text}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold leading-snug">
            {dish.rawName}
          </span>
          <span className="mt-0.5 block text-[14px] leading-snug text-muted">
            {dish.nameTr}
          </span>
          <span className={`mt-1.5 block text-[13px] font-medium ${style.text}`}>
            {STR.menuVerdictShort[dish.verdict] ?? dish.verdict}
          </span>
          {/*
           * Sorulacak maddeler şiddete göre sıralı gelir ve her biri kendi
           * durum rengini/simgesini taşır; böylece "muhtemelen domuz var"
           * ile "sostaki mirin" aynı görünmez.
           */}
          {dish.concerns.length > 0 ? (
            <span className="mt-1.5 block text-[13px] leading-snug">
              <span className="text-muted">{STR.menuConcernsLabel}: </span>
              {dish.concerns.map((concern, i) => (
                <span key={`${concern.nameTr}-${i}`}>
                  {i > 0 ? <span className="text-muted"> · </span> : null}
                  <span className={statusColor(concern.status)}>
                    {concern.nameTr}
                  </span>
                  {concern.certainty === "olasi" ? (
                    <span className="text-muted">?</span>
                  ) : null}
                </span>
              ))}
            </span>
          ) : null}
          {/*
           * Kullanıcı ayarlarda mezhebini seçtiyse önce onun hükmü görünür
           * (bkz. CLAUDE.md, Bölüm 9: Ekran 1 ayarlar).
           */}
          {madhhab ? (
            <span className="mt-1 block text-[13px] text-muted">
              {STR.madhhabNames[madhhab]}:{" "}
              <span className={statusColor(dish.madhhabVerdicts[madhhab])}>
                {STR.statusLabels[dish.madhhabVerdicts[madhhab]]}
              </span>
            </span>
          ) : null}
        </span>
        <ChevronDownIcon
          className={`mt-1 h-5 w-5 shrink-0 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-black/5 px-4 py-4 dark:border-white/10">
          <div className="space-y-2">
            <h3 className="text-[13px] font-semibold text-muted">
              {STR.menuIngredientsLabel}
            </h3>
            {dish.ingredients.length === 0 ? (
              <p className="text-[14px] text-muted">{STR.menuEmpty}</p>
            ) : (
              <ul className="space-y-2.5">
                {dish.ingredients.map((ing, i) => (
                  <li key={`${ing.rawText}-${i}`} className="flex gap-2">
                    <StatusIcon status={ing.status} className="mt-0.5 h-4 w-4" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] leading-snug">
                        {ing.rawText}
                        <span className="text-muted"> — {ing.translationTr}</span>
                      </p>
                      <p className="text-[12px] leading-snug text-muted">
                        {ing.certainty === "kesin"
                          ? STR.menuCertaintyKesin
                          : STR.menuCertaintyOlasi}
                        {ing.translationSource === "model"
                          ? ` · ${STR.modelTranslationMark}`
                          : ""}
                      </p>
                      <RulingList rulings={ing.rulings} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function MenuResultBody({
  result,
  principles,
}: {
  result: MenuResult;
  principles: FiqhPrincipleView[];
}) {
  return (
    <main className="space-y-8 px-5 pb-14 pt-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {STR.menuTitle}
        </h1>
        <p className="text-[14px] text-muted">
          {STR.menuDishCount(result.dishes.length)}
        </p>
        <p className="text-[13px] text-muted">
          {STR.menuSummary(
            result.summary.kacinilmali,
            result.summary.sorulmali,
            result.summary.muhtemelenUygun,
          )}
        </p>
      </header>

      {/*
       * Çıkarım uyarısı listenin ÜSTÜNDEDİR: kullanıcı yemeklere bakmadan
       * önce bu sonuçların okumaya değil çıkarıma dayandığını bilmelidir.
       */}
      <div className="space-y-2 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-900">
        <p className="text-[13px] leading-relaxed text-amber-900 dark:text-amber-200">
          {STR.menuInferenceNote}
        </p>
        <p className="text-[12px] leading-relaxed text-amber-800/90 dark:text-amber-200/80">
          {STR.menuUncertainMark}
        </p>
      </div>

      {result.dishes.length === 0 ? (
        <p className="rounded-2xl bg-surface p-4 text-[14px] text-muted ring-1 ring-black/5 dark:ring-white/10">
          {STR.menuEmpty}
        </p>
      ) : (
        <ul className="space-y-3">
          {result.dishes.map((dish, i) => (
            <DishCard key={`${dish.rawName}-${i}`} dish={dish} />
          ))}
        </ul>
      )}

      <p className="text-[13px] leading-relaxed text-muted">
        {STR.menuKitchenNote}
      </p>

      <PrinciplesSection principles={principles} />

      {/* Okunan ham metin: kullanıcı okumanın doğruluğunu görebilmelidir */}
      <Section title={STR.menuRawTextTitle}>
        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-2xl bg-surface p-4 text-[13px] leading-relaxed ring-1 ring-black/5 dark:ring-white/10">
          {result.rawBlock}
        </pre>
      </Section>

      {/* Uyarı metni kaldırılamaz ve küçültülemez (bkz. CLAUDE.md, Bölüm 15) */}
      <p className="rounded-2xl bg-surface p-4 text-[13px] leading-relaxed text-muted ring-1 ring-black/5 dark:ring-white/10">
        {STR.disclaimer}
      </p>

      <Link
        href="/menu"
        className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-2xl bg-emerald-700 px-5 text-[16px] font-semibold text-white dark:bg-emerald-600"
      >
        <CameraIcon className="h-5 w-5" />
        {STR.scanMenu}
      </Link>
    </main>
  );
}
