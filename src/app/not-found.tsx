import Link from "next/link";
import { QuestionIcon } from "@/components/icons";
import { STR } from "@/lib/ui/strings";

/* Bulunamayan sayfa: kullanıcıya ne yapacağını söyler, teknik kod göstermez */
export default function NotFound() {
  return (
    <main className="screen-h flex flex-col items-center justify-center gap-5 px-6 text-center">
      <QuestionIcon className="h-10 w-10 text-muted" />
      <h1 className="text-xl font-semibold">{STR.notFoundTitle}</h1>
      <p className="max-w-[300px] text-[15px] leading-relaxed text-muted">
        {STR.notFoundBody}
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
