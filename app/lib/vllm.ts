/**
 * vLLM API client — OpenAI-compatible browser-side fetch for local LLM inference.
 *
 * Endpoints used:
 *   GET  /v1/models           — list available models
 *   POST /v1/chat/completions — multimodal chat (vision → images as base64 data URLs)
 *   POST /v1/embeddings       — generate embeddings
 */

import { DEFAULT_VLLM_ENDPOINT } from "./constants";
import type { PageStreamCallback, ProgressCallback } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────

export interface VllmModel {
  id: string;
  object: "model";
  owned_by: string;
  max_model_len?: number;
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
      resolve(result); // vLLM expects full data URL (e.g. data:image/jpeg;base64,...)
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsDataURL(file);
  });
}

// ─── Health / Status Check ────────────────────────────────────────────────

export async function checkVllmHealth(
  endpoint: string = DEFAULT_VLLM_ENDPOINT,
): Promise<boolean> {
  try {
    const res = await fetch(`${endpoint}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── List Models ──────────────────────────────────────────────────────────

/** Fetch models from /v1/models */
export async function listVllmModels(
  endpoint: string = DEFAULT_VLLM_ENDPOINT,
): Promise<string[]> {
  const res = await fetch(`${endpoint}/v1/models`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`vLLM /v1/models: ${res.status}`);
  const json = await res.json();
  return ((json.data ?? []) as VllmModel[]).map((m) => m.id);
}

// ─── Chat API (Vision / Image Processing) ─────────────────────────────────

interface VllmChatMessage {
  role: "user" | "assistant" | "system";
  content: string | (
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
    | { type: "video_url"; video_url: { url: string } }
  )[];
}

/**
 * Send a chat request to vLLM with optional images or video.
 * Uses streaming mode (Server-Sent Events).
 */
export async function chatVllm(
  model: string,
  messages: VllmChatMessage[],
  endpoint: string = DEFAULT_VLLM_ENDPOINT,
  signal?: AbortSignal,
  options?: {
    max_tokens?: number;
    temperature?: number;
  },
  onToken?: (token: string) => void,
): Promise<string> {
  const res = await fetch(`${endpoint}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: options?.max_tokens ?? 4096,
      temperature: options?.temperature ?? 0.0,
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`vLLM chat (${model}): ${res.status} — ${text}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("vLLM chat: no response body");

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
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        
        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const obj = JSON.parse(data);
          const token = obj.choices?.[0]?.delta?.content;
          if (token) {
            chunks.push(token);
            onToken?.(token);
          }
        } catch {
          // skip malformed JSON
        }
      }

      if (streamDone) break;
    }
  } finally {
    reader.cancel().catch(() => {});
    reader.releaseLock();
  }

  return chunks.join("");
}

// ─── PDF Page-by-Page Processing (Vision) ─────────────────────────────────

async function renderPageToDataUrl(
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

    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.90 });
    return fileToBase64(blob);
  } finally {
    page.cleanup();
  }
}

export async function processPdfWithVllm(
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
        return { pageNum, dataUrl: await renderPageToDataUrl(pdf, pageNum) };
      }),
    );

    onProgress?.(0, `Sending ${totalPages} pages to vLLM…`);

    const pageAccumulators: string[] = new Array(totalPages).fill("");

    // Process pages concurrently
    const promises = rendered.map(async ({ pageNum, dataUrl }) => {
      try {
        const text = await chatVllm(
          model,
          [{
            role: "user",
            content: [
              { type: "text", text: `[Page ${pageNum}/${totalPages}] ${prompt}` },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          }],
          endpoint,
          signal,
          {
            max_tokens: 4096,
            temperature: 0.2,
          },
          onPageStream
            ? (token: string) => {
                pageAccumulators[pageNum - 1] += token;
                onPageStream(pageNum, token, pageAccumulators[pageNum - 1]);
              }
            : undefined,
        );
        pageTexts[pageNum - 1] = `--- Page ${pageNum} ---
${text}`;
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
    Promise.resolve()
      .then(() => pdf.cleanup())
      .then(() => pdf.destroy())
      .catch(() => {});
  }

  return pageTexts.filter(Boolean).join("\n\n");
}

// ─── Video Processing ─────────────────────────────────────────────────────

export async function processVideoWithVllm(
  model: string,
  file: File,
  prompt: string,
  endpoint: string = DEFAULT_VLLM_ENDPOINT,
  signal?: AbortSignal,
  onProgress?: ProgressCallback,
): Promise<string> {
  const MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB hard limit

  if (file.size === 0) throw new Error(`Video file "${file.name}" is empty`);
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(`Video file too large (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
  }

  onProgress?.(10, "Encoding video…");

  const dataUrl = await fileToBase64(file);

  onProgress?.(50, "Sending to vLLM…");

  const messages: VllmChatMessage[] = [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "video_url", video_url: { url: dataUrl } },
      ],
    },
  ];

  return chatVllm(
    model,
    messages,
    endpoint,
    signal,
    { max_tokens: 4096, temperature: 0.2 }
  );
}

// ─── Embeddings ───────────────────────────────────────────────────────────

export async function generateVllmEmbeddings(
  model: string,
  texts: string[],
  endpoint: string = "http://localhost:8001",
  batchSize: number = 32,
  dimensions?: number,
): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const res = await fetch(`${endpoint}/v1/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: batch,
        ...(dimensions && dimensions > 0 ? { dimensions } : {}),
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`vLLM embed (${model}): ${res.status} — ${errText}`);
    }

    const json = await res.json();
    const embeddings: number[][] = (json.data ?? []).map(
      (item: { embedding: number[] }) => item.embedding,
    );
    if (embeddings.length === 0) {
      throw new Error(`vLLM embed returned no embeddings for batch starting at index ${i}`);
    }
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

// ─── Audio Transcription ──────────────────────────────────────────────────

/**
 * Transcribe an audio file using vLLM's OpenAI-compatible /v1/audio/transcriptions endpoint.
 */
export async function transcribeAudioVllm(
  model: string,
  audioFile: File,
  endpoint: string = DEFAULT_VLLM_ENDPOINT,
  prompt?: string,
  signal?: AbortSignal,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", audioFile);
  formData.append("model", model);
  formData.append("response_format", "text");
  if (prompt) {
    formData.append("prompt", prompt);
  }

  const res = await fetch(`${endpoint}/v1/audio/transcriptions`, {
    method: "POST",
    body: formData,
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`vLLM transcription (${model}): ${res.status} — ${text}`);
  }

  // If response_format is "text", the body is the transcription.
  // Otherwise, it's usually JSON { "text": "..." }
  const result = await res.text();
  try {
    const json = JSON.parse(result);
    return json.text || result;
  } catch {
    return result;
  }
}
