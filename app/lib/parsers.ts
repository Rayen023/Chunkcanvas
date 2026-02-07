/**
 * Client-side file parsers — dynamically loaded to keep bundle small.
 */

import { PIPELINE } from "./constants";
import type { PdfEngine, ProgressCallback } from "./types";

// ─── Simple Text Pipeline Parsers ─────────────────────────────────────────

async function parsePdfText(file: File): Promise<string> {
  // Use pdfjs-dist for text extraction
  const pdfjsLib = await import("pdfjs-dist");
  // Point worker to CDN to avoid bundling issues
  // Note: cdnjs might not have the latest version immediately, using unpkg as fallback
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? (item.str ?? "") : ""))
      .join(" ");
    pages.push(text);
  }

  return pages.join("\n\n");
}

async function parseDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function parsePlainText(file: File): Promise<string> {
  return file.text();
}

// ─── Excel Pipeline Parser ────────────────────────────────────────────────

export async function getExcelColumns(file: File): Promise<string[]> {
  const XLSX = await import("xlsx");
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    header: 1,
  });
  if (data.length === 0) return [];
  return Object.values(data[0] as Record<string, unknown>).map(String);
}

export async function parseExcel(
  file: File,
  columnName: string,
): Promise<{ text: string; rows: string[] }> {
  const XLSX = await import("xlsx");
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);

  const rows = data
    .map((row) => String(row[columnName] ?? ""))
    .filter((r) => r.trim().length > 0);

  return { text: rows.join("\n\n"), rows };
}

// ─── Main Parser Dispatch ─────────────────────────────────────────────────

export interface ParseOptions {
  pipeline: string;
  file: File;
  // OpenRouter-specific
  openrouterApiKey?: string;
  openrouterModel?: string;
  openrouterPrompt?: string;
  pdfEngine?: PdfEngine;
  // Excel-specific
  excelColumn?: string;
  // Progress & cancellation
  onProgress?: ProgressCallback;
  signal?: AbortSignal;
}

export interface ParseResult {
  content: string;
  excelRows?: string[];
}

export async function parseDocument(opts: ParseOptions): Promise<ParseResult> {
  const ext = opts.file.name.split(".").pop()?.toLowerCase() ?? "";

  switch (opts.pipeline) {
    // ── Simple Text ──────────────────────────────────────────────
    case PIPELINE.SIMPLE_TEXT: {
      let content: string;
      if (ext === "pdf") content = await parsePdfText(opts.file);
      else if (ext === "docx") content = await parseDocx(opts.file);
      else content = await parsePlainText(opts.file);
      return { content };
    }

    // ── Excel ────────────────────────────────────────────────────
    case PIPELINE.EXCEL_SPREADSHEET: {
      if (!opts.excelColumn) throw new Error("Excel column must be specified");
      const { text, rows } = await parseExcel(opts.file, opts.excelColumn);
      return { content: text, excelRows: rows };
    }

    // ── OpenRouter PDF ───────────────────────────────────────────
    case PIPELINE.OPENROUTER_PDF: {
      const { processPdfWithOpenRouter } = await import("./openrouter");
      const content = await processPdfWithOpenRouter(
        opts.openrouterApiKey!,
        opts.openrouterModel!,
        opts.file,
        opts.openrouterPrompt!,
        opts.pdfEngine ?? "native",
        opts.onProgress,
        opts.signal,
      );
      return { content };
    }

    // ── OpenRouter Image ─────────────────────────────────────────
    case PIPELINE.OPENROUTER_IMAGE: {
      const { processImageWithOpenRouter } = await import("./openrouter");
      const content = await processImageWithOpenRouter(
        opts.openrouterApiKey!,
        opts.openrouterModel!,
        opts.file,
        opts.openrouterPrompt!,
        opts.signal,
      );
      return { content };
    }

    // ── OpenRouter Audio ─────────────────────────────────────────
    case PIPELINE.OPENROUTER_AUDIO: {
      const { processAudioWithOpenRouter } = await import("./openrouter");
      const content = await processAudioWithOpenRouter(
        opts.openrouterApiKey!,
        opts.openrouterModel!,
        opts.file,
        opts.openrouterPrompt!,
        opts.signal,
      );
      return { content };
    }

    // ── OpenRouter Video ─────────────────────────────────────────
    case PIPELINE.OPENROUTER_VIDEO: {
      const { processVideoWithOpenRouter } = await import("./openrouter");
      const content = await processVideoWithOpenRouter(
        opts.openrouterApiKey!,
        opts.openrouterModel!,
        opts.file,
        opts.openrouterPrompt!,
        opts.signal,
        opts.onProgress,
      );
      return { content };
    }

    default:
      throw new Error(`Unsupported pipeline: ${opts.pipeline}`);
  }
}
