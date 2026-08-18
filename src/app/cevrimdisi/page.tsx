import Link from "next/link";
import { WarningIcon } from "@/components/icons";
import { STR } from "@/lib/ui/strings";

/*
 * Çevrimdışı yedek sayfası. Hizmet çalışanı, ağ ve önbellek başarısız
 * olduğunda gezinme isteklerini buraya yönlendirir (bkz. public/sw.js).
 */
export const metadata = { title: `${STR.offlineTitle} — ${STR.appName}` };

export default function OfflinePage() {
  return (
    <main className="screen-h flex flex-col items-center justify-center gap-5 px-6 text-center">
      <WarningIcon className="h-10 w-10 text-amber-600" />
      <h1 className="text-xl font-semibold">{STR.offlineTitle}</h1>
      <p className="max-w-[300px] text-[15px] leading-relaxed text-muted">
        {STR.offlineBody}
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
