/*
 * İçerik veritabanı yükleme betiği.
 *
 * data/ingredients altındaki JSON dosyalarını okur, zod ile doğrular ve
 * PostgreSQL'e yükler. Betik idempotenttir: tekrar çalıştırıldığında
 * malzemeleri deterministik kimlikleriyle günceller, takma ad ve hüküm
 * kayıtlarını yeniden kurar; scans, unmatched_terms tablolarına ve mevcut
 * gömme vektörlerine (embedding) dokunmaz.
 *
 * Çalıştırma: npm run db:seed
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { drizzle } from "drizzle-orm/postgres-js";
import { inArray, sql as dsql } from "drizzle-orm";
import postgres from "postgres";
import {
  fiqhPrinciples,
  ingredientAliases,
  ingredients,
  madhhabRulings,
  sourceHints,
} from "../src/db/schema";

process.loadEnvFile(path.join(process.cwd(), ".env"));

const DATA_DIR = path.join(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
  "data",
  "ingredients",
);

/* ---------- Şemalar ---------- */

const statusSchema = z.enum(["helal", "haram", "supheli"]);
const rulingStatusSchema = z.enum(["helal", "haram", "mekruh", "supheli"]);
const madhhabSchema = z.enum(["hanefi", "safii", "maliki", "hanbeli"]);
const categorySchema = z.enum([
  "emulgator", "renklendirici", "jelatin", "enzim", "alkol_turevi",
  "aroma", "tatlandirici", "koruyucu", "yag", "protein", "diger",
]);
const sourceTypeSchema = z.enum([
  "bitkisel", "hayvansal", "mikrobiyal", "sentetik", "belirsiz",
]);
const resolvedSourceSchema = z.enum([
  "domuz", "sigir", "tavuk", "balik", "soya", "misir", "palm",
  "bitkisel", "mikrobiyal", "sentetik", "bilinmiyor",
]);
/* Malzeme hüküm eşlemesinde "genel" anahtarı resolvedSource=null demektir */
const rulingSourceKeySchema = z.enum([
  "genel", "domuz", "sigir", "tavuk", "balik", "soya", "misir", "palm",
  "bitkisel", "mikrobiyal", "sentetik", "bilinmiyor",
]);

const principleFileSchema = z.array(
  z.object({
    key: z.string().min(1),
    titleTr: z.string().min(1),
    explanationTr: z.string().min(1),
  }),
);

const rulingEntrySchema = z.object({
  status: rulingStatusSchema,
  principle: z.string().min(1),
  reason: z.string().min(10),
  /* Kaynağı olmayan hüküm veritabanına eklenmez (bkz. CLAUDE.md, Bölüm 7) */
  source: z.string().min(5),
});

const rulingSetSchema = z
  .partialRecord(z.union([madhhabSchema, z.literal("*")]), rulingEntrySchema)
  .refine(
    (set) =>
      "*" in set ||
      madhhabSchema.options.every((m) => m in set),
    { message: "Hüküm kümesi ya '*' ya da dört mezhebin tamamını içermelidir" },
  );

const coreEntrySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  nameTr: z.string().min(1),
  nameEn: z.string().min(1),
  insCode: z.string().optional(),
  eCode: z.string().optional(),
  cnsCode: z.string().optional(),
  category: categorySchema,
  sourceType: sourceTypeSchema,
  defaultStatus: statusSchema,
  descTr: z.string().min(10),
  rulings: z.union([
    z.string().min(1),
    z.partialRecord(rulingSourceKeySchema, z.string().min(1)),
  ]),
});

const aliasEntrySchema = z.union([
  z.string().min(1),
  z.object({ alias: z.string().min(1), translationTr: z.string().min(1) }),
]);
const aliasFileSchema = z.record(z.string(), z.array(aliasEntrySchema).min(1));

const hintFileSchema = z.array(
  z.object({
    pattern: z.string().min(1),
    language: z.enum(["ja", "ko", "zh_hans", "zh_hant"]),
    resolvedSource: resolvedSourceSchema,
    translationTr: z.string().min(1),
  }),
);

/* ---------- Yardımcılar ---------- */

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(path.join(DATA_DIR, file), "utf8"));
}

