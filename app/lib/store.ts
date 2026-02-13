/**
 * Central Zustand store — single source of truth for the entire app.
 * Persists user preferences (ports, models, API keys, pipeline choices)
 * to localStorage so they survive page reloads.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChunkingParams, EmbeddingProvider, PdfEngine, ParsedFileResult, PineconeFieldMapping, ExtPipelineConfig, ChromaMode, FaissDbMode, FaissMetric, VectorDbProvider } from "./types";
import { DEFAULT_CHUNK_SIZE, DEFAULT_CHUNK_OVERLAP, DEFAULT_SEPARATORS, DEFAULT_OLLAMA_ENDPOINT, DEFAULT_EMBEDDING_DIMENSIONS, DEFAULT_VLLM_ENDPOINT, DEFAULT_VLLM_EMBEDDING_ENDPOINT, DEFAULT_DOCLING_ENDPOINT, DEFAULT_CHROMA_ENDPOINT, DEFAULT_FAISS_ENDPOINT } from "./constants";

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // unsigned
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function hashChunks(chunks: string[]): string {
  // Include length + delimiter to reduce accidental collisions in simple joins.
  return fnv1a32(`${chunks.length}\n${chunks.join("\u241E")}`);
}

export interface AppState {
  // ── Step 1 ────────────────────────────────────
  files: File[];
  pipeline: string;
  pipelinesByExt: Record<string, string>;
  configByExt: Record<string, ExtPipelineConfig>;
  configByFile: Record<string, ExtPipelineConfig>;

  // ── Step 2 — pipeline form data ───────────────
  openrouterApiKey: string;
  openrouterModel: string;
  openrouterPrompt: string;
  openrouterPagesPerBatch: number;
  pdfEngine: PdfEngine;
  excelSheet: string;
  excelSheets: string[];
  excelColumn: string;
  excelSelectedColumns: string[];
  excelColumns: string[];

  // Ollama parsing
  ollamaEndpoint: string;
  ollamaModel: string;
  ollamaPrompt: string;

  // vLLM parsing
  vllmEndpoint: string;
  vllmAdditionalEndpoints: string[];
  vllmModel: string;
  vllmPrompt: string;

  // Docling parsing
  doclingEndpoint: string;

  // ── Step 3 — parsed result ────────────────────
  parsedContent: string | null;
  parsedFilename: string;
  parsedDocType: string;
  parsedExcelRows: string[] | null;

  // parsing state
  isParsing: boolean;
  parseProgress: number;
  parseProgressMsg: string;
  parseError: string | null;

  // ── Multi-file tracking ───────────────────────
  parsedResults: ParsedFileResult[];
  currentProcessingFile: string;
  /** In-memory cache of parse results keyed by file+pipeline+config. Cleared on Reset / Clear all files. */
  parseCache: Record<string, ParsedFileResult>;

  // ── Step 3b — chunking ────────────────────────
  chunkingParams: ChunkingParams;

  // ── Step 4 — editable chunks ──────────────────
  editedChunks: string[];
  chunkSourceFiles: string[];
  isChunking: boolean;
  /** Hash of the current `editedChunks` (used to detect whether embeddings match). */
  chunksHash: string;

  // ── Step 6 — embeddings ───────────────────────
  embeddingProvider: EmbeddingProvider;
  voyageApiKey: string;
  voyageModel: string;
  cohereApiKey: string;
  cohereModel: string;
  openrouterEmbeddingModel: string;
  embeddingDimensions: number;
  ollamaEmbeddingModel: string;
  ollamaEmbeddingEndpoint: string;
  vllmEmbeddingModel: string;
  vllmEmbeddingEndpoint: string;
  embeddingsData: number[][] | null;
  /** The `chunksHash` that `embeddingsData` corresponds to (null when unknown/out-of-date). */
  embeddingsForChunksHash: string | null;
  /** Per-chunk embedding cache, keyed by provider/model/dims/endpoint + chunk text hash. */
  embeddingChunkCache: Record<string, number[]>;
  /** Metadata for the currently active `embeddingsData` (what actually generated it). */
  embeddingsMeta: { provider: EmbeddingProvider; modelKey: string; dimensions: number; endpoint?: string } | null;
  isEmbedding: boolean;
  embeddingError: string | null;

  // ── Step 7 — Pinecone ─────────────────────────
  pineconeApiKey: string;
  pineconeEnvKey: string;
  pineconeIndexName: string;
  pineconeIndexes: string[];
  pineconeNamespace: string;
  pineconeNamespaces: string[];
  pineconeFieldMapping: PineconeFieldMapping;
  isUploadingPinecone: boolean;
  pineconeError: string | null;
  pineconeSuccess: string | null;

  // ── Step 7 — Chroma ───────────────────────────
  chromaMode: ChromaMode;
  chromaLocalUrl: string;
  chromaApiKey: string;
  chromaTenant: string;
  chromaDatabase: string;
  chromaDatabases: string[];
  chromaCollectionName: string;
  chromaCollections: string[];
  isUploadingChroma: boolean;
  chromaError: string | null;
  chromaSuccess: string | null;

  // ── Step 7 — FAISS ────────────────────────────
  faissApiBase: string;
  faissIndexesDir: string;
  faissNewDbName: string;
  faissDbPath: string;
  faissDbMode: FaissDbMode;
  faissDimension: number;
  faissMetric: FaissMetric;
  selectedVectorDb: VectorDbProvider;

  // ── UI state ───────────────────────────────────
  allChunksCollapsed: boolean;

  // ── Sidebar ───────────────────────────────────
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  scrollActiveStep: number | null;

  // ── API keys from env ─────────────────────────
  envKeys: {
    openrouter: string;
    voyage: string;
    cohere: string;
    pinecone: string;
  };
  // ── Persisted user preferences (survive page reloads) ─────
  /** Last-used pipeline per file extension (e.g. "mp4" → "vLLM — Video...") */
  lastPipelineByExt: Record<string, string>;
  /** Last-used per-extension config (endpoints, models, prompts) */
  lastConfigByExt: Record<string, ExtPipelineConfig>;
  /** Last-used embedding provider */
  lastEmbeddingProvider: EmbeddingProvider;}

