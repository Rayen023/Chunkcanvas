/**
 * Client-side file parsers — dynamically loaded to keep bundle small.
 */

import { PIPELINE } from "./constants";
import type { PageStreamCallback, PdfEngine, ProgressCallback } from "./types";

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

export async function getExcelSheets(file: File): Promise<string[]> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);
  return workbook.worksheets.map((ws) => ws.name);
}

export async function getExcelColumns(file: File, sheetName?: string): Promise<string[]> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);
  
  const sheet = sheetName 
    ? workbook.getWorksheet(sheetName) 
    : workbook.worksheets[0];
    
  if (!sheet) return [];
  
  // Get the first row (header)
  const firstRow = sheet.getRow(1);
  if (!firstRow) return [];
  
  const columns: string[] = [];
  firstRow.eachCell((cell) => {
    const value = cell.value;
    if (value && typeof value === "object") {
      if ("result" in value) columns.push(String(value.result ?? ""));
      else if ("richText" in value && Array.isArray(value.richText)) {
        columns.push(value.richText.map((rt: { text?: string }) => rt.text ?? "").join(""));
      }
      else if ("text" in value) columns.push(String(value.text));
      else columns.push(String(value));
    } else {
      columns.push(String(value ?? ""));
    }
  });
  
  return columns.filter(c => c.trim().length > 0);
}

export async function parseExcel(
  file: File,
  selectedColumns: string[],
  sheetName?: string,
): Promise<{ text: string; rows: string[] }> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);
  
  const sheet = sheetName 
    ? workbook.getWorksheet(sheetName) 
    : workbook.worksheets[0];
    
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);

  // Find column indices
  const firstRow = sheet.getRow(1);
  const colIndices: number[] = [];
  
  // Create a map of column name -> index
  const colMap = new Map<string, number>();
  firstRow.eachCell((cell, colNumber) => {
    let val = "";
    const value = cell.value;
    if (value && typeof value === "object") {
      if ("result" in value) val = String(value.result ?? "");
      else if ("richText" in value && Array.isArray(value.richText)) {
        val = value.richText.map((rt: { text?: string }) => rt.text ?? "").join("");
      }
      else if ("text" in value) val = String(value.text);
      else val = String(value);
    } else {
      val = String(value ?? "");
    }
    colMap.set(val, colNumber);
  });

  for (const colName of selectedColumns) {
    const idx = colMap.get(colName);
    if (idx !== undefined) {
      colIndices.push(idx);
    }
  }

  if (colIndices.length === 0) throw new Error(`No columns found from selection`);

  const rows: string[] = [];
  
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header
    
    // For each row, collect values from selected columns in order
    for (const colIndex of colIndices) {
        const cell = row.getCell(colIndex);
        const value = cell.value;
        let cellText = "";
        
        if (value !== null && value !== undefined) {
          if (typeof value === "object") {
            if ("result" in value) cellText = String(value.result ?? "");
            else if ("richText" in value && Array.isArray(value.richText)) {
              cellText = value.richText.map((rt: { text?: string }) => rt.text ?? "").join("");
            }
            else if ("text" in value) cellText = String(value.text);
            else cellText = String(value);
          } else {
            cellText = String(value);
          }
        }
        
        if (cellText.trim().length > 0) {
            rows.push(cellText);
        }
    }
  });

  const filteredRows = rows.filter((r) => r.trim().length > 0);
  return { text: filteredRows.join("\n\n"), rows: filteredRows };
}

// ─── Main Parser Dispatch ─────────────────────────────────────────────────

export interface ParseOptions {
  pipeline: string;
  file: File;
  // OpenRouter-specific
  openrouterApiKey?: string;
  openrouterModel?: string;
  openrouterPrompt?: string;
  openrouterPagesPerBatch?: number;
  pdfEngine?: PdfEngine;
  // Ollama-specific
  ollamaEndpoint?: string;
  ollamaModel?: string;
  ollamaPrompt?: string;
  // vLLM-specific
  vllmEndpoint?: string;
  vllmModel?: string;
  vllmPrompt?: string;
  // Docling (granite-docling via vLLM)
  doclingEndpoint?: string;
  // Excel-specific
  excelColumn?: string;
  excelSelectedColumns?: string[];
  excelSheet?: string;
  // Progress, cancellation & streaming
  onProgress?: ProgressCallback;
  signal?: AbortSignal;
  /** Real-time token stream for Ollama/vLLM PDF vision processing */
  onPageStream?: PageStreamCallback;
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

