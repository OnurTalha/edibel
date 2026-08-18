"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SpinnerIcon, WarningIcon } from "@/components/icons";
import { errorMessage, fetchUnmatchedTerms } from "@/lib/ui/api";
import { STR } from "@/lib/ui/strings";

/*
 * Eşleşmeyen terimler yönetim sayfası (bkz. CLAUDE.md, Bölüm 6 ve Faz 8).
 * Canlı sistemde içerik veritabanını büyütmenin yolu budur: en sık
 * karşılaşılan terimler görülür ve içerik dosyalarına eklenir.
 *
 * Anahtar sunucuda doğrulanır; burada yalnızca oturum boyunca saklanır ve
 * her istekte başlıkla gönderilir.
 */

const TOKEN_KEY = "edibel-admin-token";

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function AdminView() {
  const [token, setToken] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(window.sessionStorage.getItem(TOKEN_KEY));
    setReady(true);
  }, []);

  const query = useQuery({
    queryKey: ["unmatched-terms", token],
    queryFn: () => fetchUnmatchedTerms(token!),
    enabled: token !== null,
    retry: false,
  });

  const terms = useMemo(() => {
    if (!query.data) return [];
    const needle = filter.trim().toLocaleLowerCase("tr");
    if (needle.length === 0) return query.data;
    return query.data.filter(
      (term) =>
        term.term.toLocaleLowerCase("tr").includes(needle) ||
        (term.modelTranslationTr ?? "").toLocaleLowerCase("tr").includes(needle),
    );
  }, [query.data, filter]);

  if (!ready) return <div className="px-5 py-6" />;

  if (token === null || query.isError) {
    return (
      <div className="space-y-4 px-5 pb-14 pt-4">
        {query.isError ? (
          <p className="flex items-start gap-2 rounded-2xl bg-surface p-4 text-[14px] leading-relaxed ring-1 ring-black/5 dark:ring-white/10">
            <WarningIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            {errorMessage(query.error)}
          </p>
        ) : null}

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const value = draft.trim();
            if (value.length === 0) return;
            window.sessionStorage.setItem(TOKEN_KEY, value);
            setToken(value);
            setDraft("");
          }}
        >
          <label
            htmlFor="admin-token"
            className="block text-[14px] font-medium"
          >
            {STR.adminTokenLabel}
          </label>
          <input
            id="admin-token"
            type="password"
            autoComplete="current-password"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="w-full rounded-2xl bg-surface p-4 text-base ring-1 ring-black/5 outline-none focus:ring-2 focus:ring-emerald-600 dark:ring-white/10"
          />
          <button
            type="submit"
            className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-emerald-700 px-5 text-[15px] font-semibold text-white dark:bg-emerald-600"
          >
            {STR.adminTokenSubmit}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-5 pb-14 pt-4">
      <p className="text-[13px] leading-relaxed text-muted">{STR.adminIntro}</p>

      <div className="flex gap-2">
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={STR.adminFilter}
          aria-label={STR.adminFilter}
          className="min-h-[48px] flex-1 rounded-2xl bg-surface px-4 text-base ring-1 ring-black/5 outline-none focus:ring-2 focus:ring-emerald-600 dark:ring-white/10"
        />
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="min-h-[48px] rounded-2xl bg-surface px-4 text-sm font-medium ring-1 ring-black/5 dark:ring-white/10"
        >
          {STR.adminRefresh}
        </button>
      </div>

      {query.isPending ? (
        <div className="flex items-center gap-2 py-10 text-muted">
          <SpinnerIcon className="h-5 w-5 animate-spin" />
          <span className="text-[15px]">{STR.loading}</span>
        </div>
      ) : terms.length === 0 ? (
        <p className="rounded-2xl bg-surface p-4 text-[14px] text-muted ring-1 ring-black/5 dark:ring-white/10">
          {STR.adminEmpty}
        </p>
      ) : (
        <>
          <p className="text-[12px] text-muted">{STR.adminTotal(terms.length)}</p>
          <div className="overflow-x-auto rounded-2xl bg-surface ring-1 ring-black/5 dark:ring-white/10">
            <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-black/5 dark:border-white/10">
                  <th className="px-3 py-2.5 font-semibold">
                    {STR.adminColumnTerm}
                  </th>
                  <th className="px-3 py-2.5 font-semibold">
                    {STR.adminColumnLanguage}
                  </th>
                  <th className="px-3 py-2.5 font-semibold">
                    {STR.adminColumnTranslation}
                  </th>
                  <th className="px-3 py-2.5 font-semibold">
                    {STR.adminColumnCount}
                  </th>
                  <th className="px-3 py-2.5 font-semibold">
                    {STR.adminColumnLastSeen}
                  </th>
                </tr>
              </thead>
              <tbody>
                {terms.map((term) => (
                  <tr
                    key={term.id}
                    className="border-b border-black/5 last:border-0 dark:border-white/10"
                  >
                    <td className="px-3 py-2.5 align-top font-medium">
                      {term.term}
                    </td>
                    <td className="px-3 py-2.5 align-top text-muted">
                      {STR.languageNames[term.language] ?? term.language}
                    </td>
                    <td className="px-3 py-2.5 align-top text-muted">
                      {term.modelTranslationTr ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 align-top tabular-nums">
                      {term.occurrenceCount}
                    </td>
                    <td className="px-3 py-2.5 align-top text-muted">
                      {dateFormat.format(new Date(term.lastSeenAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => {
          window.sessionStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }}
        className="min-h-[48px] w-full rounded-2xl border border-black/10 px-4 text-[15px] font-medium text-muted dark:border-white/15"
      >
        {STR.adminLogout}
      </button>
    </div>
  );
}
