// ─── Pipeline & Extension Types ───────────────────────────────────────────

export const PIPELINE = {
  SIMPLE_TEXT: "Simple Text",
  EXCEL_SPREADSHEET: "Excel Spreadsheet",
  CSV_SPREADSHEET: "CSV Spreadsheet",
  OPENROUTER_PDF: "OpenRouter — PDF Parsing (Multimodal LLM)",
  OPENROUTER_IMAGE: "OpenRouter — Image Parsing (Multimodal LLM)",
  OPENROUTER_AUDIO: "OpenRouter — Audio Parsing (Multimodal LLM)",
  OPENROUTER_VIDEO: "OpenRouter — Video Parsing (Multimodal LLM)",
  OLLAMA_PDF: "Ollama — PDF Parsing (Local Vision LLM)",
  OLLAMA_IMAGE: "Ollama — Image Parsing (Local Vision LLM)",
  VLLM_PDF: "vLLM — PDF Parsing (Local Vision LLM)",
  VLLM_IMAGE: "vLLM — Image Parsing (Local Vision LLM)",
  VLLM_AUDIO: "vLLM — Audio Transcription (OpenAI-compatible)",
  VLLM_VIDEO: "vLLM — Video Understanding (Local Video LLM)",
} as const;

export type PipelineName = (typeof PIPELINE)[keyof typeof PIPELINE];

// ─── Modality ─────────────────────────────────────────────────────────────

export type Modality = "file" | "image" | "audio" | "video";

export const PIPELINE_MODALITY: Record<string, Modality> = {
  [PIPELINE.OPENROUTER_PDF]: "file",
  [PIPELINE.OPENROUTER_IMAGE]: "image",
  [PIPELINE.OPENROUTER_AUDIO]: "audio",
  [PIPELINE.OPENROUTER_VIDEO]: "video",
  [PIPELINE.OLLAMA_PDF]: "file",
  [PIPELINE.OLLAMA_IMAGE]: "image",
  [PIPELINE.VLLM_PDF]: "file",
  [PIPELINE.VLLM_IMAGE]: "image",
  [PIPELINE.VLLM_AUDIO]: "audio",
  [PIPELINE.VLLM_VIDEO]: "video",
};

// ─── OpenRouter Model ─────────────────────────────────────────────────────

export interface OpenRouterModel {
  id: string;
  name: string;
  input_modalities: string[];
}

/** Extended model info with pricing & context window */
export interface OpenRouterModelFull extends OpenRouterModel {
  output_modalities: string[];
  context_length: number;
  /** Output embedding dimensions (null if unknown). Only present for embedding models. */
  dimensions?: number | null;
  pricing: {
    prompt: string;    // cost per token (string decimal)
    completion: string;
  };
}

// ─── Embedding Provider ──────────────────────────────────────────────────

export type EmbeddingProvider = "voyage" | "openrouter" | "ollama" | "vllm" | "cohere";

// ─── PDF Engine ───────────────────────────────────────────────────────────

export type PdfEngine = "native" | "pdf-text" | "mistral-ocr";

export interface PdfEngineOption {
  key: PdfEngine;
  label: string;
  description: string;
}

// ─── Voyage AI Model ─────────────────────────────────────────────────────

export interface VoyageModel {
  key: string;
  label: string;
  dimensions: number;
  description: string;
}

// ─── Cohere Model ────────────────────────────────────────────────────────

export interface CohereModel {
  key: string;
  label: string;
  dimensions: number;
  description: string;
}

// ─── Pinecone Environment ────────────────────────────────────────────────

export interface PineconeEnvironment {
  key: string;
  label: string;
  cloud: string;
  region: string;
}

// ─── Chunking Parameters ─────────────────────────────────────────────────

export type ChunkingType = "recursive" | "parent-child";

export interface ChunkingParams {
  chunkingType: ChunkingType;
  separators: string[];
  chunkSize: number;
  chunkOverlap: number;
}

// ─── OpenRouter Form Data ────────────────────────────────────────────────

export interface OpenRouterFormData {
  apiKey: string;
  model: string;
  pdfEngine: PdfEngine;
  prompt: string;
}

// ─── Full App State Types ────────────────────────────────────────────────

export interface EmbeddingResult {
  index: number;
  text: string;
  embedding: number[];
}

export interface ChunksJson {
  metadata: {
    source_file: string;
    pipeline: string;
    num_chunks: number;
  };
  chunks: { index: number; text: string }[];
}

export interface EmbeddingsJson {
  metadata: {
    source_file: string;
    pipeline: string;
    embedding_model: string;
    num_chunks: number;
    embedding_dimensions: number;
  };
  chunks: EmbeddingResult[];
}

// ─── Progress Callback ──────────────────────────────────────────────────

// ─── Multi-file Parsing Result ──────────────────────────────────────────

export interface ParsedFileResult {
  filename: string;
  content: string;
  excelRows?: string[];
  pipeline: string;
  /** Internal cache key used to reuse parses when settings match. */
  cacheKey?: string;
}

// ─── Pinecone Field Mapping ────────────────────────────────────────────

export interface PineconeFieldMapping {
  idPrefix: string;
  textField: string;
  filenameField: string;
}

// ─── Per-Extension Pipeline Config ─────────────────────────────────────

export interface ExtPipelineConfig {
  // OpenRouter
  openrouterModel: string;
  openrouterPrompt: string;
  openrouterPagesPerBatch: number;
  pdfEngine: PdfEngine;
  // Ollama
  ollamaEndpoint: string;
  ollamaModel: string;
  ollamaPrompt: string;
  // vLLM
  vllmEndpoint: string;
  vllmModel: string;
  vllmPrompt: string;
  // Excel / CSV
  excelSheet: string;
  excelSheets: string[];
  excelColumn: string;
  excelColumns: string[];
}

export type ProgressCallback = (pct: number, message?: string) => void;

/**
 * Called per streaming token during Ollama PDF processing.
 * @param pageNum  1-based page number
 * @param token    the incremental text token just received
 * @param fullPage the full accumulated text for this page so far
 */
export type PageStreamCallback = (
  pageNum: number,
  token: string,
  fullPage: string,
) => void;
