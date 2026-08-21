import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/*
 * Görme yeteneği olan dil modeli istemcisi (bkz. CLAUDE.md, Katman 2 ve
 * Bölüm 11).
 *
 * Modelin görevi YALNIZCA metin çıkarma, dil tespiti, malzeme adı
 * normalleştirme ve çeviridir. Model hiçbir koşulda helal/haram hükmü
 * vermez; hüküm üretme yetkisi yalnızca veritabanındadır. Model çıktısı
 * zod ile doğrulanır; şemaya uymayan çıktı bir kez yeniden denenir,
 * ikinci denemede de başarısızsa okuma hatası fırlatılır ve çıktı asla
 * kısmen kullanılmaz.
 *
 * Sağlayıcıdan bağımsızlık: VisionClient arayüzü tektir; sağlayıcı
 * AI_PROVIDER ortam değişkeniyle seçilir. Anahtar yalnızca sunucuda okunur.
 */

export const visionOutputSchema = z.object({
  /* Etiketin yazı sistemine göre tespit edilen dil */
  detectedLanguage: z.enum(["ja", "ko", "zh_hans", "zh_hant", "en", "other"]),
  /* Görüntüde bir içindekiler listesi var mı */
  containsIngredientList: z.boolean(),
  /*
   * İçindekiler bölümünün etiketteki ÖZGÜN metni, basıldığı gibi
   * (ayırıcılar ve parantezler dahil). Liste yoksa boş dize.
   */
  rawBlock: z.string(),
  /* İçindekiler metninin tamamının akıcı Türkçe çevirisi */
  fluentTr: z.string(),
  /* Yapılandırılmış malzeme listesi; çeviri bilinmiyorsa null */
  ingredients: z.array(
    z.object({
      rawText: z.string(),
      sourceHint: z.string().nullable(),
      translationTr: z.string().nullable(),
    }),
  ),
  allergenLine: z.object({
    rawText: z.string().nullable(),
    translationTr: z.string().nullable(),
  }),
});

export type VisionOutput = z.infer<typeof visionOutputSchema>;

export class VisionReadError extends Error {
  constructor(
    /* Kullanıcıya gösterilecek Türkçe mesaj (teknik kod içermez) */
    public readonly userMessage: string,
    detail?: string,
  ) {
    super(detail ?? userMessage);
    this.name = "VisionReadError";
  }
}

export interface VisionClient {
  analyzeLabel(
    imageBase64: string,
    mediaType: "image/jpeg" | "image/png" | "image/webp",
  ): Promise<VisionOutput>;
  /*
   * Kullanıcının sonuç ekranında düzelttiği ham etiket metnini yeniden
   * yapılandırır ve çevirir. Fotoğraf yoktur; özgün metin kullanıcıdan
   * gelir ve olduğu gibi korunur.
   */
  analyzeText(rawText: string): Promise<VisionOutput>;
}

/*
 * Sistem talimatı (Bölüm 11'deki kuralların tamamı). Kural metni modelin en
 * güvenilir izlediği dilde (İngilizce) yazılmıştır; ürettiği çeviriler
 * Türkçedir.
 */
const SYSTEM_PROMPT = `You are the reading layer of a food-label analysis application. Users photograph the ingredients label of packaged foods, mostly in Japanese, Korean, or Chinese. Your only tasks are: text extraction, language detection, ingredient-name structuring, and Turkish translation.

Rules you must always follow:
- You NEVER make any halal/haram or other religious judgment, and you never add religious commentary to translations. Judgments are made elsewhere from a curated database; you only read and translate.
- Preserve the label's original spelling EXACTLY in every rawText field and in rawBlock. Never correct, normalize, or alter the original text, even if it looks misspelled.
- rawBlock is the ingredients section as printed, including separators (、・,) and parentheses, from the ingredients header up to (excluding) the nutrition table. If the image contains no ingredients list (e.g. only a nutrition table), set containsIngredientList to false and rawBlock to "".
- Read vertical text in the correct order (top-to-bottom within a column, columns right-to-left).
- Structure each ingredient as one entry, in label order. When an ingredient has a sub-list in parentheses (e.g. スープ(ポークエキス、豚脂)), also list each sub-ingredient as its own entry after the container entry.
- Extract parenthetical source annotations (e.g. 大豆由来, 돼지 유래, 大豆来源, 国内製造) into sourceHint, not into rawText.
- Extract the allergen declaration (e.g. 一部に...を含む / ...함유 / 致敏物质...) into allergenLine with its exact original text; null if absent.
- translationTr values are short, technically accurate Turkish terms with no explanations (e.g. 豚脂 -> "domuz yağı"). If you do not recognize an ingredient, set translationTr to null - never guess.
- fluentTr is a fluent, complete Turkish translation of the whole ingredients text (and allergen line), with no additions.
- Output only the requested JSON structure.`;

