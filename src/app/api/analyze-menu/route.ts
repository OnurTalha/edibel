import { NextResponse } from "next/server";
import { AnalysisError } from "@/lib/analysis/pipeline";
import { runMenuAnalysis } from "@/lib/analysis/menu-pipeline";
import { VisionReadError, getVisionClient } from "@/lib/ai/vision";
import { errorKind, hashIdentifier, logEvent } from "@/lib/logger";
import { SCAN_LIMIT_PER_MINUTE, checkRateLimit } from "@/lib/rate-limit";
import { analyzeMenuRequestSchema } from "@/lib/schemas";
import { STR } from "@/lib/ui/strings";

/*
 * Menü analiz rotası: lokanta menüsü fotoğrafını alır, görme modeliyle
 * okutur, yemek başına deterministik hattan geçirir ve yemek listesini
 * döndürür. Fotoğraf sunucuda saklanmaz.
 *
 * Hız sınırı etiket taramasıyla ORTAKTIR: aynı cihaz dakikada toplam on
 * tarama yapabilir (menü + etiket birlikte sayılır), çünkü maliyeti üreten
 * şey model çağrısıdır, hangi ekrandan geldiği değil.
 *
 * Günlük kaydı kişisel veri içermez: menü metni, yemek adları ve malzeme
 * adları günlüğe yazılmaz.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BASE64_LENGTH = 14_000_000;

export async function POST(request: Request) {
  const startedAt = Date.now();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logEvent("warn", "menu.bad_request", { reason: "json" });
    return NextResponse.json(
      { error: "İstek okunamadı. Lütfen uygulamayı yenileyip tekrar deneyin." },
      { status: 400 },
    );
  }

  const parsedBody = analyzeMenuRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    logEvent("warn", "menu.bad_request", { reason: "schema" });
    return NextResponse.json(
      { error: "İstek okunamadı. Lütfen uygulamayı yenileyip tekrar deneyin." },
      { status: 400 },
    );
  }
  const input = parsedBody.data;
  const deviceHash = hashIdentifier(input.deviceId);

  /* Etiket taramasıyla ortak sayaç (bkz. yukarıdaki not) */
  const limit = checkRateLimit(`analyze:${input.deviceId}`);
  if (!limit.allowed) {
    logEvent("warn", "menu.rate_limited", {
      deviceHash,
      limit: SCAN_LIMIT_PER_MINUTE,
      retryAfterSeconds: limit.retryAfterSeconds,
    });
    return NextResponse.json(
      { error: STR.rateLimited },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  if (input.imageBase64.length > MAX_BASE64_LENGTH) {
    logEvent("warn", "menu.too_large", { deviceHash });
    return NextResponse.json(
      { error: "Fotoğraf çok büyük. Lütfen uygulama içinden yeniden çekin." },
      { status: 413 },
    );
  }

  logEvent("info", "menu.start", { deviceHash });

  try {
    const vision = getVisionClient();
    const menuOutput = await vision.analyzeMenu(
      input.imageBase64,
      input.mediaType,
    );
    const result = await runMenuAnalysis(menuOutput, input.deviceId);

    logEvent("info", "menu.done", {
      deviceHash,
      durationMs: Date.now() - startedAt,
      language: result.detectedLanguage,
      dishCount: result.dishes.length,
      avoidCount: result.summary.kacinilmali,
      askCount: result.summary.sorulmali,
      okCount: result.summary.muhtemelenUygun,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof VisionReadError || err instanceof AnalysisError) {
      logEvent("warn", "menu.failed", {
        deviceHash,
        durationMs: Date.now() - startedAt,
        kind: errorKind(err),
      });
      const message =
        err instanceof VisionReadError ? err.userMessage : err.message;
      return NextResponse.json({ error: message }, { status: 422 });
    }
    logEvent("error", "menu.error", {
      deviceHash,
      durationMs: Date.now() - startedAt,
      kind: errorKind(err),
    });
    return NextResponse.json(
      {
        error:
          "Analiz sırasında bir sorun oluştu. Lütfen biraz sonra tekrar deneyin.",
      },
      { status: 500 },
    );
  }
}
