import type { ProgressCallback, PageStreamCallback } from "./types";

export const DEFAULT_DOCLING_ENDPOINT = "http://localhost:8020";

export interface DoclingParseOptions {
  endpoint: string;
  vllmUrl?: string;
  timeout?: number;
  onProgress?: ProgressCallback;
  onPageStream?: PageStreamCallback;
  signal?: AbortSignal;
}

export async function checkDoclingHealth(endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(`${endpoint.replace(/\/+$/, "")}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}

export async function parseWithDocling(
  file: File,
  opts: DoclingParseOptions,
): Promise<string> {
  const base = opts.endpoint.replace(/\/+$/, "");
  const form = new FormData();
  form.append("file", file);
  form.append("vllm_url", opts.vllmUrl ?? "http://localhost:8000/v1/chat/completions");
  form.append("timeout", String(opts.timeout ?? 120));

  const res = await fetch(`${base}/docling/parse`, {
    method: "POST",
    body: form,
    signal: opts.signal,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Docling parse failed (HTTP ${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return data.markdown;
}

export async function parseWithDoclingStream(
  file: File,
  opts: DoclingParseOptions,
): Promise<string> {
  const base = opts.endpoint.replace(/\/+$/, "");
  const form = new FormData();
  form.append("file", file);
  form.append("vllm_url", opts.vllmUrl ?? "http://localhost:8000/v1/chat/completions");
  form.append("timeout", String(opts.timeout ?? 120));

  const res = await fetch(`${base}/docling/parse/stream`, {
    method: "POST",
    body: form,
    signal: opts.signal,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Docling stream parse failed (HTTP ${res.status}): ${errBody}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let finalMarkdown = "";
  let pageNum = 0;
  let eventType = "";
  const collectedPages = new Map<number, string>();

  function processSSELines(lines: string[]) {
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith("data: ") && eventType) {
        try {
          const data = JSON.parse(line.slice(6));

          switch (eventType) {
            case "progress": {
              const pct = data.total_pages
                ? Math.round((data.page / data.total_pages) * 100)
                : 0;
              opts.onProgress?.(pct, `Page ${data.page}/${data.total_pages || "?"} — ${data.status}`);
              break;
            }
            case "page_result": {
              pageNum = data.page;
              const pageMd = data.markdown ?? "";
              collectedPages.set(pageNum, pageMd);
              opts.onPageStream?.(pageNum, pageMd, pageMd);
              break;
            }
            case "complete": {
              finalMarkdown = data.markdown ?? "";
              opts.onProgress?.(100, "Complete");
              break;
            }
            case "error": {
              throw new Error(data.message || "Docling server error");
            }
          }
        } catch (e) {
          if (e instanceof Error && e.message.includes("Docling server error")) throw e;
        }
        eventType = "";
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (value) buffer += decoder.decode(value);
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep incomplete line in buffer
    processSSELines(lines);
  }

  if (buffer.trim()) {
    const remaining = buffer.split("\n");
    processSSELines(remaining);
  }

  if (!finalMarkdown && collectedPages.size > 0) {
    finalMarkdown = Array.from(collectedPages.entries())
      .sort(([a], [b]) => a - b)
      .map(([, md]) => md)
      .join("\n\n");
  }

  return finalMarkdown;
}

export async function processPdfWithDocling(
  file: File,
  opts: DoclingParseOptions,
): Promise<string> {
  if (opts.onProgress || opts.onPageStream) {
    return parseWithDoclingStream(file, opts);
  }
  return parseWithDocling(file, opts);
}
