import Link from "next/link";
import { CameraIcon } from "@/components/icons";
import { STR } from "@/lib/ui/strings";

/*
 * Ekran 1: Açılış (bkz. CLAUDE.md, Bölüm 9).
 * Ana etkileşim öğesi ekranın alt üçte birindedir ve tek elle
 * kullanılabilecek büyüklüktedir (Bölüm 8).
 */
export default function HomePage() {
  return (
    <main className="screen-h flex flex-col px-6 pb-10 pt-14">
      <header className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight">
          {STR.appName}
        </h1>
        <p className="mt-4 text-balance text-[15px] leading-relaxed text-muted">
          {STR.appTagline}
        </p>
      </header>

      <div className="flex-1" />

      <div className="flex flex-col items-center gap-5">
        <Link
          href="/tara"
          className="flex w-full max-w-[320px] flex-col items-center justify-center gap-3 rounded-3xl bg-emerald-700 px-6 py-9 text-white shadow-lg shadow-emerald-900/20 transition-transform active:scale-[0.98] dark:bg-emerald-600"
        >
          <CameraIcon className="h-12 w-12" />
          <span className="text-xl font-semibold">{STR.scan}</span>
        </Link>
        <p className="text-center text-sm text-muted">{STR.scanDescription}</p>
        <p className="text-center text-xs text-muted">{STR.appHint}</p>
      </div>

      <p className="mt-10 text-center text-[11px] leading-relaxed text-muted">
        {STR.disclaimer}
      </p>
    </main>
  );
}