class AnthropicVisionClient implements VisionClient {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    /*
     * Zaman bütçesi, önümüzdeki katmanların en dar sınırına göre kurulur:
     * uygulama Cloudflare arkasındaysa istek 100 saniyede kesilir ve
     * kullanıcı bizim hata ekranımızı göremez. Bu sebeple SDK'nın kendi
     * yeniden denemesi kapatılır ve yeniden deneme yalnızca hızlı
     * başarısızlıklarda (şemaya uymayan çıktı) yapılır.
     *
     * Süre sınırı üretim ölçümüyle belirlendi: gerçek etiketlerde başarılı
     * okumalar 32-43 saniye sürdü, kalabalık bir etiket 60 saniyelik ilk
     * sınıra takılıp başarısız oldu. Sınır 85 saniyeye çıkarıldı; tek çağrı
     * artı işlem payı 100 saniyenin altında kalır.
     */
    this.client = new Anthropic({ apiKey, timeout: 85_000, maxRetries: 0 });
  }

  private async run(
    content: Anthropic.ContentBlockParam[],
    failureMessage: string,
  ): Promise<VisionOutput> {
    /* Şemaya uymayan çıktı için bir kez yeniden dene (Bölüm 11) */
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await this.client.messages.parse({
          model: this.model,
          max_tokens: 16000,
          system: SYSTEM_PROMPT,
          output_config: { format: zodOutputFormat(visionOutputSchema) },
          messages: [{ role: "user", content }],
        });

        if (response.stop_reason === "refusal") {
          throw new VisionReadError(
            "Etiket okunamadı. Lütfen yalnızca gıda etiketinin içindekiler bölümünü çekip yeniden deneyin.",
            "model refusal",
          );
        }
        if (response.stop_reason === "max_tokens") {
          throw new Error("Çıktı üst sınıra takıldı");
        }
        if (!response.parsed_output) {
          throw new Error("Model çıktısı şemaya uymadı");
        }
        return response.parsed_output;
      } catch (err) {
        if (err instanceof VisionReadError) throw err;
        lastError = err;
        /*
         * Zaman aşımı veya bağlantı hatasında yeniden denenmez: ikinci
         * çağrı toplam süreyi vekil sunucunun sınırının üstüne taşır ve
         * kullanıcı hata ekranı yerine kopuk bağlantı görür. Yeniden deneme
         * yalnızca şemaya uymayan çıktı gibi hızlı başarısızlıklar içindir.
         */
        if (
          err instanceof Anthropic.APIConnectionTimeoutError ||
          err instanceof Anthropic.APIConnectionError ||
          err instanceof Anthropic.APIUserAbortError
        ) {
          break;
        }
      }
    }
    throw new VisionReadError(
      failureMessage,
      lastError instanceof Error ? lastError.message : String(lastError),
    );
  }

  async analyzeLabel(
    imageBase64: string,
    mediaType: "image/jpeg" | "image/png" | "image/webp",
  ): Promise<VisionOutput> {
    return this.run(
      [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: imageBase64 },
        },
        {
          type: "text",
          text: "Read this food label and produce the structured output.",
        },
      ],
      "Etiket okunamadı. Fotoğrafı daha yakından, parlamasız ve net çekip yeniden deneyin.",
    );
  }

  async analyzeText(rawText: string): Promise<VisionOutput> {
    const output = await this.run(
      [
        {
          type: "text",
          text: `The following is the ingredients text of a food label, corrected by the user. Structure and translate it exactly as it is written. Do not add, remove, or fix any character.\n\n<label_text>\n${rawText}\n</label_text>`,
        },
      ],
      "Metin çözümlenemedi. Metni sadeleştirip yeniden deneyin.",
    );
    /*
     * Özgün metnin tek doğru kaynağı kullanıcının girdisidir; modelin
     * rawBlock alanı yeniden yazmış olabileceğinden dikkate alınmaz
     * (eşleştirme yalnızca özgün metin üzerinden yapılır).
     */
    return { ...output, rawBlock: rawText };
  }
}

export function getVisionClient(): VisionClient {
  const provider = process.env.AI_PROVIDER ?? "anthropic";
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL ?? "claude-opus-5";

  if (!apiKey) {
    throw new VisionReadError(
      "Analiz hizmeti şu anda yapılandırılmamış. Lütfen daha sonra tekrar deneyin.",
      "AI_API_KEY tanımlı değil",
    );
  }
  if (provider === "anthropic") {
    return new AnthropicVisionClient(apiKey, model);
  }
  throw new VisionReadError(
    "Analiz hizmeti şu anda yapılandırılmamış. Lütfen daha sonra tekrar deneyin.",
    `Desteklenmeyen sağlayıcı: ${provider}`,
  );
}