/* RFC 4122 UUID v5 (SHA-1); slug'dan deterministik kimlik üretir */
const UUID_NAMESPACE = "edibel.talhaonur.com/ingredients";
function uuidV5(name: string): string {
  const hash = createHash("sha1")
    .update(UUID_NAMESPACE)
    .update(name)
    .digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/* Takma adın yazı sistemini karakter aralıklarından tespit eder */
function detectScript(
  alias: string,
  language: string,
): "katakana" | "hiragana" | "kanji" | "hangul" | "han" | "latin" | null {
  const hasHangul = /[가-힯ᄀ-ᇿ]/.test(alias);
  const hasKatakana = /[゠-ヿ]/.test(alias);
  const hasHiragana = /[぀-ゟ]/.test(alias);
  const hasHan = /[一-鿿㐀-䶿]/.test(alias);
  if (hasHangul) return "hangul";
  if (hasKatakana && !hasHiragana && !hasHan) return "katakana";
  if (hasHiragana && !hasKatakana && !hasHan) return "hiragana";
  if (hasKatakana || hasHiragana) return "kanji"; // kana + kanji karışık yazım
  if (hasHan) return language === "ja" ? "kanji" : "han";
  if (/[A-Za-z]/.test(alias)) return "latin";
  return null;
}

/* ---------- Ana akış ---------- */

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL tanımlı değil.");
  const client = postgres(url, { max: 4 });
  const db = drizzle(client);

  /* 1. Dosyaları oku ve doğrula */
  const principles = principleFileSchema.parse(readJson("fiqh-principles.json"));

  const rawSets = readJson("ruling-sets.json") as Record<string, unknown>;
  delete rawSets["_aciklama"];
  const rulingSets = new Map<string, z.infer<typeof rulingSetSchema>>();
  for (const [name, val] of Object.entries(rawSets)) {
    rulingSets.set(name, rulingSetSchema.parse(val));
  }

  const coreFiles = readdirSync(DATA_DIR).filter((f) => f.startsWith("core."));
  const entries: z.infer<typeof coreEntrySchema>[] = [];
  for (const f of coreFiles) {
    entries.push(...z.array(coreEntrySchema).parse(readJson(f)));
  }

  const aliasFiles: Record<string, z.infer<typeof aliasFileSchema>> = {};
  for (const lang of ["ja", "ko", "zh_hans", "zh_hant", "en", "tr"]) {
    try {
      aliasFiles[lang] = aliasFileSchema.parse(readJson(`aliases.${lang}.json`));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw e;
    }
  }

  const hints = hintFileSchema.parse(readJson("source-hints.json"));

  /* 2. Referans bütünlüğü denetimleri */
  const errors: string[] = [];
  const slugSet = new Set<string>();
  const principleKeys = new Set(principles.map((p) => p.key));

  for (const e of entries) {
    if (slugSet.has(e.slug)) errors.push(`Yinelenen slug: ${e.slug}`);
    slugSet.add(e.slug);
    const refs =
      typeof e.rulings === "string" ? [e.rulings] : Object.values(e.rulings);
    if (typeof e.rulings !== "string" && !("genel" in e.rulings)) {
      errors.push(`${e.slug}: kaynağa göre hüküm eşlemesinde 'genel' anahtarı zorunludur`);
    }
    for (const ref of refs) {
      if (!rulingSets.has(ref)) errors.push(`${e.slug}: tanımsız hüküm kümesi '${ref}'`);
    }
  }
  for (const set of rulingSets.values()) {
    for (const entry of Object.values(set)) {
      if (!principleKeys.has(entry.principle)) {
        errors.push(`Tanımsız fıkhi ilke anahtarı: ${entry.principle}`);
      }
    }
  }
  for (const [lang, file] of Object.entries(aliasFiles)) {
    for (const slug of Object.keys(file)) {
      if (!slugSet.has(slug)) errors.push(`aliases.${lang}: tanımsız slug '${slug}'`);
    }
  }
  if (errors.length > 0) {
    console.error("İçerik doğrulama hataları:");
    for (const err of errors) console.error("  - " + err);
    process.exit(1);
  }

  /* Kapsam uyarıları: Doğu Asya dillerinde takma adı olmayan malzemeler */
  for (const e of entries) {
    const covered = ["ja", "ko", "zh_hans"].filter(
      (l) => aliasFiles[l] && e.slug in aliasFiles[l]!,
    );
    if (covered.length === 0) {
      console.warn(`Uyarı: '${e.slug}' için hiçbir Doğu Asya dilinde takma ad yok`);
    }
  }

  /* 3. Fıkhi ilkeler */
  for (const p of principles) {
    await db
      .insert(fiqhPrinciples)
      .values(p)
      .onConflictDoUpdate({
        target: fiqhPrinciples.key,
        set: { titleTr: p.titleTr, explanationTr: p.explanationTr },
      });
  }

  /* 4. Malzemeler (embedding korunur; yalnızca içerik alanları güncellenir) */
  const idBySlug = new Map<string, string>();
  for (const e of entries) {
    const id = uuidV5(e.slug);
    idBySlug.set(e.slug, id);
    const row = {
      id,
      canonicalNameTr: e.nameTr,
      canonicalNameEn: e.nameEn,
      insCode: e.insCode ?? null,
      eCode: e.eCode ?? null,
      cnsCode: e.cnsCode ?? null,
      category: e.category,
      sourceType: e.sourceType,
      defaultStatus: e.defaultStatus,
      descriptionTr: e.descTr,
    };
    await db
      .insert(ingredients)
      .values(row)
      .onConflictDoUpdate({ target: ingredients.id, set: row });
  }

  const allIds = [...idBySlug.values()];

  /* 5. Takma adlar: bu betiğin yönettiği kayıtlar silinip yeniden kurulur */
  await db
    .delete(ingredientAliases)
    .where(inArray(ingredientAliases.ingredientId, allIds));

  const aliasRows: (typeof ingredientAliases.$inferInsert)[] = [];
  for (const [lang, file] of Object.entries(aliasFiles)) {
    for (const [slug, list] of Object.entries(file)) {
      for (const item of list) {
        const alias = typeof item === "string" ? item : item.alias;
        const translationTr =
          typeof item === "string" ? null : item.translationTr;
        aliasRows.push({
          ingredientId: idBySlug.get(slug)!,
          alias,
          language: lang as typeof ingredientAliases.$inferInsert.language,
          script: detectScript(alias, lang),
          translationTr,
        });
      }
    }
  }
  for (let i = 0; i < aliasRows.length; i += 500) {
    await db.insert(ingredientAliases).values(aliasRows.slice(i, i + 500));
  }

  /* 6. Mezhep hükümleri: silinip hüküm kümelerinden yeniden açılır */
  await db
    .delete(madhhabRulings)
    .where(inArray(madhhabRulings.ingredientId, allIds));

  const rulingRows: (typeof madhhabRulings.$inferInsert)[] = [];
  for (const e of entries) {
    const mapping =
      typeof e.rulings === "string" ? { genel: e.rulings } : e.rulings;
    for (const [sourceKey, setName] of Object.entries(mapping)) {
      const set = rulingSets.get(setName)!;
      const expand = (madhhab: z.infer<typeof madhhabSchema>) => {
        const entry = set["*"] ?? set[madhhab];
        if (!entry) return;
        rulingRows.push({
          ingredientId: idBySlug.get(e.slug)!,
          resolvedSource:
            sourceKey === "genel"
              ? null
              : (sourceKey as typeof madhhabRulings.$inferInsert.resolvedSource),
          madhhab,
          status: entry.status,
          principleKey: entry.principle,
          reasoningTr: entry.reason,
          sourceRef: entry.source,
        });
      };
      for (const m of madhhabSchema.options) expand(m);
    }
  }
  for (let i = 0; i < rulingRows.length; i += 500) {
    await db.insert(madhhabRulings).values(rulingRows.slice(i, i + 500));
  }

  /* 7. Kaynak ipuçları */
  for (const h of hints) {
    await db
      .insert(sourceHints)
      .values(h)
      .onConflictDoUpdate({
        target: [sourceHints.pattern, sourceHints.language],
        set: { resolvedSource: h.resolvedSource, translationTr: h.translationTr },
      });
  }

  /* 8. Özet */
  const [counts] = await db.execute(dsql`
    SELECT
      (SELECT count(*) FROM ingredients) AS ingredients,
      (SELECT count(*) FROM ingredient_aliases) AS aliases,
      (SELECT count(*) FROM madhhab_rulings) AS rulings,
      (SELECT count(*) FROM source_hints) AS hints,
      (SELECT count(*) FROM fiqh_principles) AS principles
  `);
  console.log("Yükleme tamamlandı:", counts);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
