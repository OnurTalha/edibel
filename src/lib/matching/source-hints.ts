import { getDb } from "@/db/client";
import { sourceHints } from "@/db/schema";
import type { DetectedLanguage } from "@/lib/parsing";
import type { ResolvedSource } from "./types";

/*
 * Parantez içi kaynak ifadelerinin çözümlenmesi (bkz. CLAUDE.md, Bölüm 5.3).
 *
 * Ayrıştırma katmanı parantez içeriğini yorumsuz taşır; hangi ifadelerin
 * kaynak bilgisi olduğuna BURADA, denetlenmiş source_hints tablosuyla karar
 * verilir. Tabloda karşılığı olmayan içerik (örnek: 国内製造 "yurt içi
 * üretim") kaynak sayılmaz ve yok sayılır.
 *
 * Tablo küçüktür (yüzün altında satır); süreç başına bir kez belleğe alınır.
 */

interface HintRow {
  pattern: string;
  language: string;
  resolvedSource: ResolvedSource;
  translationTr: string;
}

let cache: HintRow[] | null = null;

async function loadHints(): Promise<HintRow[]> {
  if (cache) return cache;
  const rows = await getDb()
    .select({
      pattern: sourceHints.pattern,
      language: sourceHints.language,
      resolvedSource: sourceHints.resolvedSource,
      translationTr: sourceHints.translationTr,
    })
    .from(sourceHints);
  cache = rows as HintRow[];
  return cache;
}

/* İçerik yükleme betiği sonrası tazeleme için */
export function clearSourceHintCache(): void {
  cache = null;
}

export interface ResolvedHint {
  resolvedSource: ResolvedSource;
  translationTr: string;
}

/*
 * İpucu metninde, tespit edilen dilin kalıplarından birini arar. Çince için
 * iki yazım kümesi birlikte taranır (etiket dili basitleştirilmiş tespit
 * edilse bile ipucu geleneksel yazılmış olabilir). En uzun kalıp kazanır
 * (豚肉由来, 豚由来'den önce gelmelidir).
 */
export async function resolveSourceHint(
  hintText: string,
  language: DetectedLanguage,
): Promise<ResolvedHint | null> {
  const hints = await loadHints();
  const languages: string[] =
    language === "zh_hans" || language === "zh_hant"
      ? ["zh_hans", "zh_hant"]
      : [language];

  let best: HintRow | null = null;
  for (const h of hints) {
    if (!languages.includes(h.language)) continue;
    if (!hintText.includes(h.pattern)) continue;
    if (!best || h.pattern.length > best.pattern.length) best = h;
  }
  return best
    ? { resolvedSource: best.resolvedSource, translationTr: best.translationTr }
    : null;
}