export interface AppActions {
  // Step 1
  setFiles: (files: File[]) => void;
  addFiles: (files: File[]) => void;
  removeFile: (index: number) => void;
  setPipeline: (pipeline: string) => void;
  setPipelineForExt: (ext: string, pipeline: string) => void;
  setConfigForExt: (ext: string, config: Partial<ExtPipelineConfig>) => void;
  setConfigForFile: (filename: string, config: Partial<ExtPipelineConfig>) => void;

  // Step 2
  setOpenrouterApiKey: (key: string) => void;
  setOpenrouterModel: (model: string) => void;
  setOpenrouterPrompt: (prompt: string) => void;
  setOpenrouterPagesPerBatch: (n: number) => void;
  setPdfEngine: (engine: PdfEngine) => void;
  setExcelSheet: (sheet: string) => void;
  setExcelSheets: (sheets: string[]) => void;
  setExcelColumn: (col: string) => void;
  setExcelSelectedColumns: (cols: string[]) => void;
  setExcelColumns: (cols: string[]) => void;

  // Ollama parsing
  setOllamaEndpoint: (ep: string) => void;
  setOllamaModel: (model: string) => void;
  setOllamaPrompt: (prompt: string) => void;

  // vLLM parsing
  setVllmEndpoint: (ep: string) => void;
  setVllmAdditionalEndpoints: (eps: string[]) => void;
  setVllmModel: (model: string) => void;
  setVllmPrompt: (prompt: string) => void;

  // Docling parsing
  setDoclingEndpoint: (ep: string) => void;

  // Step 3
  setParsedContent: (content: string | null) => void;
  setParsedFilename: (name: string) => void;
  setParsedDocType: (docType: string) => void;
  setParsedExcelRows: (rows: string[] | null) => void;
  setIsParsing: (v: boolean) => void;
  setParseProgress: (pct: number, msg?: string) => void;
  setParseError: (err: string | null) => void;
  setParsedResults: (results: ParsedFileResult[]) => void;
  setCurrentProcessingFile: (name: string) => void;
  setParseCache: (cache: Record<string, ParsedFileResult>) => void;

  // Step 3b
  setChunkingParams: (params: Partial<ChunkingParams>) => void;

  // Step 4
  setEditedChunks: (chunks: string[]) => void;
  updateChunk: (index: number, text: string) => void;
  deleteChunk: (index: number) => void;
  setIsChunking: (v: boolean) => void;
  setChunkSourceFiles: (files: string[]) => void;

  // Step 6
  setEmbeddingProvider: (provider: EmbeddingProvider) => void;
  setVoyageApiKey: (key: string) => void;
  setVoyageModel: (model: string) => void;
  setCohereApiKey: (key: string) => void;
  setCohereModel: (model: string) => void;
  setOpenrouterEmbeddingModel: (model: string) => void;
  setEmbeddingDimensions: (dims: number) => void;
  setOllamaEmbeddingModel: (model: string) => void;
  setOllamaEmbeddingEndpoint: (ep: string) => void;
  setVllmEmbeddingModel: (model: string) => void;
  setVllmEmbeddingEndpoint: (ep: string) => void;
  setEmbeddingsData: (data: number[][] | null) => void;
  setEmbeddingsForChunksHash: (h: string | null) => void;
  setEmbeddingChunkCache: (cache: Record<string, number[]>) => void;
  setEmbeddingsMeta: (meta: AppState["embeddingsMeta"]) => void;
  setIsEmbedding: (v: boolean) => void;
  setEmbeddingError: (err: string | null) => void;

  // Step 7
  setPineconeApiKey: (key: string) => void;
  setPineconeEnvKey: (key: string) => void;
  setPineconeIndexName: (name: string) => void;
  setPineconeIndexes: (indexes: string[]) => void;
  setPineconeNamespace: (ns: string) => void;
  setPineconeNamespaces: (namespaces: string[]) => void;
  setPineconeFieldMapping: (mapping: Partial<PineconeFieldMapping>) => void;
  setIsUploadingPinecone: (v: boolean) => void;
  setPineconeError: (err: string | null) => void;
  setPineconeSuccess: (msg: string | null) => void;

  setChromaMode: (mode: ChromaMode) => void;
  setChromaLocalUrl: (url: string) => void;
  setChromaApiKey: (key: string) => void;
  setChromaTenant: (tenant: string) => void;
  setChromaDatabase: (db: string) => void;
  setChromaDatabases: (databases: string[]) => void;
  setChromaCollectionName: (name: string) => void;
  setChromaCollections: (collections: string[]) => void;
  setIsUploadingChroma: (v: boolean) => void;
  setChromaError: (err: string | null) => void;
  setChromaSuccess: (msg: string | null) => void;

  setFaissApiBase: (url: string) => void;
  setFaissIndexesDir: (dir: string) => void;
  setFaissNewDbName: (name: string) => void;
  setFaissDbPath: (path: string) => void;
  setFaissDbMode: (mode: FaissDbMode) => void;
  setFaissDimension: (dimension: number) => void;
  setFaissMetric: (metric: FaissMetric) => void;
  setSelectedVectorDb: (provider: VectorDbProvider) => void;

  // Sidebar
  setSidebarCollapsed: (v: boolean) => void;
  setSidebarWidth: (w: number) => void;
  setScrollActiveStep: (step: number | null) => void;

  // UI state
  setAllChunksCollapsed: (v: boolean) => void;

  // Env keys
  setEnvKeys: (keys: Partial<AppState["envKeys"]>) => void;

  // Reset downstream when file changes
  resetDownstream: (fromStep: number) => void;

  // Full reset
  resetAll: () => void;

  // Reset chunking params to defaults
  resetChunkingDefaults: () => void;

  // Persist helpers (called automatically by other actions)
  _saveLastPipeline: (ext: string, pipeline: string) => void;
  _saveLastConfig: (ext: string, config: ExtPipelineConfig) => void;
}

