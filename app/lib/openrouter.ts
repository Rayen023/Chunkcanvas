import {
  OPENROUTER_API_URL,
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_HEADERS_BASE,
  OPENROUTER_MAX_RETRIES,
  OPENROUTER_RETRY_DELAY_MS,
  OPENROUTER_TIMEOUT_MS,
  FALLBACK_MODELS,
} from "./constants";
import type { Modality, OpenRouterModel, OpenRouterModelFull, PdfEngine, ProgressCallback } from "./types";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (!result || result.length === 0) {
        reject(new Error("FileReader produced empty result"));
        return;
      }
      const idx = result.indexOf(",");
      if (idx < 0) {
        reject(new Error("Invalid data URL format: no comma found"));
        return;
      }
      const base64Data = result.slice(idx + 1);
      if (!base64Data || base64Data.length === 0) {
        reject(new Error("Base64 data is empty after extraction"));
        return;
      }
      resolve(base64Data);
    };
    reader.onerror = (error) => {
      reject(new Error(`FileReader error: ${error}`));
    };
    reader.readAsDataURL(file);
  });
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: unknown[],
  plugins?: unknown[],
  signal?: AbortSignal,
): Promise<string> {
  const headers = {
    ...OPENROUTER_HEADERS_BASE,
    Authorization: `Bearer ${apiKey}`,
  };

  const body: Record<string, unknown> = { model, messages };
  if (plugins?.length) body.plugins = plugins;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < OPENROUTER_MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);
      const fetchSignal = signal
        ? AbortSignal.any([signal, controller.signal])
        : controller.signal;

      const res = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: fetchSignal,
      });

      clearTimeout(timeout);

      if (res.status === 429 || res.status >= 500) {
        const delay = OPENROUTER_RETRY_DELAY_MS * 2 ** attempt;
        lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
        await sleep(delay);
        continue;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`OpenRouter ${res.status}: ${errText}`);
      }

      const json = await res.json();
      if (json.error) {
        throw new Error(`OpenRouter API error: ${JSON.stringify(json.error)}`);
      }

      return json.choices?.[0]?.message?.content ?? "";
    } catch (err: unknown) {
      if (signal?.aborted) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < OPENROUTER_MAX_RETRIES - 1) {
        await sleep(OPENROUTER_RETRY_DELAY_MS * 2 ** attempt);
      }
    }
  }

  throw lastError ?? new Error("OpenRouter request failed after retries");
}

let _modelsCache: { data: OpenRouterModel[]; ts: number } | null = null;
let _modelsFullCache: { data: OpenRouterModelFull[]; ts: number } | null = null;
const CACHE_TTL = 600_000;

function parseModelData(rawModels: Record<string, unknown>[]): OpenRouterModelFull[] {
  return rawModels
    .filter((m) => m.id && m.architecture)
    .map((m: Record<string, unknown>) => {
      const arch = m.architecture as {
        input_modalities?: string[];
        output_modalities?: string[];
      };
      const pricing = m.pricing as {
        prompt?: string;
        completion?: string;
      } | undefined;
      return {
        id: (m.id as string),
        name: (m.name as string) ?? (m.id as string),
        input_modalities: arch?.input_modalities ?? ["text"],
        output_modalities: arch?.output_modalities ?? ["text"],
        context_length: (m.context_length as number) ?? 0,
        pricing: {
          prompt: pricing?.prompt ?? "0",
          completion: pricing?.completion ?? "0",
        },
      };
    });
}

export async function fetchAvailableModels(
  apiKey: string,
): Promise<OpenRouterModel[]> {
  if (_modelsCache && Date.now() - _modelsCache.ts < CACHE_TTL) {
    return _modelsCache.data;
  }

  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const res = await fetch(`${OPENROUTER_API_URL}/models`, {
      headers,
    });

    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json();

    const models: OpenRouterModel[] = (json.data ?? [])
      .filter((m: Record<string, unknown>) => m.id && m.architecture)
      .map(
        (m: {
          id: string;
          name: string;
          architecture: { input_modalities?: string[] };
        }) => ({
          id: m.id,
          name: m.name ?? m.id,
          input_modalities: m.architecture?.input_modalities ?? ["text"],
        }),
      );

    _modelsCache = { data: models, ts: Date.now() };
    return models;
  } catch {
    return Object.values(FALLBACK_MODELS);
  }
}

