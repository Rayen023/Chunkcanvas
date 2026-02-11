/**
 * Central Zustand store — single source of truth for the entire app.
 * Persists user preferences (ports, models, API keys, pipeline choices)
 * to localStorage so they survive page reloads.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChunkingParams, EmbeddingProvider, PdfEngine, ParsedFileResult, PineconeFieldMapping, ExtPipelineConfig } from "./types";
import { DEFAULT_CHUNK_SIZE, DEFAULT_CHUNK_OVERLAP, DEFAULT_SEPARATORS, DEFAULT_OLLAMA_ENDPOINT, DEFAULT_EMBEDDING_DIMENSIONS, DEFAULT_VLLM_ENDPOINT, DEFAULT_VLLM_EMBEDDING_ENDPOINT } from "./constants";

export interface AppState {
  // ── Step 1 ────────────────────────────────────
  files: File[];
  pipeline: string;
  pipelinesByExt: Record<string, string>;
  configByExt: Record<string, ExtPipelineConfig>;

  // ── Step 2 — pipeline form data ───────────────
  openrouterApiKey: string;
  openrouterModel: string;
  openrouterPrompt: string;
  openrouterPagesPerBatch: number;
  pdfEngine: PdfEngine;
  excelSheet: string;
  excelSheets: string[];
  excelColumn: string;
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

  // ── Step 3b — chunking ────────────────────────
  chunkingParams: ChunkingParams;

  // ── Step 4 — editable chunks ──────────────────
  editedChunks: string[];
  chunkSourceFiles: string[];
  isChunking: boolean;

  // ── Step 6 — embeddings ───────────────────────
  embeddingProvider: EmbeddingProvider;
  voyageApiKey: string;
  voyageModel: string;
  openrouterEmbeddingModel: string;
  embeddingDimensions: number;
  ollamaEmbeddingModel: string;
  ollamaEmbeddingEndpoint: string;
  vllmEmbeddingModel: string;
  vllmEmbeddingEndpoint: string;
  embeddingsData: number[][] | null;
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

  // ── UI state ───────────────────────────────────
  allChunksCollapsed: boolean;

  // ── Sidebar ───────────────────────────────────
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  scrollActiveStep: number | null;
  theme: "light" | "dark" | "system";

  // ── API keys from env ─────────────────────────
  envKeys: {
    openrouter: string;
    voyage: string;
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

  // Step 2
  setOpenrouterApiKey: (key: string) => void;
  setOpenrouterModel: (model: string) => void;
  setOpenrouterPrompt: (prompt: string) => void;
  setOpenrouterPagesPerBatch: (n: number) => void;
  setPdfEngine: (engine: PdfEngine) => void;
  setExcelSheet: (sheet: string) => void;
  setExcelSheets: (sheets: string[]) => void;
  setExcelColumn: (col: string) => void;
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
  setOpenrouterEmbeddingModel: (model: string) => void;
  setEmbeddingDimensions: (dims: number) => void;
  setOllamaEmbeddingModel: (model: string) => void;
  setOllamaEmbeddingEndpoint: (ep: string) => void;
  setVllmEmbeddingModel: (model: string) => void;
  setVllmEmbeddingEndpoint: (ep: string) => void;
  setEmbeddingsData: (data: number[][] | null) => void;
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

  // Sidebar
  setSidebarCollapsed: (v: boolean) => void;
  setSidebarWidth: (w: number) => void;
  setScrollActiveStep: (step: number | null) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;

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
    excelSheet: "",
    excelSheets: [],
    excelColumn: "",
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
  openrouterApiKey: "",
  openrouterModel: "google/gemini-3-flash-preview",
  openrouterPrompt: "",
  openrouterPagesPerBatch: 0,
  pdfEngine: "native",
  excelSheet: "",
  excelSheets: [],
  excelColumn: "",
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
  chunkingParams: {
    separators: DEFAULT_SEPARATORS,
    chunkSize: DEFAULT_CHUNK_SIZE,
    chunkOverlap: DEFAULT_CHUNK_OVERLAP,
  },
  editedChunks: [],
  chunkSourceFiles: [],
  isChunking: false,
  embeddingProvider: "openrouter",
  voyageApiKey: "",
  voyageModel: "voyage-4",
  openrouterEmbeddingModel: "qwen/qwen3-embedding-8b",
  embeddingDimensions: DEFAULT_EMBEDDING_DIMENSIONS,
  ollamaEmbeddingModel: "",
  ollamaEmbeddingEndpoint: DEFAULT_OLLAMA_ENDPOINT,
  vllmEmbeddingModel: "jinaai/jina-embeddings-v3",
  vllmEmbeddingEndpoint: DEFAULT_VLLM_EMBEDDING_ENDPOINT,
  embeddingsData: null,
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
  allChunksCollapsed: false,
  sidebarCollapsed: false,
  sidebarWidth: 288,
  scrollActiveStep: null,
  theme: "system",
  envKeys: { openrouter: "", voyage: "", pinecone: "" },

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
    set({ files, pipeline: vals[0] || "", pipelinesByExt: newPipelinesByExt, configByExt: newConfigByExt });
    get().resetDownstream(2);
  },
  addFiles: (newFiles) => {
    set((s) => ({ files: [...s.files, ...newFiles] }));
    get().resetDownstream(2);
  },
  removeFile: (index) => {
    set((s) => {
      const next = s.files.filter((_, i) => i !== index);
      const remainingExts = new Set(next.map(f => f.name.split(".").pop()?.toLowerCase() ?? ""));
      const nextPipelines = { ...s.pipelinesByExt };
      const nextConfig = { ...s.configByExt };
      for (const ext of Object.keys(nextPipelines)) {
        if (!remainingExts.has(ext)) {
          delete nextPipelines[ext];
          delete nextConfig[ext];
        }
      }
      const vals = Object.values(nextPipelines).filter(Boolean);
      return { files: next, pipelinesByExt: nextPipelines, pipeline: vals[0] || "", configByExt: nextConfig };
    });
    get().resetDownstream(2);
  },
  setPipeline: (pipeline) => {
    set({ pipeline });
    get().resetDownstream(2);
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
    get().resetDownstream(2);
  },
  setConfigForExt: (ext, config) => {
    set((s) => {
      const current = s.configByExt[ext] ?? defaultExtConfig();
      const updated = { ...current, ...config };
      return {
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

  setOpenrouterApiKey: (key) => set({ openrouterApiKey: key }),
  setOpenrouterModel: (model) => set({ openrouterModel: model }),
  setOpenrouterPrompt: (prompt) => set({ openrouterPrompt: prompt }),
  setOpenrouterPagesPerBatch: (n) => set({ openrouterPagesPerBatch: n }),
  setPdfEngine: (engine) => set({ pdfEngine: engine }),
  setExcelSheet: (sheet) => set({ excelSheet: sheet }),
  setExcelSheets: (sheets) => set({ excelSheets: sheets }),
  setExcelColumn: (col) => set({ excelColumn: col }),
  setExcelColumns: (cols) => set({ excelColumns: cols }),

  setOllamaEndpoint: (ep) => set({ ollamaEndpoint: ep }),
  setOllamaModel: (model) => set({ ollamaModel: model }),
  setOllamaPrompt: (prompt) => set({ ollamaPrompt: prompt }),

  setVllmEndpoint: (ep) => set({ vllmEndpoint: ep }),
  setVllmAdditionalEndpoints: (eps) => set({ vllmAdditionalEndpoints: eps }),
  setVllmModel: (model) => set({ vllmModel: model }),
  setVllmPrompt: (prompt) => set({ vllmPrompt: prompt }),

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

  setChunkingParams: (params) =>
    set((s) => ({
      chunkingParams: { ...s.chunkingParams, ...params },
    })),

  setEditedChunks: (chunks) => set({ editedChunks: chunks }),
  updateChunk: (index, text) =>
    set((s) => {
      const next = [...s.editedChunks];
      next[index] = text;
      // Reset embeddings when chunks are edited
      return {
        editedChunks: next,
        embeddingsData: null,
        embeddingError: null,
        pineconeSuccess: null,
        pineconeError: null,
      };
    }),
  deleteChunk: (index) =>
    set((s) => ({
      editedChunks: s.editedChunks.filter((_, i) => i !== index),
      // Reset embeddings when chunks are deleted
      embeddingsData: null,
      embeddingError: null,
      pineconeSuccess: null,
      pineconeError: null,
    })),
  setIsChunking: (v) => set({ isChunking: v }),
  setChunkSourceFiles: (files) => set({ chunkSourceFiles: files }),

  setEmbeddingProvider: (provider) => set({ embeddingProvider: provider, embeddingsData: null, embeddingError: null, lastEmbeddingProvider: provider }),
  setVoyageApiKey: (key) => set({ voyageApiKey: key }),
  setVoyageModel: (model) => set({ voyageModel: model }),
  setOpenrouterEmbeddingModel: (model) => set({ openrouterEmbeddingModel: model }),
  setEmbeddingDimensions: (dims) => set({ embeddingDimensions: dims }),
  setOllamaEmbeddingModel: (model) => set({ ollamaEmbeddingModel: model }),
  setOllamaEmbeddingEndpoint: (ep) => set({ ollamaEmbeddingEndpoint: ep }),
  setVllmEmbeddingModel: (model) => set({ vllmEmbeddingModel: model }),
  setVllmEmbeddingEndpoint: (ep) => set({ vllmEmbeddingEndpoint: ep }),
  setEmbeddingsData: (data) => set({ embeddingsData: data }),
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

  setAllChunksCollapsed: (v) => set({ allChunksCollapsed: v }),

  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  setScrollActiveStep: (step) => set({ scrollActiveStep: step }),
  setTheme: (theme) => set({ theme }),

  setEnvKeys: (keys) =>
    set((s) => ({ envKeys: { ...s.envKeys, ...keys } })),

  resetChunkingDefaults: () =>
    set({
      chunkingParams: {
        separators: DEFAULT_SEPARATORS,
        chunkSize: DEFAULT_CHUNK_SIZE,
        chunkOverlap: DEFAULT_CHUNK_OVERLAP,
      },
    }),

  resetAll: () => {
    const s = get();
    set({
      files: [],
      pipeline: "",
      pipelinesByExt: {},
      configByExt: {},
      openrouterApiKey: s.envKeys.openrouter || s.openrouterApiKey || "",
      openrouterModel: s.openrouterModel || "google/gemini-3-flash-preview",
      openrouterPrompt: "",
      pdfEngine: s.pdfEngine || "native",
      excelSheet: "",
      excelSheets: [],
      excelColumn: "",
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
      isParsing: false,
      parseProgress: 0,
      parseProgressMsg: "",
      parseError: null,
      chunkingParams: s.chunkingParams,
      editedChunks: [],
      chunkSourceFiles: [],
      isChunking: false,
      embeddingProvider: s.lastEmbeddingProvider || "openrouter",
      voyageApiKey: s.envKeys.voyage || s.voyageApiKey || "",
      voyageModel: s.voyageModel || "voyage-4",
      openrouterEmbeddingModel: s.openrouterEmbeddingModel || "qwen/qwen3-embedding-8b",
      embeddingDimensions: s.embeddingDimensions || DEFAULT_EMBEDDING_DIMENSIONS,
      ollamaEmbeddingModel: s.ollamaEmbeddingModel || "",
      ollamaEmbeddingEndpoint: s.ollamaEmbeddingEndpoint || DEFAULT_OLLAMA_ENDPOINT,
      vllmEmbeddingModel: s.vllmEmbeddingModel || "",
      vllmEmbeddingEndpoint: s.vllmEmbeddingEndpoint || DEFAULT_VLLM_EMBEDDING_ENDPOINT,
      embeddingsData: null,
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
      allChunksCollapsed: false,
      scrollActiveStep: null,
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
      resets.embeddingsData = null;
      resets.embeddingError = null;
    }
    if (fromStep <= 5) {
      resets.pineconeSuccess = null;
      resets.pineconeError = null;
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

        // Chunking parameters
        chunkingParams: state.chunkingParams,

        // Embedding settings
        embeddingProvider: state.embeddingProvider,
        voyageModel: state.voyageModel,
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

        // UI preferences
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarWidth: state.sidebarWidth,
        theme: state.theme,
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
          editedChunks: [],
          chunkSourceFiles: [],
          isChunking: false,
          embeddingsData: null,
          isEmbedding: false,
          embeddingError: null,
          pineconeIndexes: [],
          pineconeNamespaces: [],
          isUploadingPinecone: false,
          pineconeError: null,
          pineconeSuccess: null,
          allChunksCollapsed: false,
          scrollActiveStep: null,
          envKeys: { openrouter: "", voyage: "", pinecone: "" },
        };
      },
    },
  ),
);
