import { defineConfig } from "drizzle-kit";

/* drizzle-kit .env dosyasını kendisi okumaz; Node 21+ yerleşik yükleyicisi kullanılır */
try {
  process.loadEnvFile(".env");
} catch {
  /* .env yoksa ortam değişkenlerinin dışarıdan verildiği varsayılır */
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