export async function fetchAvailableModelsFull(
  apiKey: string,
): Promise<OpenRouterModelFull[]> {
  if (_modelsFullCache && Date.now() - _modelsFullCache.ts < CACHE_TTL) {
    return _modelsFullCache.data;
  }

  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const res = await fetch(`${OPENROUTER_API_URL}/models`, {
      headers,
    });

    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json();
    const models = parseModelData(json.data ?? []);
    _modelsFullCache = { data: models, ts: Date.now() };

    _modelsCache = {
      data: models.map((m) => ({
        id: m.id,
        name: m.name,
        input_modalities: m.input_modalities,
      })),
      ts: Date.now(),
    };

    return models;
  } catch {
    const { EMBEDDING_MODELS } = await import("./constants");
    return [...Object.values(FALLBACK_MODELS).map((m) => ({
      ...m,
      output_modalities: ["text"],
      context_length: 0,
      pricing: { prompt: "0", completion: "0" },
    })), ...EMBEDDING_MODELS];
  }
}

export function getEmbeddingModels(
  models: OpenRouterModelFull[],
): OpenRouterModelFull[] {
  return models.filter((m) =>
    m.output_modalities.includes("embeddings"),
  );
}

export function getModelsForModalityFull(
  models: OpenRouterModelFull[],
  modality: Modality,
): OpenRouterModelFull[] {
  const filtered = models.filter(
    (m) =>
      m.input_modalities.includes(modality) &&
      !m.output_modalities.includes("embeddings"),
  );
  filtered.sort((a, b) => {
    if (a.id === OPENROUTER_DEFAULT_MODEL) return -1;
    if (b.id === OPENROUTER_DEFAULT_MODEL) return 1;
    return a.name.localeCompare(b.name);
  });
  return filtered;
}

export function formatPricing(pricePerToken: string): string {
  const val = parseFloat(pricePerToken);
  if (isNaN(val) || val === 0) return "Free";
  const perMillion = val * 1_000_000;
  if (perMillion < 0.01) return `$${perMillion.toFixed(4)}/M`;
  if (perMillion < 1) return `$${perMillion.toFixed(3)}/M`;
  return `$${perMillion.toFixed(2)}/M`;
}

export function formatContextLength(ctx: number): string {
  if (!ctx || ctx === 0) return "?";
  if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(1)}M`;
  if (ctx >= 1_000) return `${Math.round(ctx / 1_000)}k`;
  return String(ctx);
}

export function getModelsForModality(
  models: OpenRouterModel[],
  modality: Modality,
): OpenRouterModel[] {
  const filtered = models.filter((m) =>
    m.input_modalities.includes(modality),
  );

  filtered.sort((a, b) => {
    if (a.id === OPENROUTER_DEFAULT_MODEL) return -1;
    if (b.id === OPENROUTER_DEFAULT_MODEL) return 1;
    return a.name.localeCompare(b.name);
  });

  return filtered;
}

export async function generateOpenRouterEmbeddings(
  apiKey: string,
  model: string,
  texts: string[],
  batchSize?: number,
  dimensions?: number,
  signal?: AbortSignal,
  onProgress?: (pct: number, msg?: string) => void,
): Promise<number[][]> {
  const { OPENROUTER_EMBEDDING_BATCH_SIZE } = await import("./constants");
  const size = batchSize ?? OPENROUTER_EMBEDDING_BATCH_SIZE;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += size) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    
    onProgress?.((i / texts.length) * 100, `Embedding batch ${Math.floor(i / size) + 1}...`);
    
    const batch = texts.slice(i, i + size);

    let lastError: Error | null = null;
    let success = false;

    for (let attempt = 0; attempt < OPENROUTER_MAX_RETRIES; attempt++) {
      try {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const payload: Record<string, unknown> = { model, input: batch };
        if (dimensions && dimensions > 0) {
          payload.dimensions = dimensions;
        }

        const res = await fetch(`${OPENROUTER_API_URL}/embeddings`, {
          method: "POST",
          headers: {
            ...OPENROUTER_HEADERS_BASE,
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
          signal,
        });

        if (res.status === 429 || res.status >= 500) {
          lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
          await sleep(OPENROUTER_RETRY_DELAY_MS * 2 ** attempt);
          continue;
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`OpenRouter Embeddings ${res.status}: ${errText}`);
        }

        const json = await res.json();
        if (json.error) {
          throw new Error(`OpenRouter API error: ${JSON.stringify(json.error)}`);
        }

        const batchEmbeddings = (json.data as { embedding: number[]; index?: number }[])
          .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
          .map((d) => d.embedding);

        allEmbeddings.push(...batchEmbeddings);
        success = true;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < OPENROUTER_MAX_RETRIES - 1) {
          await sleep(OPENROUTER_RETRY_DELAY_MS * 2 ** attempt);
        }
      }
    }

    if (!success) {
      throw lastError ?? new Error("OpenRouter embeddings request failed after retries");
    }
  }

  onProgress?.(100, "Embeddings complete");
  return allEmbeddings;
}

export async function processPdfWithOpenRouter(
  apiKey: string,
  model: string,
  pdfFile: File,
  prompt: string,
  pdfEngine: PdfEngine,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
  pagesPerBatch?: number,
): Promise<string> {
  const { PDFDocument } = await import("pdf-lib");

  const fileBytes = await pdfFile.arrayBuffer();
  const pdfDoc = await PDFDocument.load(fileBytes);
  const totalPages = pdfDoc.getPageCount();
  const pageTexts: string[] = [];

  const batchSize = !pagesPerBatch || pagesPerBatch < 1 ? totalPages : pagesPerBatch;

  for (let i = 0; i < totalPages; i += batchSize) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const endPage = Math.min(i + batchSize, totalPages);
    const isBatch = batchSize > 1;

    try {
      const batchDoc = await PDFDocument.create();
      const pageIndices = Array.from({ length: endPage - i }, (_, k) => i + k);
      const copiedPages = await batchDoc.copyPages(pdfDoc, pageIndices);
      copiedPages.forEach((page) => batchDoc.addPage(page));
      
      const batchBytes = await batchDoc.save();
      
      const u8 = new Uint8Array(batchBytes);
      let binary = "";
      const len = u8.byteLength;
      const CHUNK_SIZE = 0x8000;
      for (let k = 0; k < len; k += CHUNK_SIZE) {
        const chunk = u8.subarray(k, k + CHUNK_SIZE);
        // @ts-expect-error - apply accepts typed array
        binary += String.fromCharCode.apply(null, chunk);
      }
      const b64 = btoa(binary);

      const pageLabel = isBatch
        ? `Pages ${i + 1}-${endPage}/${totalPages}`
        : `Page ${i + 1}/${totalPages}`;

      const messages = [
        {
          role: "user",
          content: [
            { type: "text", text: `[${pageLabel}] ${prompt}` },
            {
              type: "file",
              file: {
                filename: `batch_${i + 1}_${endPage}.pdf`,
                file_data: `data:application/pdf;base64,${b64}`,
              },
            },
          ],
        },
      ];

      const plugins =
        pdfEngine !== "native"
          ? [{ id: "file-parser", pdf: { engine: pdfEngine } }]
          : undefined;

      const text = await callOpenRouter(apiKey, model, messages, plugins, signal);
      const header = isBatch
        ? `--- Pages ${i + 1}-${endPage} ---`
        : `--- Page ${i + 1} ---`;
      pageTexts.push(`${header}\n${text}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const header = isBatch
        ? `--- Pages ${i + 1}-${endPage} ---`
        : `--- Page ${i + 1} ---`;
      pageTexts.push(`${header}\n[ERROR] ${msg}`);
    }

    const progressPct = (endPage / totalPages) * 100;
    onProgress?.(progressPct, `Parsing PDF… ${Math.round(progressPct)}%`);
  }

  return pageTexts.join("\n\n");
}

