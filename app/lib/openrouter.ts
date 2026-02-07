/**
 * OpenRouter API client — browser-side fetch with retry logic.
 */
import {
  OPENROUTER_API_URL,
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_HEADERS_BASE,
  OPENROUTER_MAX_RETRIES,
  OPENROUTER_RETRY_DELAY_MS,
  OPENROUTER_TIMEOUT_MS,
  FALLBACK_MODELS,
} from "./constants";
import type { Modality, OpenRouterModel, PdfEngine, ProgressCallback } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────

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
      // strip dataURL prefix if present
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

// ─── Core API Call with Retry ─────────────────────────────────────────────

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

// ─── Fetch & Filter Models ────────────────────────────────────────────────

let _modelsCache: { data: OpenRouterModel[]; ts: number } | null = null;
const CACHE_TTL = 600_000; // 10 minutes

export async function fetchAvailableModels(
  apiKey: string,
): Promise<OpenRouterModel[]> {
  if (_modelsCache && Date.now() - _modelsCache.ts < CACHE_TTL) {
    return _modelsCache.data;
  }

  try {
    const res = await fetch(`${OPENROUTER_API_URL}/models`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
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
    // Return fallback
    return Object.values(FALLBACK_MODELS);
  }
}

export function getModelsForModality(
  models: OpenRouterModel[],
  modality: Modality,
): OpenRouterModel[] {
  const filtered = models.filter((m) =>
    m.input_modalities.includes(modality),
  );

  // Sort default model first
  filtered.sort((a, b) => {
    if (a.id === OPENROUTER_DEFAULT_MODEL) return -1;
    if (b.id === OPENROUTER_DEFAULT_MODEL) return 1;
    return a.name.localeCompare(b.name);
  });

  return filtered;
}

// ─── PDF Page-by-Page Processing ──────────────────────────────────────────

export async function processPdfWithOpenRouter(
  apiKey: string,
  model: string,
  pdfFile: File,
  prompt: string,
  pdfEngine: PdfEngine,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<string> {
  // Dynamically import pdf-lib (heavy library → code-split)
  const { PDFDocument } = await import("pdf-lib");

  const fileBytes = await pdfFile.arrayBuffer();
  const pdfDoc = await PDFDocument.load(fileBytes);
  const totalPages = pdfDoc.getPageCount();
  const pageTexts: string[] = [];

  for (let i = 0; i < totalPages; i++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    try {
      // Extract single page as a new PDF
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);
      const singlePageBytes = await singlePageDoc.save();
      
      // Convert to base64 in chunks to avoid "Maximum call stack size exceeded"
      const u8 = new Uint8Array(singlePageBytes);
      let binary = "";
      const len = u8.byteLength;
      const CHUNK_SIZE = 0x8000; // 32k
      for (let k = 0; k < len; k += CHUNK_SIZE) {
        const chunk = u8.subarray(k, k + CHUNK_SIZE);
        // @ts-expect-error - apply accepts typed array
        binary += String.fromCharCode.apply(null, chunk);
      }
      const b64 = btoa(binary);

      const messages = [
        {
          role: "user",
          content: [
            { type: "text", text: `[Page ${i + 1}/${totalPages}] ${prompt}` },
            {
              type: "file",
              file: {
                filename: `page_${i + 1}.pdf`,
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
      pageTexts.push(`--- Page ${i + 1} ---\n${text}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      pageTexts.push(`--- Page ${i + 1} ---\n[ERROR] ${msg}`);
    }

    onProgress?.(((i + 1) / totalPages) * 100, `Parsing PDF… ${Math.round(((i + 1) / totalPages) * 100)}%`);
  }

  return pageTexts.join("\n\n");
}

// ─── Image Processing ─────────────────────────────────────────────────────

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

// ─── Audio Processing ─────────────────────────────────────────────────────

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

// ─── Video Processing ─────────────────────────────────────────────────────

export async function processVideoWithOpenRouter(
  apiKey: string,
  model: string,
  file: File,
  prompt: string,
  signal?: AbortSignal,
  onProgress?: ProgressCallback,
): Promise<string> {
  const MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB hard limit

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
