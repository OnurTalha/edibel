import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";
import { STR } from "@/lib/ui/strings";

/* İkincil ekranların ortak başlığı: geri bağlantısı ve ekran adı */
export function PageHeader({
  title,
  href = "/",
}: {
  title: string;
  href?: string;
}) {
  return (
    <header className="flex items-center gap-3 px-4 pb-2 pt-4">
      <Link
        href={href}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/5 dark:bg-white/10"
      >
        <ArrowLeftIcon className="h-5 w-5" />
        <span className="sr-only">{STR.back}</span>
      </Link>
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
    </header>
  );
}
