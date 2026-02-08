/**
 * Ollama API client — browser-side fetch for local LLM inference.
 *
 * Endpoints used:
 *   GET  /api/tags       — list local models
 *   POST /api/show       — show model details (capabilities, parameter size …)
 *   POST /api/chat       — multimodal chat (vision → images as base64)
 *   POST /api/embed      — generate embeddings
 */

import { DEFAULT_OLLAMA_ENDPOINT, OLLAMA_CONFIG } from "./constants";
import type { ProgressCallback } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────

export interface OllamaModel {
  name: string;
  /** e.g. "4.3B" */
  parameterSize?: string;
  /** e.g. "Q4_K_M" */
  quantization?: string;
  /** e.g. ["completion", "vision"] */
  capabilities?: string[];
  /** e.g. ["gemma3"] */
  families?: string[];
  /** Model format — usually "gguf" */
  format?: string;
  /** Native embedding dimensions from model_info (e.g. 768, 1024) */
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

// ─── Helpers ──────────────────────────────────────────────────────────────

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

// ─── Health / Status Check ────────────────────────────────────────────────

/** Basic health check — Ollama responds on GET / with "Ollama is running" */
export async function checkOllamaHealth(
  endpoint: string = DEFAULT_OLLAMA_ENDPOINT,
): Promise<boolean> {
  try {
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) return true;
    // also try /api/tags as fallback
    const res2 = await fetch(`${endpoint}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    return res2.ok;
  } catch {
    return false;
  }
}

// ─── Unload Model (Free VRAM) ─────────────────────────────────────────────

/**
 * Unload a model from VRAM by sending keep_alive: 0.
 * This immediately frees the VRAM used by the model.
 * 
 * Per Ollama docs: https://docs.ollama.com/faq#how-do-i-keep-a-model-loaded-in-memory-or-make-it-unload-immediately
 */
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
    
    // Server may return 200 or 404 - both are OK for unload
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Failed to unload ${modelName}: ${res.status} — ${text}`);
    }
  } catch (err) {
    // Ignore timeout errors - model unload is best-effort
    if (err instanceof Error && err.name !== "TimeoutError") {
      throw err;
    }
  }
}

// ─── List Models ──────────────────────────────────────────────────────────

/** Fetch all locally-pulled models from /api/tags */
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

// ─── Show Model Details ───────────────────────────────────────────────────

/** POST /api/show to retrieve capabilities, details, etc. */
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

// ─── Enriched Model List ──────────────────────────────────────────────────

/**
 * Fetch all models, then call /api/show for each to populate capabilities.
 * Returns enriched OllamaModel[] with capabilities, parameter size, etc.
 */
export async function listOllamaModelsEnriched(
  endpoint: string = DEFAULT_OLLAMA_ENDPOINT,
): Promise<OllamaModel[]> {
  const names = await listOllamaModels(endpoint);

  // Show details for each model in parallel (capped concurrency)
  const enriched: OllamaModel[] = [];
  const CONCURRENCY = 4;

  for (let i = 0; i < names.length; i += CONCURRENCY) {
    const batch = names.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (name) => {
        const info = await showOllamaModel(name, endpoint);

        // Extract native embedding dimensions from model_info
        // The key pattern is "{architecture}.embedding_length"
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

/**
 * Return only models that have "vision" in their capabilities list.
 */
export function filterVisionModels(models: OllamaModel[]): OllamaModel[] {
  return models.filter((m) =>
    m.capabilities?.some((c) => c.toLowerCase().includes("vision")),
  );
}

/**
 * Return only models whose name matches embedding/bge patterns.
 * i.e. names containing "embed" or "bge" (case-insensitive).
 */
export function filterEmbeddingModels(models: OllamaModel[]): OllamaModel[] {
  const pattern = /embed|bge/i;
  return models.filter((m) => pattern.test(m.name));
}

// ─── Chat API (Vision / Image Processing) ─────────────────────────────────

interface OllamaChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  images?: string[];
}

/**
 * Send a chat request to Ollama with optional images.
 * stream: false → single JSON response.
 * keep_alive: 0 → unload model immediately after response to free VRAM.
 * num_predict → max tokens to prevent infinite generation.
 */
export async function chatOllama(
  model: string,
  messages: OllamaChatMessage[],
  endpoint: string = DEFAULT_OLLAMA_ENDPOINT,
  signal?: AbortSignal,
  options?: {
    num_ctx?: number;
    keep_alive?: number | string;
    num_predict?: number;
  },
): Promise<string> {
  const res = await fetch(`${endpoint}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      keep_alive: options?.keep_alive ?? 0,
      options: {
        ...(options?.num_ctx && { num_ctx: options.num_ctx }),
        ...(options?.num_predict && { num_predict: options.num_predict }),
      },
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Ollama chat (${model}): ${res.status} — ${text}`);
  }

  const json = await res.json();
  return json.message?.content ?? "";
}

// ─── Image Processing ─────────────────────────────────────────────────────

/**
 * Process a single image with Ollama vision model.
 */
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
    },
  );
}

