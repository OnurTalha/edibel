import { NextResponse } from "next/server";
import { AnalysisError, runAnalysis } from "@/lib/analysis/pipeline";
import { VisionReadError, getVisionClient } from "@/lib/ai/vision";
import { errorKind, hashIdentifier, logEvent } from "@/lib/logger";
import { SCAN_LIMIT_PER_MINUTE, checkRateLimit } from "@/lib/rate-limit";
import { analyzeRequestSchema } from "@/lib/schemas";
import { STR } from "@/lib/ui/strings";

/*
 * Analiz rotası: tarayıcıda küçültülmüş etiket fotoğrafını alır, görme
 * modeliyle okutur, deterministik hattan geçirir ve Bölüm 10 sonuç
 * nesnesini döndürür. Fotoğraf sunucuda saklanmaz. Model anahtarı yalnızca
 * burada (sunucuda) kullanılır, tarayıcıya asla gönderilmez.
 *
 * Hata mesajları kullanıcıya ne yapması gerektiğini söyler; teknik kod
 * içermez (bkz. CLAUDE.md, Bölüm 12).
 *
 * Günlük kaydı yapılandırılmıştır ve kişisel veri içermez: etiket metni,
 * çeviri ve malzeme adları günlüğe yazılmaz (bkz. Faz 9).
 */

export const dynamic = "force-dynamic";
/* Model çağrısı uzun sürebilir */
export const maxDuration = 120;

/* Görüntüler tarayıcıda ~2000px'e küçültülüyor; 10 MB rahat bir üst sınır */
const MAX_BASE64_LENGTH = 14_000_000;

export async function POST(request: Request) {
  const startedAt = Date.now();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logEvent("warn", "analyze.bad_request", { reason: "json" });
    return NextResponse.json(
      { error: "İstek okunamadı. Lütfen uygulamayı yenileyip tekrar deneyin." },
      { status: 400 },
    );
  }

  const parsedBody = analyzeRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    logEvent("warn", "analyze.bad_request", { reason: "schema" });
    return NextResponse.json(
      { error: "İstek okunamadı. Lütfen uygulamayı yenileyip tekrar deneyin." },
      { status: 400 },
    );
  }
  const input = parsedBody.data;
  const deviceHash = hashIdentifier(input.deviceId);

  /* Hız sınırı: cihaz başına dakikada en fazla on tarama (Faz 9) */
  const limit = checkRateLimit(`analyze:${input.deviceId}`);
  if (!limit.allowed) {
    logEvent("warn", "analyze.rate_limited", {
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

  if (input.mode === "image" && input.imageBase64.length > MAX_BASE64_LENGTH) {
    logEvent("warn", "analyze.too_large", { deviceHash });
    return NextResponse.json(
      { error: "Fotoğraf çok büyük. Lütfen uygulama içinden yeniden çekin." },
      { status: 413 },
    );
  }

  logEvent("info", "analyze.start", { deviceHash, mode: input.mode });

  try {
    const vision = getVisionClient();
    /* Fotoğraf yolu ile düzeltilmiş metin yolu aynı hattan geçer */
    const visionOutput =
      input.mode === "image"
        ? await vision.analyzeLabel(input.imageBase64, input.mediaType)
        : await vision.analyzeText(input.rawText);
    const result = await runAnalysis(visionOutput, input.deviceId);

    logEvent("info", "analyze.done", {
      deviceHash,
      mode: input.mode,
      durationMs: Date.now() - startedAt,
      language: result.detectedLanguage,
      verdict: result.verdict,
      ingredientCount: result.translation.lines.length,
      unmatchedCount: result.unmatchedCount,
      problematicCount: result.problematicIngredients.length,
      allergenPork: result.allergenLine.containsPork,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof VisionReadError || err instanceof AnalysisError) {
      /* Kullanıcıya gösterilen mesaj değil, yalnızca hata türü günlüğe girer */
      logEvent("warn", "analyze.failed", {
        deviceHash,
        mode: input.mode,
        durationMs: Date.now() - startedAt,
        kind: errorKind(err),
      });
      const message =
        err instanceof VisionReadError ? err.userMessage : err.message;
      return NextResponse.json({ error: message }, { status: 422 });
    }
    logEvent("error", "analyze.error", {
      deviceHash,
      mode: input.mode,
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
