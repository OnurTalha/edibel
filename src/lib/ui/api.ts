"use client";

import {
  analysisResultSchema,
  scanResponseSchema,
  type AnalysisResult,
  type AnalyzeRequest,
  type ScanResponse,
} from "@/lib/schemas";
import { STR } from "@/lib/ui/strings";

/*
 * Sunucu iletişimi. Hata mesajları kullanıcıya ne yapması gerektiğini söyler;
 * teknik kod gösterilmez (bkz. CLAUDE.md, Bölüm 12).
 */

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

function errorFromPayload(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (payload as { error: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }
  return STR.genericError;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function requestAnalysis(
  body: AnalyzeRequest,
  signal: AbortSignal,
): Promise<AnalysisResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ApiError(STR.offlineError);
  }
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const payload = await readJson(response);
  if (!response.ok) throw new ApiError(errorFromPayload(payload));

  const parsed = analysisResultSchema.safeParse(payload);
  if (!parsed.success) throw new ApiError(STR.genericError);
  return parsed.data;
}

export async function fetchScan(scanId: string): Promise<ScanResponse> {
  const response = await fetch(`/api/scans/${scanId}`);
  const payload = await readJson(response);
  if (response.status === 404) throw new ApiError(STR.resultNotFound);
  if (!response.ok) throw new ApiError(errorFromPayload(payload));

  const parsed = scanResponseSchema.safeParse(payload);
  if (!parsed.success) throw new ApiError(STR.genericError);
  return parsed.data;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/* Bağlantı kopması ile sunucu hatası kullanıcıya farklı anlatılır */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return STR.offlineError;
  }
  if (error instanceof TypeError) return STR.offlineError;
  return STR.genericError;
}