// ─── PDF Page-by-Page Processing (Vision) ─────────────────────────────────

/**
 * Process a PDF page-by-page using Ollama vision model.
 * Each page is rendered to a PNG image, then sent as a vision request.
 */
export async function processPdfWithOllama(
  model: string,
  pdfFile: File,
  prompt: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
  endpoint?: string,
): Promise<string> {
  // Use pdfjs-dist to render each page to a canvas → PNG → base64
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await pdfFile.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  
  // Handle cancellation during PDF load
  if (signal?.aborted) {
    loadingTask.destroy();
    throw new DOMException("Aborted", "AbortError");
  }
  
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const pageTexts: string[] = [];

  try {
    for (let i = 1; i <= totalPages; i++) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      let page: Awaited<ReturnType<typeof pdf.getPage>> | null = null;

      try {
        onProgress?.(
          ((i - 0.5) / totalPages) * 100,
          `Processing page ${i}/${totalPages}…`,
        );

        page = await pdf.getPage(i);
        // Scale 1.0 = native PDF resolution, good for OCR without excessive file size
        const viewport = page.getViewport({ scale: 1.0 });

        // Render page to an OffscreenCanvas (no DOM needed)
        const canvas = new OffscreenCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext("2d")!;
        await page.render({
          canvasContext: ctx as unknown as CanvasRenderingContext2D,
          viewport,
          canvas: canvas as unknown as HTMLCanvasElement,
        } as unknown as Parameters<typeof page.render>[0]).promise;

        // Convert to JPEG (quality 0.92) for ~70-80% smaller payloads vs PNG
        // while preserving OCR accuracy — ideal for vision LLM inference
        const blob = await canvas.convertToBlob({
          type: "image/jpeg",
          quality: 0.92,
        });
        const b64 = await fileToBase64(blob);

        const text = await chatOllama(
          model,
          [{
            role: "user",
            content: `[Page ${i}/${totalPages}] ${prompt}`,
            images: [b64],
          }],
          endpoint,
          signal,
          {
            keep_alive: 0,
            num_ctx: OLLAMA_CONFIG.VISION_NUM_CTX,
            num_predict: OLLAMA_CONFIG.MAX_TOKENS_VISION,
          },
        );

        pageTexts.push(`--- Page ${i} ---\n${text}`);

        // Clean up page object immediately to free memory
        page.cleanup();
        page = null;

        // Yield to browser event loop and check for cancellation
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if ((err as Error).name === "AbortError") throw err;
        pageTexts.push(`--- Page ${i} ---\n[ERROR] ${msg}`);
      } finally {
        // Ensure page cleanup even on error
        if (page) {
          try {
            page.cleanup();
          } catch {
            // Ignore cleanup errors
          }
        }
      }

      onProgress?.(
        (i / totalPages) * 100,
        `Completed page ${i}/${totalPages}`,
      );
    }
  } finally {
    // Clean up PDF document - this is critical for freeing memory
    try {
      await pdf.cleanup();
      pdf.destroy();
    } catch {
      // Ignore cleanup errors
    }
  }

  return pageTexts.join("\n\n");
}

// ─── Embeddings ───────────────────────────────────────────────────────────

/**
 * Generate embeddings using Ollama's /api/embed endpoint.
 * Supports batch input (array of strings).
 * keep_alive: 0 → unload model immediately after final batch to free VRAM.
 */
export async function generateOllamaEmbeddings(
  model: string,
  texts: string[],
  endpoint: string = DEFAULT_OLLAMA_ENDPOINT,
  batchSize: number = 64,
  dimensions?: number,
): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
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
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Ollama embed (${model}): ${res.status} — ${errText}`);
    }

    const json = await res.json();
    // /api/embed returns { embeddings: number[][] }
    const embeddings: number[][] = json.embeddings ?? [];
    if (embeddings.length === 0) {
      throw new Error(`Ollama embed returned no embeddings for batch starting at index ${i}`);
    }
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}
