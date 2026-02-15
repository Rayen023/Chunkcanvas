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
  DOCLING_PDF: "Docling — PDF Parsing (IBM Granite Docling)",
} as const;

export type PipelineName = (typeof PIPELINE)[keyof typeof PIPELINE];

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
  [PIPELINE.DOCLING_PDF]: "file",
};

export interface OpenRouterModel {
  id: string;
  name: string;
  input_modalities: string[];
}

export interface OpenRouterModelFull extends OpenRouterModel {
  output_modalities: string[];
  context_length: number;
  dimensions?: number | null;
  pricing: {
    prompt: string;
    completion: string;
  };
}

export type EmbeddingProvider =
  | "voyage"
  | "openrouter"
  | "ollama"
  | "vllm"
  | "cohere";

export type PdfEngine = "native" | "pdf-text" | "mistral-ocr";

export interface PdfEngineOption {
  key: PdfEngine;
  label: string;
  description: string;
}

export interface VoyageModel {
  key: string;
  label: string;
  dimensions: number;
  description: string;
}

export interface CohereModel {
  key: string;
  label: string;
  dimensions: number;
  description: string;
}

export interface PineconeEnvironment {
  key: string;
  label: string;
  cloud: string;
  region: string;
}

export type ChromaMode = "local" | "cloud";

export type VectorDbProvider = "pinecone" | "chroma" | "mongodb" | "faiss";

export type FaissMetric = "cosine" | "l2" | "ip";
export type FaissDbMode = "existing" | "create";

export type ChunkingType = "recursive";

export interface ChunkingParams {
  chunkingType: ChunkingType;
  separators: string[];
  chunkSize: number;
  chunkOverlap: number;
}

export interface OpenRouterFormData {
  apiKey: string;
  model: string;
  pdfEngine: PdfEngine;
  prompt: string;
}

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

export interface ParsedFileResult {
  filename: string;
  content: string;
  excelRows?: string[];
  pipeline: string;
  cacheKey?: string;
}

export interface PineconeFieldMapping {
  idPrefix: string;
  textField: string;
  filenameField: string;
}

export interface MongodbIndexField {
  type: "vector" | "filter" | string;
  numDimensions?: number;
  similarity?: string;
  path: string;
}

export interface MongodbIndexDefinition {
  fields: MongodbIndexField[];
}

export interface MongodbIndex {
  name: string;
  status: string;
  latestDefinition?: MongodbIndexDefinition;
}

export interface MongodbFieldMapping {
  database: string;
  collection: string;
  indexName: string;
  vectorField: string;
  textField: string;
  metadataField: string;
  dimensions: number;
  similarity: "cosine" | "euclidean" | "dotProduct";
}

export interface ExtPipelineConfig {
  openrouterModel: string;
  openrouterPrompt: string;
  openrouterPagesPerBatch: number;
  pdfEngine: PdfEngine;
  ollamaEndpoint: string;
  ollamaModel: string;
  ollamaPrompt: string;
  vllmEndpoint: string;
  vllmModel: string;
  vllmPrompt: string;
  doclingEndpoint: string;
  excelSheet: string;
  excelSheets: string[];
  excelColumn: string;
  excelSelectedColumns: string[];
  excelColumns: string[];
}

export type ProgressCallback = (pct: number, message?: string) => void;

export type PageStreamCallback = (
  pageNum: number,
  token: string,
  fullPage: string,
) => void;
