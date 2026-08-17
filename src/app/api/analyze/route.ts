import { NextResponse } from "next/server";
import { AnalysisError, runAnalysis } from "@/lib/analysis/pipeline";
import { VisionReadError, getVisionClient } from "@/lib/ai/vision";
import { analyzeRequestSchema } from "@/lib/schemas";

/*
 * Analiz rotası: tarayıcıda küçültülmüş etiket fotoğrafını alır, görme
 * modeliyle okutur, deterministik hattan geçirir ve Bölüm 10 sonuç
 * nesnesini döndürür. Fotoğraf sunucuda saklanmaz. Model anahtarı yalnızca
 * burada (sunucuda) kullanılır, tarayıcıya asla gönderilmez.
 *
 * Hata mesajları kullanıcıya ne yapması gerektiğini söyler; teknik kod
 * içermez (bkz. CLAUDE.md, Bölüm 12).
 */

export const dynamic = "force-dynamic";
/* Model çağrısı uzun sürebilir */
export const maxDuration = 120;

/* Görüntüler tarayıcıda ~2000px'e küçültülüyor; 10 MB rahat bir üst sınır */
const MAX_BASE64_LENGTH = 14_000_000;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "İstek okunamadı. Lütfen uygulamayı yenileyip tekrar deneyin." },
      { status: 400 },
    );
  }

  const parsedBody = analyzeRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "İstek okunamadı. Lütfen uygulamayı yenileyip tekrar deneyin." },
      { status: 400 },
    );
  }
  const { imageBase64, mediaType, deviceId } = parsedBody.data;

  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return NextResponse.json(
      { error: "Fotoğraf çok büyük. Lütfen uygulama içinden yeniden çekin." },
      { status: 413 },
    );
  }

  try {
    const vision = getVisionClient();
    const visionOutput = await vision.analyzeLabel(imageBase64, mediaType);
    const result = await runAnalysis(visionOutput, deviceId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof VisionReadError || err instanceof AnalysisError) {
      const message =
        err instanceof VisionReadError ? err.userMessage : err.message;
      return NextResponse.json({ error: message }, { status: 422 });
    }
    console.error("analyze route error:", err);
    return NextResponse.json(
      {
        error:
          "Analiz sırasında bir sorun oluştu. Lütfen biraz sonra tekrar deneyin.",
      },
      { status: 500 },
    );
  }
}
