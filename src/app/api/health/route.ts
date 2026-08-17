import { NextResponse } from "next/server";
import { sql } from "@/db/client";

/*
 * Sağlık rotası: uygulamanın ayakta olduğunu, veritabanına ulaşılabildiğini
 * ve eşleştirme motorunun ihtiyaç duyduğu pg_trgm ile pgvector
 * eklentilerinin kurulu olduğunu doğrular. Dağıtımda (Faz 9) kapsayıcı
 * sağlık denetimi bu rotayı kullanacaktır.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await sql<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm', 'vector')
    `;
    const installed = new Set(rows.map((r) => r.extname));
    const extensions = {
      pg_trgm: installed.has("pg_trgm"),
      pgvector: installed.has("vector"),
    };
    const ok = extensions.pg_trgm && extensions.pgvector;

    return NextResponse.json(
      {
        status: ok ? "ok" : "degraded",
        database: "ok",
        extensions,
      },
      { status: ok ? 200 : 503 },
    );
  } catch {
    // Hata ayrıntısı istemciye sızdırılmaz; günlükleme Faz 9'da eklenecek
    return NextResponse.json(
      { status: "error", database: "unreachable" },
      { status: 503 },
    );
  }
}
