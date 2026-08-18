import { NextResponse } from "next/server";
import { getSql } from "@/db/client";
import { errorKind, logEvent } from "@/lib/logger";

/*
 * Sağlık rotası: uygulamanın ayakta olduğunu, veritabanına ulaşılabildiğini
 * ve eşleştirme motorunun ihtiyaç duyduğu pg_trgm ile pgvector
 * eklentilerinin kurulu olduğunu doğrular. Dağıtımda (Faz 9) kapsayıcı
 * sağlık denetimi bu rotayı kullanacaktır.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await getSql()<{ extname: string }[]>`
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
  } catch (err) {
    // Hata ayrıntısı istemciye sızdırılmaz, yalnızca günlüğe türü yazılır
    logEvent("error", "health.database_unreachable", { kind: errorKind(err) });
    return NextResponse.json(
      { status: "error", database: "unreachable" },
      { status: 503 },
    );
  }
}
