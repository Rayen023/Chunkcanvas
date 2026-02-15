import { DEFAULT_OLLAMA_ENDPOINT, OLLAMA_CONFIG } from "./constants";
import type { PageStreamCallback, ProgressCallback } from "./types";

export interface OllamaModel {
  name: string;
  parameterSize?: string;
  quantization?: string;
  capabilities?: string[];
  families?: string[];
  format?: string;
  embeddingDimensions?: number;
}

export interface OllamaShowResponse {
  parameters?: string;
  license?: string;
  capabilities?: string[];
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
  model_info?: Record<string, unknown>;
}

function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (!result) {
        reject(new Error("FileReader produced empty result"));
        return;
      }
      const idx = result.indexOf(",");
      if (idx < 0) {
        reject(new Error("Invalid data URL format"));
        return;
      }
      resolve(result.slice(idx + 1));
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsDataURL(file);
  });
}

export async function checkOllamaHealth(
  endpoint: string = DEFAULT_OLLAMA_ENDPOINT,
): Promise<boolean> {
  try {
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) return true;
    const res2 = await fetch(`${endpoint}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    return res2.ok;
  } catch {
    return false;
  }
}

export async function unloadOllamaModel(
  modelName: string,
  endpoint: string = DEFAULT_OLLAMA_ENDPOINT,
): Promise<void> {
  try {
    const res = await fetch(`${endpoint}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        keep_alive: 0,
      }),
      signal: AbortSignal.timeout(5000),
    });
    
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Failed to unload ${modelName}: ${res.status} — ${text}`);
    }
  } catch (err) {
    if (err instanceof Error && err.name !== "TimeoutError") {
      throw err;
    }
  }
}

export async function listOllamaModels(
  endpoint: string = DEFAULT_OLLAMA_ENDPOINT,
): Promise<string[]> {
  const res = await fetch(`${endpoint}/api/tags`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Ollama /api/tags: ${res.status}`);
  const json = await res.json();
  return ((json.models ?? []) as { name: string }[]).map((m) => m.name);
}

export async function showOllamaModel(
  modelName: string,
  endpoint: string = DEFAULT_OLLAMA_ENDPOINT,
): Promise<OllamaShowResponse> {
  const res = await fetch(`${endpoint}/api/show`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelName }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Ollama /api/show (${modelName}): ${res.status} — ${text}`);
  }
  return res.json();
}

export async function listOllamaModelsEnriched(
  endpoint: string = DEFAULT_OLLAMA_ENDPOINT,
): Promise<OllamaModel[]> {
  const names = await listOllamaModels(endpoint);

  const enriched: OllamaModel[] = [];
  const CONCURRENCY = 4;

  for (let i = 0; i < names.length; i += CONCURRENCY) {
    const batch = names.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (name) => {
        const info = await showOllamaModel(name, endpoint);

        let embeddingDimensions: number | undefined;
        if (info.model_info) {
          for (const [key, val] of Object.entries(info.model_info)) {
            if (key.endsWith(".embedding_length") && typeof val === "number") {
              embeddingDimensions = val;
              break;
            }
          }
        }

        return {
          name,
          parameterSize: info.details?.parameter_size,
          quantization: info.details?.quantization_level,
          capabilities: info.capabilities ?? [],
          families: info.details?.families ?? [],
          format: info.details?.format,
          embeddingDimensions,
        } satisfies OllamaModel;
      }),
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        enriched.push(r.value);
      }
    }
  }

  return enriched;
}

export function filterVisionModels(models: OllamaModel[]): OllamaModel[] {
  return models.filter((m) =>
    m.capabilities?.some((c) => c.toLowerCase().includes("vision")),
  );
}

export function filterEmbeddingModels(models: OllamaModel[]): OllamaModel[] {
  const pattern = /embed|bge/i;
  return models.filter((m) => pattern.test(m.name));
}

interface OllamaChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  images?: string[];
}

export async function chatOllama(
  model: string,
  messages: OllamaChatMessage[],
  endpoint: string = DEFAULT_OLLAMA_ENDPOINT,
  signal?: AbortSignal,
  options?: {
    num_ctx?: number;
    keep_alive?: number | string;
    num_predict?: number;
    temperature?: number;
  },
  onToken?: (token: string) => void,
): Promise<string> {
  const res = await fetch(`${endpoint}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      keep_alive: options?.keep_alive ?? 0,
      options: {
        ...(options?.num_ctx && { num_ctx: options.num_ctx }),
        ...(options?.num_predict && { num_predict: options.num_predict }),
        ...(typeof options?.temperature === "number" && { temperature: options.temperature }),
      },
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Ollama chat (${model}): ${res.status} — ${text}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Ollama chat: no response body");

  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let buffer = "";
  let streamDone = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const obj = JSON.parse(trimmed);
          if (obj.message?.content) {
            chunks.push(obj.message.content);
            onToken?.(obj.message.content);
          }
          if (obj.done === true) {
            streamDone = true;
            break;
          }
        } catch {
          // skip malformed NDJSON lines
        }
      }

      if (streamDone) break;
    }

    if (!streamDone && buffer.trim()) {
      try {
        const obj = JSON.parse(buffer.trim());
        if (obj.message?.content) chunks.push(obj.message.content);
      } catch {
        // skip
      }
    }
  } finally {
    reader.cancel().catch(() => {});
    reader.releaseLock();
  }

  return chunks.join("");
}