export function defaultExtConfig(): ExtPipelineConfig {
  return {
    openrouterModel: "google/gemini-3-flash-preview",
    openrouterPrompt: "",
    openrouterPagesPerBatch: 0,
    pdfEngine: "native",
    ollamaEndpoint: DEFAULT_OLLAMA_ENDPOINT,
    ollamaModel: "",
    ollamaPrompt: "",
    vllmEndpoint: DEFAULT_VLLM_ENDPOINT,
    vllmModel: "",
    vllmPrompt: "",
    doclingEndpoint: DEFAULT_DOCLING_ENDPOINT,
    // Docling (granite-docling via vLLM)
    excelSheet: "",
    excelSheets: [],
    excelColumn: "",
    excelSelectedColumns: [],
    excelColumns: [],
  };
}

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
  // ── Initial state ─────────────────────────────────────────
  files: [],
  pipeline: "",
  pipelinesByExt: {},
  configByExt: {},
  configByFile: {},
  openrouterApiKey: "",
  openrouterModel: "google/gemini-3-flash-preview",
  openrouterPrompt: "",
  openrouterPagesPerBatch: 0,
  pdfEngine: "native",
  excelSheet: "",
  excelSheets: [],
  excelColumn: "",
  excelSelectedColumns: [],
  excelColumns: [],

  // Ollama parsing
  ollamaEndpoint: DEFAULT_OLLAMA_ENDPOINT,
  ollamaModel: "",
  ollamaPrompt: "",

  // vLLM parsing
  vllmEndpoint: DEFAULT_VLLM_ENDPOINT,
  vllmAdditionalEndpoints: [],
  vllmModel: "",
  vllmPrompt: "",

  // Docling parsing
  doclingEndpoint: DEFAULT_DOCLING_ENDPOINT,

  parsedContent: null,
  parsedFilename: "",
  parsedDocType: "",
  parsedExcelRows: null,
  isParsing: false,
  parseProgress: 0,
  parseProgressMsg: "",
  parseError: null,
  parsedResults: [],
  currentProcessingFile: "",
  parseCache: {},
  chunkingParams: {
    chunkingType: "recursive",
    separators: DEFAULT_SEPARATORS,
    chunkSize: DEFAULT_CHUNK_SIZE,
    chunkOverlap: DEFAULT_CHUNK_OVERLAP,
  },
  editedChunks: [],
  chunkSourceFiles: [],
  isChunking: false,
  chunksHash: hashChunks([]),
  embeddingProvider: "openrouter",
  voyageApiKey: "",
  voyageModel: "voyage-4",
  cohereApiKey: "",
  cohereModel: "embed-english-v3.0",
  openrouterEmbeddingModel: "qwen/qwen3-embedding-8b",
  embeddingDimensions: DEFAULT_EMBEDDING_DIMENSIONS,
  ollamaEmbeddingModel: "",
  ollamaEmbeddingEndpoint: DEFAULT_OLLAMA_ENDPOINT,
  vllmEmbeddingModel: "jinaai/jina-embeddings-v3",
  vllmEmbeddingEndpoint: DEFAULT_VLLM_EMBEDDING_ENDPOINT,
  embeddingsData: null,
  embeddingsForChunksHash: null,
  embeddingChunkCache: {},
  embeddingsMeta: null,
  isEmbedding: false,
  embeddingError: null,
  pineconeApiKey: "",
  pineconeEnvKey: "aws-us-east-1",
  pineconeIndexName: "",
  pineconeIndexes: [],
  pineconeNamespace: "",
  pineconeNamespaces: [],
  pineconeFieldMapping: { idPrefix: "", textField: "text", filenameField: "filename" },
  isUploadingPinecone: false,
  pineconeError: null,
  pineconeSuccess: null,
  chromaMode: "local",
  chromaLocalUrl: DEFAULT_CHROMA_ENDPOINT,
  chromaApiKey: "",
  chromaTenant: "",
  chromaDatabase: "default_database",
  chromaDatabases: [],
  chromaCollectionName: "",
  chromaCollections: [],
  isUploadingChroma: false,
  chromaError: null,
  chromaSuccess: null,
  faissApiBase: DEFAULT_FAISS_ENDPOINT,
  faissIndexesDir: "/tmp/chunkcanvas",
  faissNewDbName: "index",
  faissDbPath: "/tmp/chunkcanvas/index.faiss",
  faissDbMode: "existing",
  faissDimension: DEFAULT_EMBEDDING_DIMENSIONS,
  faissMetric: "cosine",
  selectedVectorDb: "pinecone",
  allChunksCollapsed: true,
  sidebarCollapsed: false,
  sidebarWidth: 288,
  scrollActiveStep: null,
  envKeys: { openrouter: "", voyage: "", cohere: "", pinecone: "" },

  // Persisted user preferences (initial empty — hydrated from localStorage)
  lastPipelineByExt: {},
  lastConfigByExt: {},
  lastEmbeddingProvider: "openrouter",

  // ── Actions ───────────────────────────────────────────────
  setFiles: (files) => {
    // Seed pipeline/config from last-used preferences for each extension
    const state = get();
    const newPipelinesByExt: Record<string, string> = {};
    const newConfigByExt: Record<string, ExtPipelineConfig> = {};
    for (const f of files) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ext) continue;
      if (state.lastPipelineByExt[ext]) {
        newPipelinesByExt[ext] = state.lastPipelineByExt[ext];
      }
      if (state.lastConfigByExt[ext]) {
        newConfigByExt[ext] = { ...state.lastConfigByExt[ext] };
      }
    }
    const vals = Object.values(newPipelinesByExt).filter(Boolean);
    // Special case: clearing all files should clear transient session data.
    if (files.length === 0) {
      set({ files: [], pipeline: "", pipelinesByExt: {}, configByExt: {}, configByFile: {} });
      set({
        parsedContent: null,
        parsedFilename: "",
        parsedDocType: "",
        parsedExcelRows: null,
        parseError: null,
        parseProgress: 0,
        parseProgressMsg: "",
        parsedResults: [],
        currentProcessingFile: "",
        parseCache: {},
        editedChunks: [],
        chunkSourceFiles: [],
        isChunking: false,
        chunksHash: hashChunks([]),
        embeddingsData: null,
        embeddingsForChunksHash: null,
        embeddingError: null,
        // Keep embeddingChunkCache? Clear on explicit clear-all to avoid surprising reuse across sessions.
        embeddingChunkCache: {},
        pineconeSuccess: null,
        pineconeError: null,
        chromaSuccess: null,
        chromaError: null,
      });
      return;
    }

    set({ files, pipeline: vals[0] || "", pipelinesByExt: newPipelinesByExt, configByExt: newConfigByExt });
  },
  addFiles: (newFiles) => {
    const state = get();
    const nextFiles = [...state.files, ...newFiles];

    // Seed pipeline/config from last-used preferences for each new extension
    const nextPipelinesByExt = { ...state.pipelinesByExt };
    const nextConfigByExt = { ...state.configByExt };
    for (const f of newFiles) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ext) continue;
      if (!nextPipelinesByExt[ext] && state.lastPipelineByExt[ext]) {
        nextPipelinesByExt[ext] = state.lastPipelineByExt[ext];
      }
      if (!nextConfigByExt[ext] && state.lastConfigByExt[ext]) {
        nextConfigByExt[ext] = { ...state.lastConfigByExt[ext] };
      }
    }
    const vals = Object.values(nextPipelinesByExt).filter(Boolean);
    set({ files: nextFiles, pipelinesByExt: nextPipelinesByExt, configByExt: nextConfigByExt, pipeline: vals[0] || state.pipeline || "" });
  },
  removeFile: (index) => {
    const s = get();
    const next = s.files.filter((_, i) => i !== index);
    const removed = s.files[index];

    // If no files remain, perform a full transient reset
    if (next.length === 0) {
      set({
        files: [],
        pipeline: "",
        pipelinesByExt: {},
        configByExt: {},
        parsedContent: null,
        parsedFilename: "",
        parsedDocType: "",
        parsedExcelRows: null,
        parseError: null,
        parseProgress: 0,
        parseProgressMsg: "",
        parsedResults: [],
        currentProcessingFile: "",
        parseCache: {},
        editedChunks: [],
        chunkSourceFiles: [],
        isChunking: false,
        chunksHash: hashChunks([]),
        embeddingsData: null,
        embeddingsForChunksHash: null,
        embeddingError: null,
        embeddingChunkCache: {},
        pineconeSuccess: null,
        pineconeError: null,
        chromaSuccess: null,
        chromaError: null,
      });
      return;
    }

    const remainingExts = new Set(next.map((f) => f.name.split(".").pop()?.toLowerCase() ?? ""));
    const nextPipelines = { ...s.pipelinesByExt };
    const nextConfig = { ...s.configByExt };
    for (const ext of Object.keys(nextPipelines)) {
      if (!remainingExts.has(ext)) {
        delete nextPipelines[ext];
        delete nextConfig[ext];
      }
    }
    const vals = Object.values(nextPipelines).filter(Boolean);

    // Also remove any active parsed results for this file; keep cache entries for other files.
    const removedName = removed?.name;
    const nextConfigByFile = { ...s.configByFile };
    if (removedName) {
      delete nextConfigByFile[removedName];
    }

    const nextParsedResults = removedName
      ? s.parsedResults.filter((r) => r.filename !== removedName)
      : s.parsedResults;

    // Best-effort: drop cached parses for the removed filename to avoid unbounded growth.
    const nextParseCache: Record<string, ParsedFileResult> = {};
    for (const [k, v] of Object.entries(s.parseCache)) {
      if (removedName && v.filename === removedName) continue;
      nextParseCache[k] = v;
    }

    // Remove chunks sourced from the removed file.
    let nextEditedChunks = s.editedChunks;
    let nextChunkSources = s.chunkSourceFiles;
    let nextEmbeddingsData = s.embeddingsData;
    let nextEmbeddingsHash = null;

    if (removedName && s.chunkSourceFiles.length === s.editedChunks.length) {
      const keepIdx: number[] = [];
      for (let i = 0; i < s.chunkSourceFiles.length; i++) {
        if (s.chunkSourceFiles[i] !== removedName) keepIdx.push(i);
      }
      nextEditedChunks = keepIdx.map((i) => s.editedChunks[i]);
      nextChunkSources = keepIdx.map((i) => s.chunkSourceFiles[i]);

      // Filter embeddings if they were in sync with chunks
      if (s.embeddingsData && s.embeddingsData.length === s.editedChunks.length) {
        nextEmbeddingsData = keepIdx.map((i) => s.embeddingsData![i]);
        if (nextEmbeddingsData.length === 0) {
          nextEmbeddingsData = null;
          nextEmbeddingsHash = null;
        } else {
          // Re-hash to keep them "fresh" if they still match the remaining chunks
          nextEmbeddingsHash = hashChunks(nextEditedChunks);
        }
      }
    } else if (removedName) {
      // Fallback: if we can't reliably sync, clear chunks/embeddings derived from multiple files
      // but only if the removed file was part of them (best effort).
      // If chunkSourceFiles isn't in sync, we might have to be more aggressive.
      nextEmbeddingsData = null;
      nextEmbeddingsHash = null;
    }

    const nextChunksHash = hashChunks(nextEditedChunks);

    // Recompute combined parsedContent from remaining parsed results (if present)
    const combinedContent =
      nextParsedResults.length === 0
        ? null
        : nextParsedResults
            .map((r) => (nextParsedResults.length > 1 ? `\n═══ ${r.filename} ═══\n${r.content}` : r.content))
            .join("\n\n");

    const nextParsedFilename =
      nextParsedResults.length === 0
        ? ""
        : nextParsedResults.length === 1
          ? nextParsedResults[0].filename
          : `${nextParsedResults.length} files`;
    const uniquePipelines = [...new Set(nextParsedResults.map((r) => r.pipeline))];
    const nextParsedDocType =
      nextParsedResults.length === 0
        ? ""
        : uniquePipelines.length === 1
          ? uniquePipelines[0]
          : "Mixed pipelines";
    const allExcelRows = nextParsedResults.filter((r) => r.excelRows).flatMap((r) => r.excelRows ?? []);

    set({
      files: next,
      pipelinesByExt: nextPipelines,
      pipeline: vals[0] || "",
      configByExt: nextConfig,
      configByFile: nextConfigByFile,
      parsedResults: nextParsedResults,
      parsedContent: combinedContent,
      parsedFilename: nextParsedFilename,
      parsedDocType: nextParsedDocType,
      parsedExcelRows: allExcelRows.length > 0 ? allExcelRows : null,
      parseCache: nextParseCache,
      editedChunks: nextEditedChunks,
      chunkSourceFiles: nextChunkSources,
      chunksHash: nextChunksHash,
      embeddingsData: nextEmbeddingsData,
      embeddingsForChunksHash: nextEmbeddingsHash,
      pineconeSuccess: null,
      chromaSuccess: null,
    });
  },
  setPipeline: (pipeline) => {
    set({ pipeline });
  },
  setPipelineForExt: (ext, p) => {
    set((s) => {
      const next = { ...s.pipelinesByExt, [ext]: p };
      const vals = Object.values(next).filter(Boolean);
      const nextConfig = { ...s.configByExt };
      // Seed from last-used config if available, otherwise use defaults
      if (!nextConfig[ext]) {
        nextConfig[ext] = s.lastConfigByExt[ext]
          ? { ...s.lastConfigByExt[ext] }
          : defaultExtConfig();
      }
      // Save to long-term memory
      const nextLastPipeline = { ...s.lastPipelineByExt, [ext]: p };
      return {
        pipelinesByExt: next,
        pipeline: vals[0] || "",
        configByExt: nextConfig,
        lastPipelineByExt: nextLastPipeline,
      };
    });
  },
  setConfigForExt: (ext, config) => {
    set((s) => {
      const current = s.configByExt[ext] ?? defaultExtConfig();
      const updated = { ...current, ...config };
      
      const nextGlobal: Partial<AppState> = {};
      if (config.vllmEndpoint) nextGlobal.vllmEndpoint = config.vllmEndpoint;
      if (config.ollamaEndpoint) nextGlobal.ollamaEndpoint = config.ollamaEndpoint;
      if (config.doclingEndpoint) nextGlobal.doclingEndpoint = config.doclingEndpoint;

      return {
        ...nextGlobal,
        configByExt: {
          ...s.configByExt,
          [ext]: updated,
        },
        // Also persist to long-term memory
        lastConfigByExt: {
          ...s.lastConfigByExt,
          [ext]: updated,
        },
      };
    });
  },
  setConfigForFile: (filename, config) => {
    set((s) => {
      // Start with extension config as base if file config doesn't exist
      const ext = filename.split(".").pop()?.toLowerCase() ?? "";
      const base = s.configByFile[filename] ?? s.configByExt[ext] ?? defaultExtConfig();
      const updated = { ...base, ...config };
      return {
        configByFile: {
          ...s.configByFile,
          [filename]: updated,
        },
      };
    });
  },

  setOpenrouterApiKey: (key) => set({ openrouterApiKey: key }),
  setOpenrouterModel: (model) => set({ openrouterModel: model }),
  setOpenrouterPrompt: (prompt) => set({ openrouterPrompt: prompt }),
  setOpenrouterPagesPerBatch: (n) => set({ openrouterPagesPerBatch: n }),
  setPdfEngine: (engine) => set({ pdfEngine: engine }),
  setExcelSheet: (sheet) => set({ excelSheet: sheet }),
  setExcelSheets: (sheets) => set({ excelSheets: sheets }),
  setExcelColumn: (col) => set({ excelColumn: col }),
  setExcelSelectedColumns: (cols) => set({ excelSelectedColumns: cols }),
  setExcelColumns: (cols) => set({ excelColumns: cols }),

  setOllamaEndpoint: (ep) => set((s) => {
    const nextConfigByExt = { ...s.configByExt };
    for (const ext in nextConfigByExt) {
      nextConfigByExt[ext] = { ...nextConfigByExt[ext], ollamaEndpoint: ep };
    }
    const nextLastConfigByExt = { ...s.lastConfigByExt };
    for (const ext in nextLastConfigByExt) {
      nextLastConfigByExt[ext] = { ...nextLastConfigByExt[ext], ollamaEndpoint: ep };
    }
    return { ollamaEndpoint: ep, configByExt: nextConfigByExt, lastConfigByExt: nextLastConfigByExt };
  }),
  setOllamaModel: (model) => set({ ollamaModel: model }),
  setOllamaPrompt: (prompt) => set({ ollamaPrompt: prompt }),

  setVllmEndpoint: (ep) => set((s) => {
    const nextConfigByExt = { ...s.configByExt };
    for (const ext in nextConfigByExt) {
      nextConfigByExt[ext] = { ...nextConfigByExt[ext], vllmEndpoint: ep };
    }
    const nextLastConfigByExt = { ...s.lastConfigByExt };
    for (const ext in nextLastConfigByExt) {
      nextLastConfigByExt[ext] = { ...nextLastConfigByExt[ext], vllmEndpoint: ep };
    }
    return { vllmEndpoint: ep, configByExt: nextConfigByExt, lastConfigByExt: nextLastConfigByExt };
  }),
  setVllmAdditionalEndpoints: (eps) => set({ vllmAdditionalEndpoints: eps }),
  setVllmModel: (model) => set({ vllmModel: model }),
  setVllmPrompt: (prompt) => set({ vllmPrompt: prompt }),

  // Docling parsing setters
  setDoclingEndpoint: (ep) => set((s) => {
    const nextConfigByExt = { ...s.configByExt };
    for (const ext in nextConfigByExt) {
      nextConfigByExt[ext] = { ...nextConfigByExt[ext], doclingEndpoint: ep };
    }
    const nextLastConfigByExt = { ...s.lastConfigByExt };
    for (const ext in nextLastConfigByExt) {
      nextLastConfigByExt[ext] = { ...nextLastConfigByExt[ext], doclingEndpoint: ep };
    }
    return { doclingEndpoint: ep, configByExt: nextConfigByExt, lastConfigByExt: nextLastConfigByExt };
  }),

  setParsedContent: (content) => set({ parsedContent: content }),
  setParsedFilename: (name) => set({ parsedFilename: name }),
  setParsedDocType: (docType) => set({ parsedDocType: docType }),
  setParsedExcelRows: (rows) => set({ parsedExcelRows: rows }),
  setIsParsing: (v) => set({ isParsing: v }),
  setParseProgress: (pct, msg) =>
    set({ parseProgress: pct, parseProgressMsg: msg ?? "" }),
  setParseError: (err) => set({ parseError: err }),
  setParsedResults: (results) => set({ parsedResults: results }),
  setCurrentProcessingFile: (name) => set({ currentProcessingFile: name }),
  setParseCache: (cache) => set({ parseCache: cache }),

  setChunkingParams: (params) =>
    set((s) => ({
      chunkingParams: { ...s.chunkingParams, ...params },
    })),

  setEditedChunks: (chunks) =>
    set({
      editedChunks: chunks,
      chunksHash: hashChunks(chunks),
      // Embeddings now correspond to a different chunk set until regenerated.
      embeddingsForChunksHash: null,
      pineconeSuccess: null,
      chromaSuccess: null,
    }),
  updateChunk: (index, text) =>
    set((s) => {
      const next = [...s.editedChunks];
      next[index] = text;
      return {
        editedChunks: next,
        chunksHash: hashChunks(next),
        embeddingsForChunksHash: null,
        pineconeSuccess: null,
        chromaSuccess: null,
      };
    }),
  deleteChunk: (index) =>
    set((s) => {
      const nextEditedChunks = s.editedChunks.filter((_, i) => i !== index);
      const nextChunksHash = hashChunks(nextEditedChunks);
      const nextChunkSources =
        s.chunkSourceFiles.length === s.editedChunks.length
          ? s.chunkSourceFiles.filter((_, i) => i !== index)
          : s.chunkSourceFiles;

      let nextEmbeddingsData = s.embeddingsData;
      let nextEmbeddingsHash = null;
      if (s.embeddingsData && s.embeddingsData.length === s.editedChunks.length) {
        nextEmbeddingsData = s.embeddingsData.filter((_, i) => i !== index);
        if (nextEmbeddingsData.length === 0) {
          nextEmbeddingsData = null;
          nextEmbeddingsHash = null;
        } else {
          nextEmbeddingsHash = nextChunksHash;
        }
      }

      return {
        editedChunks: nextEditedChunks,
        chunkSourceFiles: nextChunkSources,
        chunksHash: nextChunksHash,
        embeddingsData: nextEmbeddingsData,
        embeddingsForChunksHash: nextEmbeddingsHash,
        pineconeSuccess: null,
        chromaSuccess: null,
      };
    }),
  setIsChunking: (v) => set({ isChunking: v }),
  setChunkSourceFiles: (files) => set({ chunkSourceFiles: files }),

  setEmbeddingProvider: (provider) => set({ embeddingProvider: provider, lastEmbeddingProvider: provider }),
  setVoyageApiKey: (key) => set({ voyageApiKey: key }),
  setVoyageModel: (model) => set({ voyageModel: model }),
  setCohereApiKey: (key) => set({ cohereApiKey: key }),
  setCohereModel: (model) => set({ cohereModel: model }),
  setOpenrouterEmbeddingModel: (model) => set({ openrouterEmbeddingModel: model }),
  setEmbeddingDimensions: (dims) => set({ embeddingDimensions: dims }),
  setOllamaEmbeddingModel: (model) => set({ ollamaEmbeddingModel: model }),
  setOllamaEmbeddingEndpoint: (ep) => set({ ollamaEmbeddingEndpoint: ep }),
  setVllmEmbeddingModel: (model) => set({ vllmEmbeddingModel: model }),
  setVllmEmbeddingEndpoint: (ep) => set({ vllmEmbeddingEndpoint: ep }),
  setEmbeddingsData: (data) => set({ embeddingsData: data, embeddingsForChunksHash: data ? get().chunksHash : null }),
  setEmbeddingsForChunksHash: (h) => set({ embeddingsForChunksHash: h }),
  setEmbeddingChunkCache: (cache) => set({ embeddingChunkCache: cache }),
  setEmbeddingsMeta: (meta) => set({ embeddingsMeta: meta }),
  setIsEmbedding: (v) => set({ isEmbedding: v }),
  setEmbeddingError: (err) => set({ embeddingError: err }),

  setPineconeApiKey: (key) => set({ pineconeApiKey: key }),
  setPineconeEnvKey: (key) => set({ pineconeEnvKey: key }),
  setPineconeIndexName: (name) => set({ pineconeIndexName: name }),
  setPineconeIndexes: (indexes) => set({ pineconeIndexes: indexes }),
  setPineconeNamespace: (ns) => set({ pineconeNamespace: ns }),
  setPineconeNamespaces: (namespaces) => set({ pineconeNamespaces: namespaces }),
  setPineconeFieldMapping: (mapping) =>
    set((s) => ({
      pineconeFieldMapping: { ...s.pineconeFieldMapping, ...mapping },
    })),
  setIsUploadingPinecone: (v) => set({ isUploadingPinecone: v }),
  setPineconeError: (err) => set({ pineconeError: err }),
  setPineconeSuccess: (msg) => set({ pineconeSuccess: msg }),

  setChromaMode: (mode) => set({ chromaMode: mode }),
  setChromaLocalUrl: (url) => set({ chromaLocalUrl: url }),
  setChromaApiKey: (key) => set({ chromaApiKey: key }),
  setChromaTenant: (tenant) => set({ chromaTenant: tenant }),
  setChromaDatabase: (db) => set({ chromaDatabase: db }),
  setChromaDatabases: (databases) => set({ chromaDatabases: databases }),
  setChromaCollectionName: (name) => set({ chromaCollectionName: name }),
  setChromaCollections: (collections) => set({ chromaCollections: collections }),
  setIsUploadingChroma: (v) => set({ isUploadingChroma: v }),
  setChromaError: (err) => set({ chromaError: err }),
  setChromaSuccess: (msg) => set({ chromaSuccess: msg }),

  setFaissApiBase: (url) => set({ faissApiBase: url }),
  setFaissIndexesDir: (dir) => set({ faissIndexesDir: dir }),
  setFaissNewDbName: (name) => set({ faissNewDbName: name }),
  setFaissDbPath: (path) => set({ faissDbPath: path }),
  setFaissDbMode: (mode) => set({ faissDbMode: mode }),
  setFaissDimension: (dimension) => set({ faissDimension: dimension }),
  setFaissMetric: (metric) => set({ faissMetric: metric }),
  setSelectedVectorDb: (provider) => set({ selectedVectorDb: provider }),

  setAllChunksCollapsed: (v) => set({ allChunksCollapsed: v }),

  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setSidebarWidth: (w) => {
    set({ sidebarWidth: w });
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--sidebar-width", `${w}px`);
    }
  },
  setScrollActiveStep: (step) => set({ scrollActiveStep: step }),

  setEnvKeys: (keys) =>
    set((s) => ({ envKeys: { ...s.envKeys, ...keys } })),

  resetChunkingDefaults: () =>
    set({
      chunkingParams: {
        chunkingType: "recursive",
        separators: DEFAULT_SEPARATORS,
        chunkSize: DEFAULT_CHUNK_SIZE,
        chunkOverlap: DEFAULT_CHUNK_OVERLAP,
      },
    }),

  resetAll: () => {
    const s = get();
    // Sync sidebar width visual immediately
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--sidebar-width", "288px");
    }
    set({
      files: [],
      pipeline: "",
      pipelinesByExt: {},
      configByExt: {},
      configByFile: {},
      openrouterApiKey: s.envKeys.openrouter || s.openrouterApiKey || "",
      openrouterModel: s.openrouterModel || "google/gemini-3-flash-preview",
      openrouterPrompt: "",
      pdfEngine: s.pdfEngine || "native",
      excelSheet: "",
      excelSheets: [],
      excelColumn: "",
      excelSelectedColumns: [],
      excelColumns: [],
      ollamaEndpoint: s.ollamaEndpoint || DEFAULT_OLLAMA_ENDPOINT,
      ollamaModel: s.ollamaModel || "",
      ollamaPrompt: "",
      vllmEndpoint: s.vllmEndpoint || DEFAULT_VLLM_ENDPOINT,
      vllmAdditionalEndpoints: s.vllmAdditionalEndpoints || [],
      vllmModel: s.vllmModel || "",
      vllmPrompt: "",
      parsedContent: null,
      parsedFilename: "",
      parsedDocType: "",
      parsedExcelRows: null,
      parsedResults: [],
      currentProcessingFile: "",
      parseCache: {},
      isParsing: false,
      parseProgress: 0,
      parseProgressMsg: "",
      parseError: null,
      chunkingParams: s.chunkingParams,
      editedChunks: [],
      chunkSourceFiles: [],
      isChunking: false,
      chunksHash: hashChunks([]),
      embeddingProvider: s.lastEmbeddingProvider || "openrouter",
      voyageApiKey: s.envKeys.voyage || s.voyageApiKey || "",
      voyageModel: s.voyageModel || "voyage-4",
      cohereApiKey: s.envKeys.cohere || s.cohereApiKey || "",
      cohereModel: s.cohereModel || "embed-english-v3.0",
      openrouterEmbeddingModel: s.openrouterEmbeddingModel || "qwen/qwen3-embedding-8b",
      embeddingDimensions: s.embeddingDimensions || DEFAULT_EMBEDDING_DIMENSIONS,
      ollamaEmbeddingModel: s.ollamaEmbeddingModel || "",
      ollamaEmbeddingEndpoint: s.ollamaEmbeddingEndpoint || DEFAULT_OLLAMA_ENDPOINT,
      vllmEmbeddingModel: s.vllmEmbeddingModel || "",
      vllmEmbeddingEndpoint: s.vllmEmbeddingEndpoint || DEFAULT_VLLM_EMBEDDING_ENDPOINT,
      embeddingsData: null,
      embeddingsForChunksHash: null,
      embeddingChunkCache: {},
      embeddingsMeta: null,
      isEmbedding: false,
      embeddingError: null,
      pineconeApiKey: s.envKeys.pinecone || s.pineconeApiKey || "",
      pineconeEnvKey: s.pineconeEnvKey || "aws-us-east-1",
      pineconeIndexName: s.pineconeIndexName || "",
      pineconeIndexes: [],
      pineconeNamespace: s.pineconeNamespace || "",
      pineconeNamespaces: [],
      pineconeFieldMapping: s.pineconeFieldMapping || { idPrefix: "", textField: "text", filenameField: "filename" },
      isUploadingPinecone: false,
      pineconeError: null,
      pineconeSuccess: null,
      chromaMode: s.chromaMode || "local",
      chromaLocalUrl: s.chromaLocalUrl || DEFAULT_CHROMA_ENDPOINT,
      chromaApiKey: "",
      chromaTenant: s.chromaTenant || "",
      chromaDatabase: s.chromaDatabase || "default_database",
      chromaDatabases: [],
      chromaCollectionName: s.chromaCollectionName || "",
      chromaCollections: [],
      isUploadingChroma: false,
      chromaError: null,
      chromaSuccess: null,
      faissApiBase: s.faissApiBase || DEFAULT_FAISS_ENDPOINT,
      faissIndexesDir: s.faissIndexesDir || "/tmp/chunkcanvas",
      faissNewDbName: s.faissNewDbName || "index",
      faissDbPath: s.faissDbPath || "/tmp/chunkcanvas/index.faiss",
      faissDbMode: s.faissDbMode || "existing",
      faissDimension: s.faissDimension || DEFAULT_EMBEDDING_DIMENSIONS,
      faissMetric: s.faissMetric || "cosine",
      allChunksCollapsed: true,
      scrollActiveStep: null,
      sidebarWidth: 288,
      // Keep persisted preferences intact (not cleared on reset)
      // lastPipelineByExt, lastConfigByExt, lastEmbeddingProvider are preserved
    });
  },

  resetDownstream: (fromStep) => {
    const resets: Partial<AppState> = {};
    if (fromStep <= 1) {
      resets.pipeline = "";
      resets.pipelinesByExt = {};
      resets.configByExt = {};
      resets.configByFile = {};
    }
    if (fromStep <= 2) {
      resets.parsedContent = null;
      resets.parsedExcelRows = null;
      resets.parseError = null;
      resets.parseProgress = 0;
      resets.parsedResults = [];
      resets.currentProcessingFile = "";
    }
    if (fromStep <= 3) {
      resets.editedChunks = [];
      resets.chunkSourceFiles = [];
    }
    if (fromStep <= 4) {
      // Keep embeddings caches/history; only mark active embeddings as out-of-date.
      resets.embeddingsForChunksHash = null;
      resets.embeddingError = null;
    }
    if (fromStep <= 5) {
      resets.pineconeSuccess = null;
      resets.pineconeError = null;
      resets.chromaSuccess = null;
      resets.chromaError = null;
    }
    set(resets);
  },

  // ── Persist helpers ───────────────────────────────────────
  _saveLastPipeline: (ext, pipeline) => {
    set((s) => ({
      lastPipelineByExt: { ...s.lastPipelineByExt, [ext]: pipeline },
    }));
  },
  _saveLastConfig: (ext, config) => {
    set((s) => ({
      lastConfigByExt: { ...s.lastConfigByExt, [ext]: config },
    }));
  },
}),
    {
      name: "chunkcanvas-preferences",
      version: 1,
      /**
       * Only persist user-configurable preferences — NOT transient session
       * data (files, parsed content, progress, embeddings, etc.).
       */
      partialize: (state) => ({
        // Pipeline memory per extension
        lastPipelineByExt: state.lastPipelineByExt,
        lastConfigByExt: state.lastConfigByExt,
        lastEmbeddingProvider: state.lastEmbeddingProvider,

        // ⛔ API keys are NOT persisted — they come from .env or are entered per session.
        // Storing secrets in localStorage is unsafe for public Docker/cloud deployments.

        // OpenRouter parsing defaults
        openrouterModel: state.openrouterModel,
        pdfEngine: state.pdfEngine,

        // Ollama parsing defaults
        ollamaEndpoint: state.ollamaEndpoint,
        ollamaModel: state.ollamaModel,

        // vLLM parsing defaults
        vllmEndpoint: state.vllmEndpoint,
        vllmAdditionalEndpoints: state.vllmAdditionalEndpoints,
        vllmModel: state.vllmModel,

        // Embedding settings
        embeddingProvider: state.embeddingProvider,
        voyageModel: state.voyageModel,
        cohereModel: state.cohereModel,
        openrouterEmbeddingModel: state.openrouterEmbeddingModel,
        embeddingDimensions: state.embeddingDimensions,
        ollamaEmbeddingModel: state.ollamaEmbeddingModel,
        ollamaEmbeddingEndpoint: state.ollamaEmbeddingEndpoint,
        vllmEmbeddingModel: state.vllmEmbeddingModel,
        vllmEmbeddingEndpoint: state.vllmEmbeddingEndpoint,

        // Pinecone settings
        pineconeEnvKey: state.pineconeEnvKey,
        pineconeIndexName: state.pineconeIndexName,
        pineconeNamespace: state.pineconeNamespace,
        pineconeFieldMapping: state.pineconeFieldMapping,

        // Chroma settings
        chromaMode: state.chromaMode,
        chromaLocalUrl: state.chromaLocalUrl,
        chromaDatabase: state.chromaDatabase,
        chromaCollectionName: state.chromaCollectionName,

        // FAISS settings
        faissApiBase: state.faissApiBase,
        faissIndexesDir: state.faissIndexesDir,
        faissNewDbName: state.faissNewDbName,
        faissDbPath: state.faissDbPath,
        faissDbMode: state.faissDbMode,
        faissDimension: state.faissDimension,
        faissMetric: state.faissMetric,
        selectedVectorDb: state.selectedVectorDb,

        // Chunking settings
        chunkingParams: state.chunkingParams,

        // UI preferences
        allChunksCollapsed: state.allChunksCollapsed,
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarWidth: state.sidebarWidth,
        // Theme removed
      }),
      /**
       * Merge persisted preferences into the initial state on hydration.
       * Transient fields keep their defaults; persisted fields are restored.
       */
      merge: (persisted, current) => {
        const p = persisted as Partial<AppState>;
        return {
          ...current,
          ...p,
          // Never restore transient session state from storage
          files: [],
          pipeline: "",
          pipelinesByExt: {},
          configByExt: {},
          parsedContent: null,
          parsedFilename: "",
          parsedDocType: "",
          parsedExcelRows: null,
          isParsing: false,
          parseProgress: 0,
          parseProgressMsg: "",
          parseError: null,
          parsedResults: [],
          currentProcessingFile: "",
          parseCache: {},
          editedChunks: [],
          chunkSourceFiles: [],
          isChunking: false,
          chunksHash: hashChunks([]),
          embeddingsData: null,
          isEmbedding: false,
          embeddingsForChunksHash: null,
          embeddingChunkCache: {},
          embeddingsMeta: null,
          embeddingError: null,
          pineconeIndexes: [],
          pineconeNamespaces: [],
          isUploadingPinecone: false,
          pineconeError: null,
          pineconeSuccess: null,
          chromaCollections: [],
          isUploadingChroma: false,
          chromaError: null,
          chromaSuccess: null,
          scrollActiveStep: null,
          envKeys: { openrouter: "", voyage: "", cohere: "", pinecone: "" },
        };
      },
    },
  ),
);
