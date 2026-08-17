import type { ParsedEntry } from "./types";

/*
 * Malzeme listesinin girdilere bölünmesi ve parantez içi bilginin ayrılması
 * (bkz. CLAUDE.md, Bölüm 5.3).
 *
 * Bölme yalnızca parantez derinliği sıfırken yapılır. Parantez içeriği iki
 * türlü olabilir:
 *
 *  1. Kaynak bilgisi: 乳化剤(大豆由来) → sourceHint olarak saklanır.
 *     Gerçekten kaynak olup olmadığına (大豆由来 ↔ 国内製造) eşleştirme
 *     motoru source_hints tablosuyla karar verir.
 *  2. Alt liste: スープ(ポークエキス,豚脂,食塩) → alt malzemeler ayrı
 *     girdilere AÇILIR. Doğu Asya etiketlerinde haram maddeler sıklıkla bu
 *     alt listelerin içindedir; açılmazsa karardan kaçarlar.
 *
 * Ayrım ölçütü: içerikte üst düzey ayırıcı (virgül vb.) bulunması.
 */

const OPENERS = new Map([
  ["(", ")"],
  ["[", "]"],
  ["【", "】"],
  ["「", "」"],
  ["〈", "〉"],
]);
const CLOSERS = new Set(OPENERS.values());

/* Ayırıcılar: normalleştirilmiş virgül, Japonca orta nokta, satır sonu vb. */
const SEPARATORS = new Set([",", "・", "･", ";", "/", "\n"]);

export function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const ch of text) {
    if (OPENERS.has(ch)) depth++;
    else if (CLOSERS.has(ch)) depth = Math.max(0, depth - 1);

    if (depth === 0 && SEPARATORS.has(ch)) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);

  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

interface EntryParts {
  name: string;
  /* Üst düzey parantez gruplarının içerikleri, sırasıyla */
  groups: string[];
}

/* "スープ(A,B)(C)" → { name: "スープ", groups: ["A,B", "C"] } */
export function splitEntry(token: string): EntryParts {
  let name = "";
  let depth = 0;
  const groups: string[] = [];
  let current = "";

  for (const ch of token) {
    if (OPENERS.has(ch)) {
      depth++;
      if (depth === 1) continue;
    } else if (CLOSERS.has(ch)) {
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        if (current.trim().length > 0) groups.push(current.trim());
        current = "";
        continue;
      }
    }
    if (depth === 0) name += ch;
    else current += ch;
  }
  if (current.trim().length > 0) groups.push(current.trim());

  return { name: name.trim(), groups };
}

function hasTopLevelSeparator(text: string): boolean {
  let depth = 0;
  for (const ch of text) {
    if (OPENERS.has(ch)) depth++;
    else if (CLOSERS.has(ch)) depth = Math.max(0, depth - 1);
    else if (depth === 0 && SEPARATORS.has(ch)) return true;
  }
  return false;
}

function expandToken(token: string, out: ParsedEntry[], depth: number): void {
  /* Bozuk girdiye karşı özyineleme sınırı; etikette 2-3 seviyeden derin iç
     içe liste görülmez */
  if (depth > 4) return;

  const { name, groups } = splitEntry(token);
  const hints: string[] = [];

  for (const group of groups) {
    if (hasTopLevelSeparator(group)) {
      /* Alt liste: her alt malzeme kendi girdisi olur */
      for (const sub of splitTopLevel(group)) {
        expandToken(sub, out, depth + 1);
      }
    } else {
      hints.push(group);
    }
  }

  if (name.length > 0) {
    out.push({
      rawText: name,
      sourceHint: hints.length > 0 ? hints.join("; ") : null,
    });
  } else if (hints.length === 1 && depth < 4) {
    /* Ad olmadan tek paren grubu: "(還元水あめ)" gibi; içerik girdi sayılır */
    expandToken(hints[0]!, out, depth + 1);
  }
}

export function tokenizeIngredients(sectionText: string): ParsedEntry[] {
  const out: ParsedEntry[] = [];
  for (const token of splitTopLevel(sectionText)) {
    expandToken(token, out, 0);
  }
  return out.filter((e) => e.rawText.length > 0);
}