export async function processImageWithOllama(
  model: string,
  file: File,
  prompt: string,
  endpoint?: string,
  signal?: AbortSignal,
): Promise<string> {
  const b64 = await fileToBase64(file);
  return chatOllama(
    model,
    [{ role: "user", content: prompt, images: [b64] }],
    endpoint,
    signal,
    {
      keep_alive: 0,
      num_ctx: OLLAMA_CONFIG.VISION_NUM_CTX,
      num_predict: OLLAMA_CONFIG.MAX_TOKENS_VISION,
      temperature: OLLAMA_CONFIG.VISION_TEMPERATURE,
    },
  );
}

async function renderPageToBase64(
  pdf: Awaited<ReturnType<Awaited<typeof import("pdfjs-dist")>["getDocument"]>>["promise"] extends Promise<infer T> ? T : never,
  pageNum: number,
): Promise<string> {
  const page = await pdf.getPage(pageNum);
  try {
    const viewport = page.getViewport({ scale: 1.0 });
    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d")!;
    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
      canvas: canvas as unknown as HTMLCanvasElement,
    } as unknown as Parameters<typeof page.render>[0]).promise;

    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
    return fileToBase64(blob);
  } finally {
    page.cleanup();
  }
}

export async function processPdfWithOllama(
  model: string,
  pdfFile: File,
  prompt: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
  endpoint?: string,
  onPageStream?: PageStreamCallback,
): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await pdfFile.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });

  if (signal?.aborted) {
    loadingTask.destroy();
    throw new DOMException("Aborted", "AbortError");
  }

  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const pageTexts: string[] = new Array(totalPages).fill("");
  let completedPages = 0;
  let abortErr: Error | undefined;

  onProgress?.(0, `Rendering ${totalPages} pages…`);

  try {
    const rendered = await Promise.all(
      Array.from({ length: totalPages }, (_, i) => i + 1).map(async (pageNum) => {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        return { pageNum, b64: await renderPageToBase64(pdf, pageNum) };
      }),
    );

    onProgress?.(0, `Sending ${totalPages} pages to ${model}…`);

    const pageAccumulators: string[] = new Array(totalPages).fill("");

    const promises = rendered.map(async ({ pageNum, b64 }) => {
      try {
        const text = await chatOllama(
          model,
          [{
            role: "user",
            content: `[Page ${pageNum}/${totalPages}] ${prompt}`,
            images: [b64],
          }],
          endpoint,
          signal,
          {
            keep_alive: OLLAMA_CONFIG.KEEP_ALIVE_DEFAULT,
            num_ctx: OLLAMA_CONFIG.VISION_NUM_CTX,
            num_predict: OLLAMA_CONFIG.MAX_TOKENS_VISION,
            temperature: OLLAMA_CONFIG.VISION_TEMPERATURE,
          },
          onPageStream
            ? (token: string) => {
                pageAccumulators[pageNum - 1] += token;
                onPageStream(pageNum, token, pageAccumulators[pageNum - 1]);
              }
            : undefined,
        );
        pageTexts[pageNum - 1] = `--- Page ${pageNum} ---\n${text}`;
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          abortErr = err as Error;
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          pageTexts[pageNum - 1] = `--- Page ${pageNum} ---\n[ERROR] ${msg}`;
        }
      } finally {
        completedPages++;
        onProgress?.(
          (completedPages / totalPages) * 100,
          `Page ${pageNum} done (${completedPages}/${totalPages})`,
        );
      }
    });

    await Promise.all(promises);

    if (abortErr) throw abortErr;
  } finally {
    unloadOllamaModel(model, endpoint).catch(() => {});
    Promise.resolve()
      .then(() => pdf.cleanup())
      .then(() => pdf.destroy())
      .catch(() => {});
  }

  return pageTexts.filter(Boolean).join("\n\n");
}

export async function generateOllamaEmbeddings(
  model: string,
  texts: string[],
  endpoint: string = DEFAULT_OLLAMA_ENDPOINT,
  batchSize: number = 64,
  dimensions?: number,
  signal?: AbortSignal,
  onProgress?: (pct: number, msg?: string) => void,
): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    
    onProgress?.((i / texts.length) * 100, `Embedding batch ${Math.floor(i / batchSize) + 1}...`);

    const batch = texts.slice(i, i + batchSize);
    const isLastBatch = i + batchSize >= texts.length;

    const payload: Record<string, unknown> = {
      model,
      input: batch,
      keep_alive: isLastBatch ? 0 : "5m",
    };
    if (dimensions && dimensions > 0) {
      payload.dimensions = dimensions;
    }

    const res = await fetch(`${endpoint}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Ollama embed (${model}): ${res.status} — ${errText}`);
    }

    const json = await res.json();
    const embeddings: number[][] = json.embeddings ?? [];
    if (embeddings.length === 0) {
      throw new Error(`Ollama embed returned no embeddings for batch starting at index ${i}`);
    }
    allEmbeddings.push(...embeddings);
  }

  onProgress?.(100, "Embeddings complete");
  return allEmbeddings;
}
