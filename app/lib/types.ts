// ─── Pipeline & Extension Types ───────────────────────────────────────────

export const PIPELINE = {
  SIMPLE_TEXT: "Simple Text",
  EXCEL_SPREADSHEET: "Excel Spreadsheet",
  OPENROUTER_PDF: "OpenRouter — PDF Parsing (Multimodal LLM)",
  OPENROUTER_IMAGE: "OpenRouter — Image Parsing (Multimodal LLM)",
  OPENROUTER_AUDIO: "OpenRouter — Audio Parsing (Multimodal LLM)",
  OPENROUTER_VIDEO: "OpenRouter — Video Parsing (Multimodal LLM)",
} as const;

export type PipelineName = (typeof PIPELINE)[keyof typeof PIPELINE];

// ─── Modality ─────────────────────────────────────────────────────────────

export type Modality = "file" | "image" | "audio" | "video";

export const PIPELINE_MODALITY: Record<string, Modality> = {
  [PIPELINE.OPENROUTER_PDF]: "file",
  [PIPELINE.OPENROUTER_IMAGE]: "image",
  [PIPELINE.OPENROUTER_AUDIO]: "audio",
  [PIPELINE.OPENROUTER_VIDEO]: "video",
};

// ─── OpenRouter Model ─────────────────────────────────────────────────────

export interface OpenRouterModel {
  id: string;
  name: string;
  input_modalities: string[];
}

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

// ─── Pinecone Environment ────────────────────────────────────────────────

export interface PineconeEnvironment {
  key: string;
  label: string;
  cloud: string;
  region: string;
}

// ─── Chunking Parameters ─────────────────────────────────────────────────

export interface ChunkingParams {
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

export type ProgressCallback = (pct: number, message?: string) => void;
