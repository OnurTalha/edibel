import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/*
 * Edibel içerik veritabanı şeması (bkz. CLAUDE.md, Bölüm 6).
 *
 * Dini hükümler yalnızca bu tablolardan gelir; yapay zeka katmanı hiçbir
 * koşulda hüküm üretmez. Bu tablolardaki içerik data/ingredients altındaki
 * JSON dosyalarından scripts/seed.ts ile yüklenir.
 */

export const categoryEnum = pgEnum("ingredient_category", [
  "emulgator",
  "renklendirici",
  "jelatin",
  "enzim",
  "alkol_turevi",
  "aroma",
  "tatlandirici",
  "koruyucu",
  "yag",
  "protein",
  "diger",
]);

export const sourceTypeEnum = pgEnum("ingredient_source_type", [
  "bitkisel",
  "hayvansal",
  "mikrobiyal",
  "sentetik",
  "belirsiz",
]);

export const statusEnum = pgEnum("halal_status", [
  "helal",
  "haram",
  "supheli",
]);

export const aliasLanguageEnum = pgEnum("alias_language", [
  "ja",
  "ko",
  "zh_hans",
  "zh_hant",
  "en",
  "tr",
]);

export const aliasScriptEnum = pgEnum("alias_script", [
  "katakana",
  "hiragana",
  "kanji",
  "hangul",
  "han",
  "latin",
]);

export const hintLanguageEnum = pgEnum("hint_language", [
  "ja",
  "ko",
  "zh_hans",
  "zh_hant",
]);

/*
 * Not: CLAUDE.md Bölüm 6'daki listeye ek olarak "bitkisel" değeri eklendi.
 * Doğu Asya etiketlerinde 植物由来 / 식물성 / 植物来源 (bitkisel kaynaklı)
 * ibaresi en yaygın parantez içi kaynak bilgisidir ve helal kararı için
 * belirleyicidir; bu değer olmadan kaynak ipucu tablosu eksik kalır.
 */
export const resolvedSourceEnum = pgEnum("resolved_source", [
  "domuz",
  "sigir",
  "tavuk",
  "balik",
  "soya",
  "misir",
  "palm",
  "bitkisel",
  "mikrobiyal",
  "sentetik",
  "bilinmiyor",
]);

export const madhhabEnum = pgEnum("madhhab", [
  "hanefi",
  "safii",
  "maliki",
  "hanbeli",
]);

export const rulingStatusEnum = pgEnum("ruling_status", [
  "helal",
  "haram",
  "mekruh",
  "supheli",
]);

export const ingredients = pgTable(
  "ingredients",
  {
    id: uuid("id").primaryKey(),
    canonicalNameTr: text("canonical_name_tr").notNull(),
    canonicalNameEn: text("canonical_name_en").notNull(),
    insCode: text("ins_code"),
    eCode: text("e_code"),
    cnsCode: text("cns_code"),
    category: categoryEnum("category").notNull(),
    sourceType: sourceTypeEnum("source_type").notNull(),
    defaultStatus: statusEnum("default_status").notNull(),
    descriptionTr: text("description_tr").notNull(),
    /* Anlamsal eşleştirme için; vektörler Faz 4'te ayrı betikle üretilir */
    embedding: vector("embedding", { dimensions: 768 }),
  },
  (t) => [unique("ingredients_canonical_en_unique").on(t.canonicalNameEn)],
);

export const ingredientAliases = pgTable(
  "ingredient_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    language: aliasLanguageEnum("language").notNull(),
    script: aliasScriptEnum("script"),
    /*
     * Bilinen yazımların Türkçe karşılığı buradan gelir; model çevirisi
     * yalnızca veritabanında bulunmayan malzemeler için kullanılır.
     * Boş bırakılırsa malzemenin canonicalNameTr değeri geçerlidir.
     */
    translationTr: text("translation_tr"),
  },
  (t) => [
    unique("aliases_ingredient_alias_lang_unique").on(
      t.ingredientId,
      t.alias,
      t.language,
    ),
    /* Tam eşleşme sorguları için */
    index("aliases_alias_idx").on(t.alias),
    /* pg_trgm bulanık eşleşme sorguları için */
    index("aliases_alias_trgm_idx").using(
      "gin",
      t.alias.op("gin_trgm_ops"),
    ),
  ],
);

export const sourceHints = pgTable(
  "source_hints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /* Parantez içi kaynak ifadesi, örnek: 豚由来 */
    pattern: text("pattern").notNull(),
    language: hintLanguageEnum("language").notNull(),
    resolvedSource: resolvedSourceEnum("resolved_source").notNull(),
    translationTr: text("translation_tr").notNull(),
  },
  (t) => [unique("source_hints_pattern_lang_unique").on(t.pattern, t.language)],
);

export const fiqhPrinciples = pgTable("fiqh_principles", {
  key: text("key").primaryKey(),
  titleTr: text("title_tr").notNull(),
  explanationTr: text("explanation_tr").notNull(),
});

export const madhhabRulings = pgTable(
  "madhhab_rulings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    /* Kaynağa göre değişen hükümler için; null = kaynaktan bağımsız hüküm */
    resolvedSource: resolvedSourceEnum("resolved_source"),
    madhhab: madhhabEnum("madhhab").notNull(),
    status: rulingStatusEnum("status").notNull(),
    principleKey: text("principle_key")
      .notNull()
      .references(() => fiqhPrinciples.key),
    reasoningTr: text("reasoning_tr").notNull(),
    /* Kaynağı olmayan hüküm veritabanına eklenmez */
    sourceRef: text("source_ref").notNull(),
  },
  (t) => [
    unique("rulings_ingredient_source_madhhab_unique")
      .on(t.ingredientId, t.resolvedSource, t.madhhab)
      .nullsNotDistinct(),
    index("rulings_ingredient_idx").on(t.ingredientId),
  ],
);

export const scans = pgTable("scans", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: text("device_id").notNull(),
  detectedLanguage: text("detected_language").notNull(),
  rawText: text("raw_text").notNull(),
  translatedText: text("translated_text").notNull(),
  parsedIngredients: jsonb("parsed_ingredients").notNull(),
  verdict: jsonb("verdict").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const unmatchedTerms = pgTable(
  "unmatched_terms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    term: text("term").notNull(),
    language: text("language").notNull(),
    /* Modelin ürettiği çeviri; içerik ekleme işini kolaylaştırır */
    modelTranslationTr: text("model_translation_tr"),
    occurrenceCount: integer("occurrence_count").notNull().default(1),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("unmatched_term_lang_unique").on(t.term, t.language)],
);
