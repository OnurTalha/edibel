/*
 * Sağlayıcıdan bağımsız gömme (embedding) istemcisi.
 *
 * Sunucuda model çalıştırılmaz; harici bir gömme arayüzü çağrılır (bkz.
 * CLAUDE.md, Bölüm 3). Bu çağrı eşleştirmede yalnızca diğer üç yöntem
 * başarısız olduğunda yapılır, yani seyrek çalışır. Anahtar yalnızca sunucu
 * tarafında okunur, tarayıcıya asla gönderilmez.
 *
 * Sağlayıcı, EMBEDDING_MODEL adından çıkarılır. Varsayılan model 768
 * boyutlu vektör üretebilen gemini-embedding-001'dir; veritabanı şeması
 * vector(768) kullanır.
 */

export const EMBEDDING_DIMENSIONS = 768;

export interface EmbeddingClient {
  /* Her metin için 768 boyutlu, birim uzunluğa normalize edilmiş vektör */
  embed(texts: string[]): Promise<number[][]>;
}

function normalizeVector(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0));
  if (norm === 0) return values;
  return values.map((v) => v / norm);
}

class GeminiEmbeddingClient implements EmbeddingClient {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:batchEmbedContents`;
    const body = {
      requests: texts.map((text) => ({
        model: `models/${this.model}`,
        content: { parts: [{ text }] },
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType: "SEMANTIC_SIMILARITY",
      })),
    };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      throw new Error(`Gömme isteği başarısız: HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      embeddings: { values: number[] }[];
    };
    /*
     * Gemini vektörleri 768 boyuta indirildiğinde birim uzunlukta gelmez;
     * kosinüs benzerliğinin tutarlı olması için normalize edilir.
     */
    return data.embeddings.map((e) => normalizeVector(e.values));
  }
}

/*
 * Yapılandırma eksikse null döner; eşleştirme motoru bu durumda gömme
 * adımını sessizce atlar ve terimi eşleşmemiş sayar.
 */
export function getEmbeddingClient(): EmbeddingClient | null {
  const apiKey = process.env.EMBEDDING_API_KEY;
  const model = process.env.EMBEDDING_MODEL;
  if (!apiKey || !model) return null;

  if (model.startsWith("gemini-")) {
    return new GeminiEmbeddingClient(apiKey, model);
  }
  /* Bilinmeyen sağlayıcı: yapılandırma hatası gizlenmez */
  throw new Error(
    `Desteklenmeyen gömme modeli: ${model}. Desteklenen önek: gemini-`,
  );
}