    // ── Excel & CSV ──────────────────────────────────────────────
    case PIPELINE.EXCEL_SPREADSHEET:
    case PIPELINE.CSV_SPREADSHEET: {
      const cols = opts.excelSelectedColumns && opts.excelSelectedColumns.length > 0 
        ? opts.excelSelectedColumns 
        : (opts.excelColumn ? [opts.excelColumn] : []);
        
      if (cols.length === 0) throw new Error("At least one column must be selected");
      
      const { text, rows } = await parseExcel(opts.file, cols, opts.excelSheet);
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
        opts.openrouterPagesPerBatch,
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

    // ── Ollama PDF (Vision) ──────────────────────────────────────
    case PIPELINE.OLLAMA_PDF: {
      const { processPdfWithOllama } = await import("./ollama");
      const content = await processPdfWithOllama(
        opts.ollamaModel!,
        opts.file,
        opts.ollamaPrompt!,
        opts.onProgress,
        opts.signal,
        opts.ollamaEndpoint,
        opts.onPageStream,
      );
      return { content };
    }

    // ── Ollama Image (Vision) ────────────────────────────────────
    case PIPELINE.OLLAMA_IMAGE: {
      const { processImageWithOllama } = await import("./ollama");
      const content = await processImageWithOllama(
        opts.ollamaModel!,
        opts.file,
        opts.ollamaPrompt!,
        opts.ollamaEndpoint,
        opts.signal,
      );
      return { content };
    }

    // ── vLLM PDF (Vision) ──────────────────────────────────────
    case PIPELINE.VLLM_PDF: {
      const { processPdfWithVllm } = await import("./vllm");
      const content = await processPdfWithVllm(
        opts.vllmModel!,
        opts.file,
        opts.vllmPrompt!,
        opts.onProgress,
        opts.signal,
        opts.vllmEndpoint,
        opts.onPageStream,
      );
      return { content };
    }

    // ── Docling PDF ───────────────────────────────────────────
    case PIPELINE.DOCLING_PDF: {
      const { processPdfWithDocling } = await import("./docling");
      const vllmBase = (opts.vllmEndpoint ?? "http://localhost:8000").replace(/\/+$/, "");
      const content = await processPdfWithDocling(opts.file, {
        endpoint: opts.doclingEndpoint ?? "http://localhost:8020",
        vllmUrl: `${vllmBase}/v1/chat/completions`,
        onProgress: opts.onProgress,
        onPageStream: opts.onPageStream,
        signal: opts.signal,
      });
      return { content };
    }

    // ── vLLM Image (Vision) ────────────────────────────────────
    case PIPELINE.VLLM_IMAGE: {
      const { chatVllm } = await import("./vllm");
      
      // Convert image to data URL
      const reader = new FileReader();
      const dataUrlPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(opts.file);
      });
      const dataUrl = await dataUrlPromise;

      const content = await chatVllm(
        opts.vllmModel!,
        [{
          role: "user",
          content: [
            { type: "text", text: opts.vllmPrompt! },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        }],
        opts.vllmEndpoint,
        opts.signal,
        {
          max_tokens: 4096,
          temperature: 0.2,
        }
      );
      return { content };
    }

    // ── vLLM Audio (Transcription) ─────────────────────────────
    case PIPELINE.VLLM_AUDIO: {
      const { transcribeAudioVllm } = await import("./vllm");
      const content = await transcribeAudioVllm(
        opts.vllmModel!,
        opts.file,
        opts.vllmEndpoint,
        opts.vllmPrompt,
        opts.signal,
      );
      return { content };
    }

    // ── vLLM Video (Understanding) ─────────────────────────────
    case PIPELINE.VLLM_VIDEO: {
      const { processVideoWithVllm } = await import("./vllm");
      const content = await processVideoWithVllm(
        opts.vllmModel!,
        opts.file,
        opts.vllmPrompt!,
        opts.vllmEndpoint,
        opts.signal,
        opts.onProgress,
      );
      return { content };
    }

    default:
      throw new Error(`Unsupported pipeline: ${opts.pipeline}`);
  }
}
