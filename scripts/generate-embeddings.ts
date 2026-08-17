/*
 * Gömme vektörü üretme betiği.
 *
 * GELİŞTİRME MAKİNESİNDE çalıştırılır (bkz. CLAUDE.md, Bölüm 3); sunucuda
 * model çalıştırılmaz. Her malzeme için standart adlar, takma adlar ve
 * açıklamadan bir temsil metni kurar, harici gömme arayüzüyle 768 boyutlu
 * vektöre çevirir ve ingredients.embedding kolonuna yazar.
 *
 * Varsayılan olarak yalnızca vektörü eksik malzemeleri işler; --all ile
 * tümü yeniden üretilir (içerik güncellemesi sonrası önerilir).
 *
 * Çalıştırma: npm run db:embeddings  (EMBEDDING_API_KEY gerektirir)
 */
import path from "node:path";
import { eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEmbeddingClient } from "../src/lib/ai/embedding";
import { ingredientAliases, ingredients } from "../src/db/schema";

process.loadEnvFile(path.join(process.cwd(), ".env"));

const BATCH_SIZE = 50;

async function main() {
  const regenerateAll = process.argv.includes("--all");

  const client = getEmbeddingClient();
  if (!client) {
    console.error(
      "EMBEDDING_API_KEY veya EMBEDDING_MODEL tanımlı değil. " +
        ".env dosyasını doldurup yeniden çalıştırın.",
    );
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL tanımlı değil.");
  const pg = postgres(url, { max: 4 });
  const db = drizzle(pg);

  const rows = await db
    .select({
      id: ingredients.id,
      nameTr: ingredients.canonicalNameTr,
      nameEn: ingredients.canonicalNameEn,
      descTr: ingredients.descriptionTr,
    })
    .from(ingredients)
    .where(regenerateAll ? sql`true` : isNull(ingredients.embedding));

  if (rows.length === 0) {
    console.log("Vektörü eksik malzeme yok. Tümünü yenilemek için: --all");
    await pg.end();
    return;
  }

  /* Temsil metnine takma adlar da katılır; çok dilli benzerlik böyle sağlanır */
  const aliasRows = await db
    .select({
      ingredientId: ingredientAliases.ingredientId,
      alias: ingredientAliases.alias,
    })
    .from(ingredientAliases);
  const aliasesByIngredient = new Map<string, string[]>();
  for (const a of aliasRows) {
    const list = aliasesByIngredient.get(a.ingredientId) ?? [];
    list.push(a.alias);
    aliasesByIngredient.set(a.ingredientId, list);
  }

  console.log(`${rows.length} malzeme için vektör üretiliyor...`);
  let done = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const texts = batch.map((r) => {
      const aliases = aliasesByIngredient.get(r.id)?.join(", ") ?? "";
      return `${r.nameTr}; ${r.nameEn}; ${aliases}; ${r.descTr}`;
    });

    const vectors = await client.embed(texts);
    for (let j = 0; j < batch.length; j++) {
      const vector = vectors[j];
      if (!vector) throw new Error("Gömme arayüzü eksik vektör döndürdü.");
      await db
        .update(ingredients)
        .set({ embedding: vector })
        .where(eq(ingredients.id, batch[j]!.id));
    }
    done += batch.length;
    console.log(`  ${done}/${rows.length}`);
  }

  const [count] = await db.execute(
    sql`SELECT count(*) AS n FROM ingredients WHERE embedding IS NOT NULL`,
  );
  console.log(`Tamamlandı. Vektörlü malzeme sayısı: ${(count as { n: string }).n}`);
  await pg.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
