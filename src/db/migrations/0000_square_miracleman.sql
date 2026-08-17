CREATE TYPE "public"."alias_language" AS ENUM('ja', 'ko', 'zh_hans', 'zh_hant', 'en', 'tr');--> statement-breakpoint
CREATE TYPE "public"."alias_script" AS ENUM('katakana', 'hiragana', 'kanji', 'hangul', 'han', 'latin');--> statement-breakpoint
CREATE TYPE "public"."ingredient_category" AS ENUM('emulgator', 'renklendirici', 'jelatin', 'enzim', 'alkol_turevi', 'aroma', 'tatlandirici', 'koruyucu', 'yag', 'protein', 'diger');--> statement-breakpoint
CREATE TYPE "public"."hint_language" AS ENUM('ja', 'ko', 'zh_hans', 'zh_hant');--> statement-breakpoint
CREATE TYPE "public"."madhhab" AS ENUM('hanefi', 'safii', 'maliki', 'hanbeli');--> statement-breakpoint
CREATE TYPE "public"."resolved_source" AS ENUM('domuz', 'sigir', 'tavuk', 'balik', 'soya', 'misir', 'palm', 'bitkisel', 'mikrobiyal', 'sentetik', 'bilinmiyor');--> statement-breakpoint
CREATE TYPE "public"."ruling_status" AS ENUM('helal', 'haram', 'mekruh', 'supheli');--> statement-breakpoint
CREATE TYPE "public"."ingredient_source_type" AS ENUM('bitkisel', 'hayvansal', 'mikrobiyal', 'sentetik', 'belirsiz');--> statement-breakpoint
CREATE TYPE "public"."halal_status" AS ENUM('helal', 'haram', 'supheli');--> statement-breakpoint
CREATE TABLE "fiqh_principles" (
	"key" text PRIMARY KEY NOT NULL,
	"title_tr" text NOT NULL,
	"explanation_tr" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingredient_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"language" "alias_language" NOT NULL,
	"script" "alias_script",
	"translation_tr" text,
	CONSTRAINT "aliases_ingredient_alias_lang_unique" UNIQUE("ingredient_id","alias","language")
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"canonical_name_tr" text NOT NULL,
	"canonical_name_en" text NOT NULL,
	"ins_code" text,
	"e_code" text,
	"cns_code" text,
	"category" "ingredient_category" NOT NULL,
	"source_type" "ingredient_source_type" NOT NULL,
	"default_status" "halal_status" NOT NULL,
	"description_tr" text NOT NULL,
	"embedding" vector(768),
	CONSTRAINT "ingredients_canonical_en_unique" UNIQUE("canonical_name_en")
);
--> statement-breakpoint
CREATE TABLE "madhhab_rulings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"resolved_source" "resolved_source",
	"madhhab" "madhhab" NOT NULL,
	"status" "ruling_status" NOT NULL,
	"principle_key" text NOT NULL,
	"reasoning_tr" text NOT NULL,
	"source_ref" text NOT NULL,
	CONSTRAINT "rulings_ingredient_source_madhhab_unique" UNIQUE NULLS NOT DISTINCT("ingredient_id","resolved_source","madhhab")
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" text NOT NULL,
	"detected_language" text NOT NULL,
	"raw_text" text NOT NULL,
	"translated_text" text NOT NULL,
	"parsed_ingredients" jsonb NOT NULL,
	"verdict" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_hints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern" text NOT NULL,
	"language" "hint_language" NOT NULL,
	"resolved_source" "resolved_source" NOT NULL,
	"translation_tr" text NOT NULL,
	CONSTRAINT "source_hints_pattern_lang_unique" UNIQUE("pattern","language")
);
--> statement-breakpoint
CREATE TABLE "unmatched_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term" text NOT NULL,
	"language" text NOT NULL,
	"model_translation_tr" text,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unmatched_term_lang_unique" UNIQUE("term","language")
);
--> statement-breakpoint
ALTER TABLE "ingredient_aliases" ADD CONSTRAINT "ingredient_aliases_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "madhhab_rulings" ADD CONSTRAINT "madhhab_rulings_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "madhhab_rulings" ADD CONSTRAINT "madhhab_rulings_principle_key_fiqh_principles_key_fk" FOREIGN KEY ("principle_key") REFERENCES "public"."fiqh_principles"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aliases_alias_idx" ON "ingredient_aliases" USING btree ("alias");--> statement-breakpoint
CREATE INDEX "aliases_alias_trgm_idx" ON "ingredient_aliases" USING gin ("alias" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "rulings_ingredient_idx" ON "madhhab_rulings" USING btree ("ingredient_id");