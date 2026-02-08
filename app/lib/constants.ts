import {
  PIPELINE,
  type PdfEngineOption,
  type VoyageModel,
  type PineconeEnvironment,
  type OpenRouterModel,
  type OpenRouterModelFull,
} from "./types";

/**
 * All model/config data loaded from generated JSON.
 * Run `npm run update-models` to refresh from APIs.
 * Source: app/lib/generated/models-data.json
 */
import generatedData from "./generated/models-data.json";

// Re-export PIPELINE for convenience
export { PIPELINE };

// ─── Extension Sets Per Pipeline ──────────────────────────────────────────

export const PIPELINE_ALLOWED_EXTENSIONS: Record<string, Set<string>> = {
  [PIPELINE.SIMPLE_TEXT]: new Set(["pdf", "docx", "txt", "md"]),
  [PIPELINE.EXCEL_SPREADSHEET]: new Set(["xlsx", "xls"]),
  [PIPELINE.CSV_SPREADSHEET]: new Set(["csv"]),
  [PIPELINE.OPENROUTER_PDF]: new Set(["pdf"]),
  [PIPELINE.OPENROUTER_IMAGE]: new Set([
    "png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "tif",
  ]),
  [PIPELINE.OPENROUTER_AUDIO]: new Set([
    "wav", "mp3", "aiff", "aac", "ogg", "flac", "m4a",
  ]),
  [PIPELINE.OPENROUTER_VIDEO]: new Set([
    "mp4", "mpeg", "mov", "webm", "mkv", "avi",
  ]),
  [PIPELINE.OLLAMA_PDF]: new Set(["pdf"]),
  [PIPELINE.OLLAMA_IMAGE]: new Set([
    "png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "tif",
  ]),
};

/** Every extension the app accepts */
export const ALL_ACCEPTED_EXTENSIONS = Array.from(
  new Set(
    Object.values(PIPELINE_ALLOWED_EXTENSIONS).flatMap((s) => [...s])
  )
).map((e) => `.${e}`);

// ─── OpenRouter ───────────────────────────────────────────────────────────

export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";
export const OPENROUTER_DEFAULT_MODEL = "google/gemini-3-flash-preview";
export const OPENROUTER_MAX_RETRIES = 3;
export const OPENROUTER_RETRY_DELAY_MS = 2000;
export const OPENROUTER_TIMEOUT_MS = 120_000;

export const OPENROUTER_HEADERS_BASE = {
  "Content-Type": "application/json",
  "HTTP-Referer": "https://github.com/chunkcanvas",
  "X-Title": "ChunkCanvas",
};

/** PDF processing engines — loaded from generated JSON. */
export const PDF_ENGINES: PdfEngineOption[] = generatedData.pdfEngines as PdfEngineOption[];

/** Fallback parsing models (multimodal) — loaded from generated JSON. */
export const FALLBACK_MODELS: Record<string, OpenRouterModel> =
  generatedData.openrouterParsingModels as Record<string, OpenRouterModel>;

// ─── Default Prompts ──────────────────────────────────────────────────────

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

// ─── MIME Mappings ────────────────────────────────────────────────────────

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

// ─── OpenRouter Embeddings ──────────────────────────────────────────────

export const OPENROUTER_DEFAULT_EMBEDDING_MODEL = "qwen/qwen3-embedding-8b";
export const OPENROUTER_EMBEDDING_BATCH_SIZE = 128;
export const DEFAULT_EMBEDDING_DIMENSIONS = 1024;

/** OpenRouter embedding models — loaded from generated JSON. */
export const EMBEDDING_MODELS: OpenRouterModelFull[] =
  generatedData.openrouterEmbeddingModels as OpenRouterModelFull[];

// ─── Voyage AI ────────────────────────────────────────────────────────────

/** Voyage AI embedding models — loaded from generated JSON. */
export const VOYAGE_MODELS: VoyageModel[] = generatedData.voyageModels as VoyageModel[];

// ─── Pinecone ─────────────────────────────────────────────────────────────

/** Pinecone cloud environments — loaded from generated JSON. */
export const PINECONE_ENVIRONMENTS: PineconeEnvironment[] =
  generatedData.pineconeEnvironments as PineconeEnvironment[];

// ─── Default Chunking Params ──────────────────────────────────────────────

export const DEFAULT_CHUNK_SIZE = 4096;
export const DEFAULT_CHUNK_OVERLAP = 50;

/**
 * Default separators — ordered from coarsest to finest.
 * Prioritises keeping whole paragraphs and markdown tables intact:
 *   1. Double newline  → paragraph boundary
 *   2. Markdown heading → "# " / "## " / "### " level breaks
 *   3. Horizontal rule / thematic break → "---"
 *   4. Single newline  → line break (only when paragraph split isn't enough)
 *   5. Sentence end markers → ". ", "? ", "! "
 *   6. Space            → last resort word boundary
 *
 * Markdown table rows always start with "|" on each line, so they will
 * NOT be split as long as the table fits within a single chunk
 * (no separator matches inside a table row).
 */
export const DEFAULT_SEPARATORS = [
  "\n\n",   // paragraph break
  "\n# ",   // H1 heading
  "\n## ",  // H2 heading
  "\n### ", // H3 heading
  "\n---",  // horizontal rule / thematic break
  "\n",     // line break (fallback)
  ". ",     // sentence end
  "? ",     // question end
  "! ",     // exclamation end
  " ",      // word boundary
];

/** Human-readable labels for each default separator */
export const DEFAULT_SEPARATOR_LABELS: Record<string, string> = {
  "\n\n":   "Paragraph break (\\n\\n)",
  "\n# ":   "Heading 1 (\\n# )",
  "\n## ":  "Heading 2 (\\n## )",
  "\n### ": "Heading 3 (\\n### )",
  "\n---":  "Horizontal rule (\\n---)",
  "\n":     "Line break (\\n)",
  ". ":     "Sentence end (. )",
  "? ":     "Question end (? )",
  "! ":     "Exclamation end (! )",
  " ":      "Word boundary (space)",
};

export const DEFAULT_SEPARATORS_DISPLAY = "\\n\\n, \\n# , \\n## , \\n### , \\n---, \\n, . , ? , ! ,  ";

// ─── vLLM ─────────────────────────────────────────────────────────────────

export const DEFAULT_VLLM_ENDPOINT = "http://localhost:8734";

// ─── Ollama ───────────────────────────────────────────────────────────────

export const DEFAULT_OLLAMA_ENDPOINT = "http://localhost:11434";

/**
 * Ollama optimization settings based on official docs:
 * https://docs.ollama.com/faq
 * https://github.com/ollama/ollama/blob/main/docs/api.md
 */
export const OLLAMA_CONFIG = {
  VISION_NUM_CTX: 16000,
  MAX_TOKENS_VISION: -1,
  VISION_TEMPERATURE: 0.6,
  KEEP_ALIVE_DEFAULT: "5m",
} as const;