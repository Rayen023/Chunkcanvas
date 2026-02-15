import { PIPELINE } from "./constants";
import type { PageStreamCallback, PdfEngine, ProgressCallback } from "./types";

async function parsePdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
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

export async function getExcelSheets(file: File): Promise<string[]> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);
  return workbook.worksheets.map((ws) => ws.name);
}

export async function getExcelColumns(
  file: File,
  sheetName?: string,
): Promise<string[]> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);

  const sheet = sheetName
    ? workbook.getWorksheet(sheetName)
    : workbook.worksheets[0];

  if (!sheet) return [];

  const firstRow = sheet.getRow(1);
  if (!firstRow) return [];

  const columns: string[] = [];
  firstRow.eachCell((cell) => {
    const value = cell.value;
    if (value && typeof value === "object") {
      if ("result" in value) columns.push(String(value.result ?? ""));
      else if ("richText" in value && Array.isArray(value.richText)) {
        columns.push(
          value.richText.map((rt: { text?: string }) => rt.text ?? "").join(""),
        );
      } else if ("text" in value) columns.push(String(value.text));
      else columns.push(String(value));
    } else {
      columns.push(String(value ?? ""));
    }
  });

  return columns.filter((c) => c.trim().length > 0);
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

  const firstRow = sheet.getRow(1);
  const colIndices: number[] = [];

  const colMap = new Map<string, number>();
  firstRow.eachCell((cell, colNumber) => {
    let val = "";
    const value = cell.value;
    if (value && typeof value === "object") {
      if ("result" in value) val = String(value.result ?? "");
      else if ("richText" in value && Array.isArray(value.richText)) {
        val = value.richText
          .map((rt: { text?: string }) => rt.text ?? "")
          .join("");
      } else if ("text" in value) val = String(value.text);
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

  if (colIndices.length === 0)
    throw new Error(`No columns found from selection`);

  const rows: string[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    for (const colIndex of colIndices) {
      const cell = row.getCell(colIndex);
      const value = cell.value;
      let cellText = "";

      if (value !== null && value !== undefined) {
        if (typeof value === "object") {
          if ("result" in value) cellText = String(value.result ?? "");
          else if ("richText" in value && Array.isArray(value.richText)) {
            cellText = value.richText
              .map((rt: { text?: string }) => rt.text ?? "")
              .join("");
          } else if ("text" in value) cellText = String(value.text);
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

export interface ParseOptions {
  pipeline: string;
  file: File;
  openrouterApiKey?: string;
  openrouterModel?: string;
  openrouterPrompt?: string;
  openrouterPagesPerBatch?: number;
  pdfEngine?: PdfEngine;
  ollamaEndpoint?: string;
  ollamaModel?: string;
  ollamaPrompt?: string;
  vllmEndpoint?: string;
  vllmModel?: string;
  vllmPrompt?: string;
  doclingEndpoint?: string;
  excelColumn?: string;
  excelSelectedColumns?: string[];
  excelSheet?: string;
  onProgress?: ProgressCallback;
  signal?: AbortSignal;
  onPageStream?: PageStreamCallback;
}

export interface ParseResult {
  content: string;
  excelRows?: string[];
}

export async function parseDocument(opts: ParseOptions): Promise<ParseResult> {
  const ext = opts.file.name.split(".").pop()?.toLowerCase() ?? "";

  switch (opts.pipeline) {
    case PIPELINE.SIMPLE_TEXT: {
      let content: string;
      if (ext === "pdf") content = await parsePdfText(opts.file);
      else if (ext === "docx") content = await parseDocx(opts.file);
      else content = await parsePlainText(opts.file);
      return { content };
    }

    case PIPELINE.EXCEL_SPREADSHEET:
    case PIPELINE.CSV_SPREADSHEET: {
      const cols =
        opts.excelSelectedColumns && opts.excelSelectedColumns.length > 0
          ? opts.excelSelectedColumns
          : opts.excelColumn
            ? [opts.excelColumn]
            : [];

      if (cols.length === 0)
        throw new Error("At least one column must be selected");

      const { text, rows } = await parseExcel(opts.file, cols, opts.excelSheet);
      return { content: text, excelRows: rows };
    }

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

    case PIPELINE.DOCLING_PDF: {
      const { processPdfWithDocling } = await import("./docling");
      const vllmBase = (opts.vllmEndpoint ?? "http://localhost:8000").replace(
        /\/+$/,
        "",
      );
      const content = await processPdfWithDocling(opts.file, {
        endpoint: opts.doclingEndpoint ?? "http://localhost:8020",
        vllmUrl: `${vllmBase}/v1/chat/completions`,
        onProgress: opts.onProgress,
        onPageStream: opts.onPageStream,
        signal: opts.signal,
      });
      return { content };
    }

    case PIPELINE.VLLM_IMAGE: {
      const { chatVllm } = await import("./vllm");

      const reader = new FileReader();
      const dataUrlPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(opts.file);
      });
      const dataUrl = await dataUrlPromise;

      const content = await chatVllm(
        opts.vllmModel!,
        [
          {
            role: "user",
            content: [
              { type: "text", text: opts.vllmPrompt! },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        opts.vllmEndpoint,
        opts.signal,
        {
          max_tokens: 4096,
          temperature: 0.2,
        },
      );
      return { content };
    }

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