export async function processImageWithOpenRouter(
  apiKey: string,
  model: string,
  file: File,
  prompt: string,
  signal?: AbortSignal,
): Promise<string> {
  const { IMAGE_MIME } = await import("./constants");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = IMAGE_MIME[ext] ?? "image/png";
  const b64 = await fileToBase64(file);

  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        {
          type: "image_url",
          image_url: { url: `data:${mime};base64,${b64}` },
        },
      ],
    },
  ];

  return callOpenRouter(apiKey, model, messages, undefined, signal);
}

export async function processAudioWithOpenRouter(
  apiKey: string,
  model: string,
  file: File,
  prompt: string,
  signal?: AbortSignal,
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const b64 = await fileToBase64(file);

  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        {
          type: "input_audio",
          input_audio: { data: b64, format: ext },
        },
      ],
    },
  ];

  return callOpenRouter(apiKey, model, messages, undefined, signal);
}

export async function processVideoWithOpenRouter(
  apiKey: string,
  model: string,
  file: File,
  prompt: string,
  signal?: AbortSignal,
  onProgress?: ProgressCallback,
): Promise<string> {
  const MAX_SIZE_BYTES = 100 * 1024 * 1024;

  if (file.size === 0) {
    throw new Error(`Video file "${file.name}" is empty (0 bytes)`);
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(
      `Video file "${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB, which exceeds the 100 MB limit. Please compress or trim it before uploading.`,
    );
  }

  onProgress?.(10, "Encoding video for upload…");

  const { VIDEO_MIME } = await import("./constants");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = VIDEO_MIME[ext] ?? "video/mp4";

  const b64 = await fileToBase64(file);

  if (!b64 || b64.length < 100) {
    throw new Error(
      `Base64 encoding failed or produced suspiciously short data (${b64?.length ?? 0} chars)`,
    );
  }

  onProgress?.(80, "Sending to OpenRouter…");

  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        {
          type: "video_url",
          video_url: { url: `data:${mime};base64,${b64}` },
        },
      ],
    },
  ];

  return callOpenRouter(apiKey, model, messages, undefined, signal);
}
