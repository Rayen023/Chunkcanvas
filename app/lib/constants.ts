import {
  PIPELINE,
  type PdfEngineOption,
  type VoyageModel,
  type CohereModel,
  type PineconeEnvironment,
  type OpenRouterModel,
  type OpenRouterModelFull,
} from "./types";

import generatedData from "./generated/models-data.json";

export { PIPELINE };

export const PIPELINE_ALLOWED_EXTENSIONS: Record<string, Set<string>> = {
  [PIPELINE.SIMPLE_TEXT]: new Set(["pdf", "docx", "txt", "md"]),
  [PIPELINE.EXCEL_SPREADSHEET]: new Set(["xlsx", "xls"]),
  [PIPELINE.CSV_SPREADSHEET]: new Set(["csv"]),
  [PIPELINE.OPENROUTER_PDF]: new Set(["pdf"]),
  [PIPELINE.OPENROUTER_IMAGE]: new Set([
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif",
    "bmp",
    "tiff",
    "tif",
  ]),
  [PIPELINE.OPENROUTER_AUDIO]: new Set([
    "wav",
    "mp3",
    "aiff",
    "aac",
    "ogg",
    "flac",
    "m4a",
  ]),
  [PIPELINE.OPENROUTER_VIDEO]: new Set([
    "mp4",
    "mpeg",
    "mov",
    "webm",
    "mkv",
    "avi",
  ]),
  [PIPELINE.OLLAMA_PDF]: new Set(["pdf"]),
  [PIPELINE.OLLAMA_IMAGE]: new Set([
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif",
    "bmp",
    "tiff",
    "tif",
  ]),
  [PIPELINE.VLLM_PDF]: new Set(["pdf"]),
  [PIPELINE.VLLM_IMAGE]: new Set([
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif",
    "bmp",
    "tiff",
    "tif",
  ]),
  [PIPELINE.VLLM_AUDIO]: new Set([
    "wav",
    "mp3",
    "aiff",
    "aac",
    "ogg",
    "flac",
    "m4a",
  ]),
  [PIPELINE.VLLM_VIDEO]: new Set(["mp4", "mpeg", "mov", "webm", "mkv", "avi"]),
  [PIPELINE.DOCLING_PDF]: new Set(["pdf"]),
};

export const ALL_ACCEPTED_EXTENSIONS = Array.from(
  new Set(Object.values(PIPELINE_ALLOWED_EXTENSIONS).flatMap((s) => [...s])),
).map((e) => `.${e}`);

export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";
export const OPENROUTER_DEFAULT_MODEL = "google/gemini-3-flash-preview";
export const OPENROUTER_MAX_RETRIES = 3;
export const OPENROUTER_RETRY_DELAY_MS = 2000;
export const OPENROUTER_TIMEOUT_MS = 120_000;

export const OPENROUTER_HEADERS_BASE = {
  "Content-Type": "application/json",
  "HTTP-Referer": "https://github.com/Rayen023/chunkcanvas",
  "X-Title": "ChunkCanvas",
};

export const PDF_ENGINES: PdfEngineOption[] =
  generatedData.pdfEngines as PdfEngineOption[];

export const FALLBACK_MODELS: Record<string, OpenRouterModel> =
  generatedData.openrouterParsingModels as Record<string, OpenRouterModel>;

export const DEFAULT_PROMPTS: Record<string, string> = {
  file: `Extract and return ALL text content from this PDF page exactly as it appears.
Preserve the structure (headings, lists, tables) as Markdown.
Keep the same language as the source document throughout your response.
Do NOT summarise, paraphrase, or omit any content — return the full page content.

If the page contains any figures, diagrams, charts, or images:
1. Mark the start with: [FIGURE_START: <brief_id>]
2. Provide a detailed technical caption that describes the figure's content,
   axes, labels, data trends, annotations, and any visible text.
3. Mark the end with: [FIGURE_END: <brief_id>]

Return ONLY the extracted document content (text + figure captions).
Do not add commentary or extra explanation outside the document content.`,

  image: `Describe this image in detail. Extract any visible text. If the image contains
a document, table, or diagram, reproduce its content faithfully as Markdown.`,

  audio: `Transcribe this audio file completely. Return the full verbatim transcript.
If there are multiple speakers, label them.`,

  video: `Describe this video in detail. Provide a comprehensive summary of the visual
content, any spoken dialogue or narration, on-screen text, and key events
or actions. Preserve the language of any speech.`,
};

