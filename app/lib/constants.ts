import {
  PIPELINE,
  type PdfEngineOption,
  type VoyageModel,
  type PineconeEnvironment,
  type OpenRouterModel,
} from "./types";

// Re-export PIPELINE for convenience
export { PIPELINE };

// ─── Extension Sets Per Pipeline ──────────────────────────────────────────

export const PIPELINE_ALLOWED_EXTENSIONS: Record<string, Set<string>> = {
  [PIPELINE.SIMPLE_TEXT]: new Set(["pdf", "docx", "txt", "md"]),
  [PIPELINE.EXCEL_SPREADSHEET]: new Set(["xlsx", "xls"]),
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

export const PDF_ENGINES: PdfEngineOption[] = [
  {
    key: "native",
    label: "Native (No extra plugin cost — uses model's vision)",
    description: "Sends PDF page as base64 images to the multimodal model",
  },
  {
    key: "pdf-text",
    label: "PDF-Text (extracts text from well-structured PDFs, free)",
    description: "Pre-extracts text before sending to model",
  },
  {
    key: "mistral-ocr",
    label: "Mistral OCR (best for scanned docs / images, $2/1000 pages)",
    description: "Uses Mistral's OCR service",
  },
];

export const FALLBACK_MODELS: Record<string, OpenRouterModel> = {
  "google/gemini-3-flash-preview": {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash Preview",
    input_modalities: ["text", "image", "file", "audio", "video"],
  },
  "google/gemini-2.5-flash-preview": {
    id: "google/gemini-2.5-flash-preview",
    name: "Gemini 2.5 Flash Preview",
    input_modalities: ["text", "image", "file", "audio", "video"],
  },
  "google/gemini-2.5-pro-preview": {
    id: "google/gemini-2.5-pro-preview",
    name: "Gemini 2.5 Pro Preview",
    input_modalities: ["text", "image", "file", "audio", "video"],
  },
  "anthropic/claude-sonnet-4": {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    input_modalities: ["text", "image", "file"],
  },
  "anthropic/claude-3.5-sonnet": {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    input_modalities: ["text", "image", "file"],
  },
  "openai/gpt-4.1": {
    id: "openai/gpt-4.1",
    name: "GPT-4.1",
    input_modalities: ["text", "image", "file"],
  },
  "openai/gpt-4.1-mini": {
    id: "openai/gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    input_modalities: ["text", "image", "file"],
  },
  "meta-llama/llama-4-maverick": {
    id: "meta-llama/llama-4-maverick",
    name: "Llama 4 Maverick",
    input_modalities: ["text", "image"],
  },
};

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

// ─── Voyage AI ────────────────────────────────────────────────────────────

export const VOYAGE_MODELS: VoyageModel[] = [
  {
    key: "voyage-4-large",
    label: "Voyage 4 Large",
    dimensions: 1024,
    description: "Best general-purpose and multilingual retrieval quality",
  },
  {
    key: "voyage-4",
    label: "Voyage 4",
    dimensions: 1024,
    description: "Optimized for general-purpose and multilingual retrieval",
  },
  {
    key: "voyage-4-lite",
    label: "Voyage 4 Lite",
    dimensions: 1024,
    description: "Optimized for latency and cost",
  },
  {
    key: "voyage-multimodal-3.5",
    label: "Voyage Multimodal 3.5",
    dimensions: 1024,
    description: "Rich multimodal embedding model for text + images",
  },
];

// ─── Pinecone ─────────────────────────────────────────────────────────────

export const PINECONE_ENVIRONMENTS: PineconeEnvironment[] = [
  { key: "aws-us-east-1", label: "AWS - US East (Virginia) - Starter, Standard, Enterprise", cloud: "aws", region: "us-east-1" },
  { key: "aws-us-west-2", label: "AWS - US West (Oregon) - Standard, Enterprise", cloud: "aws", region: "us-west-2" },
  { key: "aws-eu-west-1", label: "AWS - EU West (Ireland) - Standard, Enterprise", cloud: "aws", region: "eu-west-1" },
  { key: "gcp-us-central1", label: "GCP - US Central (Iowa) - Standard, Enterprise", cloud: "gcp", region: "us-central1" },
  { key: "gcp-europe-west4", label: "GCP - Europe West (Netherlands) - Standard, Enterprise", cloud: "gcp", region: "europe-west4" },
  { key: "azure-eastus2", label: "Azure - East US 2 (Virginia) - Standard, Enterprise", cloud: "azure", region: "eastus2" },
];

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