export const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  tiff: "image/tiff",
  tif: "image/tiff",
};

export const VIDEO_MIME: Record<string, string> = {
  mp4: "video/mp4",

  mpeg: "video/mpeg",

  mov: "video/mov",

  webm: "video/webm",

  mkv: "video/x-matroska",

  avi: "video/x-msvideo",
};

export const OPENROUTER_DEFAULT_EMBEDDING_MODEL = "qwen/qwen3-embedding-8b";

export const OPENROUTER_EMBEDDING_BATCH_SIZE = 128;

export const DEFAULT_EMBEDDING_DIMENSIONS = 1024;

export const EMBEDDING_MODELS: OpenRouterModelFull[] =
  generatedData.openrouterEmbeddingModels as OpenRouterModelFull[];

export const VOYAGE_MODELS: VoyageModel[] =
  generatedData.voyageModels as VoyageModel[];

export const COHERE_MODELS: CohereModel[] = (
  generatedData as unknown as { cohereModels: CohereModel[] }
).cohereModels;

export const PINECONE_ENVIRONMENTS: PineconeEnvironment[] =
  generatedData.pineconeEnvironments as PineconeEnvironment[];

export const DEFAULT_CHUNK_SIZE = 4096;

export const DEFAULT_CHUNK_OVERLAP = 50;

export const CHUNKING_TYPE_LABELS: Record<string, string> = {
  recursive: "Recursive Character Text Splitting",
};

export const DEFAULT_SEPARATORS = ["\n\n", "\n# ", "\n## ", "\n### "];

export const ALL_AVAILABLE_SEPARATORS = [
  "\n\n",
  "\n# ",
  "\n## ",
  "\n### ",
  "\n---",
  "\n",
  ". ",
  "? ",
  "! ",
  " ",
];

export const DEFAULT_SEPARATOR_LABELS: Record<string, string> = {
  "\n\n": "Paragraph break (\\n\\n)",
  "\n# ": "Heading 1 (\\n# )",
  "\n## ": "Heading 2 (\\n## )",
  "\n### ": "Heading 3 (\\n### )",
  "\n---": "Horizontal rule (\\n---)",
  "\n": "Line break (\\n)",
  ". ": "Sentence end (. )",
  "? ": "Question end (? )",
  "! ": "Exclamation end (! )",
  " ": "Word boundary (space)",
};

export const DEFAULT_SEPARATORS_DISPLAY = "\\n\\n, \\n# , \\n## , \\n### ";
export const DEFAULT_VLLM_ENDPOINT = "http://localhost:8000";
export const DEFAULT_VLLM_EMBEDDING_ENDPOINT = "http://localhost:8007";

export const VLLM_RECOMMENDED_MODELS = {
  docling: {
    model: "ibm-granite/granite-docling-258M",
    port: 8005,
    description: "Docling",
  },

  audio: {
    model: "openai/whisper-large-v3-turbo",
    port: 8006,
    description: "Audio transcription",
  },

  embeddings: {
    model: "jinaai/jina-embeddings-v3",
    port: 8007,
    extraFlags: "--trust-remote-code",
    description: "Text embeddings",
  },

  multimodal: {
    model: "Qwen/Qwen3-VL-8B-Instruct-FP8",
    port: 8008,
    extraFlags: "--max-model-len 32000",
    description: "Vision (Image, Video, PDF)",
  },
} as const;

export const DEFAULT_OLLAMA_ENDPOINT = "http://localhost:11434";
export const DEFAULT_CHROMA_ENDPOINT = "http://localhost:8030";
export const DEFAULT_FAISS_ENDPOINT = "http://localhost:8010";
export const DEFAULT_DOCLING_ENDPOINT = "http://localhost:8020";
export const GRANITE_DOCLING_MODEL = "ibm-granite/granite-docling-258M";

export const OLLAMA_CONFIG = {
  VISION_NUM_CTX: 16000,
  MAX_TOKENS_VISION: -1,
  VISION_TEMPERATURE: 0.6,
  KEEP_ALIVE_DEFAULT: "5m",
} as const;
