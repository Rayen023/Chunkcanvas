/**
 * Central Zustand store — single source of truth for the entire app.
 */
import { create } from "zustand";
import type { ChunkingParams, EmbeddingProvider, PdfEngine } from "./types";
import { DEFAULT_CHUNK_SIZE, DEFAULT_CHUNK_OVERLAP, DEFAULT_SEPARATORS, DEFAULT_OLLAMA_ENDPOINT, DEFAULT_EMBEDDING_DIMENSIONS } from "./constants";

export interface AppState {
  // ── Step 1 ────────────────────────────────────
  file: File | null;
  pipeline: string;

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

  // ── Step 3b — chunking ────────────────────────
  chunkingParams: ChunkingParams;

  // ── Step 4 — editable chunks ──────────────────
  editedChunks: string[];
  isChunking: boolean;

  // ── Step 6 — embeddings ───────────────────────
  embeddingProvider: EmbeddingProvider;
  voyageApiKey: string;
  voyageModel: string;
  openrouterEmbeddingModel: string;
  embeddingDimensions: number;
  ollamaEmbeddingModel: string;
  ollamaEmbeddingEndpoint: string;
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
  isUploadingPinecone: boolean;
  pineconeError: string | null;
  pineconeSuccess: string | null;

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
    pinecone: string;
  };
}

export interface AppActions {
  // Step 1
  setFile: (file: File | null) => void;
  setPipeline: (pipeline: string) => void;

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

  // Step 3
  setParsedContent: (content: string | null) => void;
  setParsedFilename: (name: string) => void;
  setParsedDocType: (docType: string) => void;
  setParsedExcelRows: (rows: string[] | null) => void;
  setIsParsing: (v: boolean) => void;
  setParseProgress: (pct: number, msg?: string) => void;
  setParseError: (err: string | null) => void;

  // Step 3b
  setChunkingParams: (params: Partial<ChunkingParams>) => void;

  // Step 4
  setEditedChunks: (chunks: string[]) => void;
  updateChunk: (index: number, text: string) => void;
  deleteChunk: (index: number) => void;
  setIsChunking: (v: boolean) => void;

  // Step 6
  setEmbeddingProvider: (provider: EmbeddingProvider) => void;
  setVoyageApiKey: (key: string) => void;
  setVoyageModel: (model: string) => void;
  setOpenrouterEmbeddingModel: (model: string) => void;
  setEmbeddingDimensions: (dims: number) => void;
  setOllamaEmbeddingModel: (model: string) => void;
  setOllamaEmbeddingEndpoint: (ep: string) => void;
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
  setIsUploadingPinecone: (v: boolean) => void;
  setPineconeError: (err: string | null) => void;
  setPineconeSuccess: (msg: string | null) => void;

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
}

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  // ── Initial state ─────────────────────────────────────────
  file: null,
  pipeline: "",
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

  parsedContent: null,
  parsedFilename: "",
  parsedDocType: "",
  parsedExcelRows: null,
  isParsing: false,
  parseProgress: 0,
  parseProgressMsg: "",
  parseError: null,
  chunkingParams: {
    separators: DEFAULT_SEPARATORS,
    chunkSize: DEFAULT_CHUNK_SIZE,
    chunkOverlap: DEFAULT_CHUNK_OVERLAP,
  },
  editedChunks: [],
  isChunking: false,
  embeddingProvider: "openrouter",
  voyageApiKey: "",
  voyageModel: "voyage-4",
  openrouterEmbeddingModel: "qwen/qwen3-embedding-8b",
  embeddingDimensions: DEFAULT_EMBEDDING_DIMENSIONS,
  ollamaEmbeddingModel: "",
  ollamaEmbeddingEndpoint: DEFAULT_OLLAMA_ENDPOINT,
  embeddingsData: null,
  isEmbedding: false,
  embeddingError: null,
  pineconeApiKey: "",
  pineconeEnvKey: "aws-us-east-1",
  pineconeIndexName: "",
  pineconeIndexes: [],
  pineconeNamespace: "",
  pineconeNamespaces: [],
  isUploadingPinecone: false,
  pineconeError: null,
  pineconeSuccess: null,
  allChunksCollapsed: false,
  sidebarCollapsed: false,
  sidebarWidth: 288,
  scrollActiveStep: null,
  envKeys: { openrouter: "", voyage: "", pinecone: "" },

  // ── Actions ───────────────────────────────────────────────
  setFile: (file) => {
    set({ file, pipeline: "" });
    get().resetDownstream(1);
  },
  setPipeline: (pipeline) => {
    set({ pipeline });
    get().resetDownstream(2);
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

  setParsedContent: (content) => set({ parsedContent: content }),
  setParsedFilename: (name) => set({ parsedFilename: name }),
  setParsedDocType: (docType) => set({ parsedDocType: docType }),
  setParsedExcelRows: (rows) => set({ parsedExcelRows: rows }),
  setIsParsing: (v) => set({ isParsing: v }),
  setParseProgress: (pct, msg) =>
    set({ parseProgress: pct, parseProgressMsg: msg ?? "" }),
  setParseError: (err) => set({ parseError: err }),

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

  setEmbeddingProvider: (provider) => set({ embeddingProvider: provider, embeddingsData: null, embeddingError: null }),
  setVoyageApiKey: (key) => set({ voyageApiKey: key }),
  setVoyageModel: (model) => set({ voyageModel: model }),
  setOpenrouterEmbeddingModel: (model) => set({ openrouterEmbeddingModel: model }),
  setEmbeddingDimensions: (dims) => set({ embeddingDimensions: dims }),
  setOllamaEmbeddingModel: (model) => set({ ollamaEmbeddingModel: model }),
  setOllamaEmbeddingEndpoint: (ep) => set({ ollamaEmbeddingEndpoint: ep }),
  setEmbeddingsData: (data) => set({ embeddingsData: data }),
  setIsEmbedding: (v) => set({ isEmbedding: v }),
  setEmbeddingError: (err) => set({ embeddingError: err }),

  setPineconeApiKey: (key) => set({ pineconeApiKey: key }),
  setPineconeEnvKey: (key) => set({ pineconeEnvKey: key }),
  setPineconeIndexName: (name) => set({ pineconeIndexName: name }),
  setPineconeIndexes: (indexes) => set({ pineconeIndexes: indexes }),
  setPineconeNamespace: (ns) => set({ pineconeNamespace: ns }),
  setPineconeNamespaces: (namespaces) => set({ pineconeNamespaces: namespaces }),
  setIsUploadingPinecone: (v) => set({ isUploadingPinecone: v }),
  setPineconeError: (err) => set({ pineconeError: err }),
  setPineconeSuccess: (msg) => set({ pineconeSuccess: msg }),

  setAllChunksCollapsed: (v) => set({ allChunksCollapsed: v }),

  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  setScrollActiveStep: (step) => set({ scrollActiveStep: step }),

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
      file: null,
      pipeline: "",
      openrouterApiKey: s.envKeys.openrouter || "",
      openrouterModel: "google/gemini-3-flash-preview",
      openrouterPrompt: "",
      pdfEngine: "native",
      excelSheet: "",
      excelSheets: [],
      excelColumn: "",
      excelColumns: [],
      ollamaEndpoint: DEFAULT_OLLAMA_ENDPOINT,
      ollamaModel: "",
      ollamaPrompt: "",
      parsedContent: null,
      parsedFilename: "",
      parsedDocType: "",
      parsedExcelRows: null,
      isParsing: false,
      parseProgress: 0,
      parseProgressMsg: "",
      parseError: null,
      chunkingParams: {
        separators: DEFAULT_SEPARATORS,
        chunkSize: DEFAULT_CHUNK_SIZE,
        chunkOverlap: DEFAULT_CHUNK_OVERLAP,
      },
      editedChunks: [],
      isChunking: false,
      embeddingProvider: "openrouter",
      voyageApiKey: s.envKeys.voyage || "",
      voyageModel: "voyage-4",
      openrouterEmbeddingModel: "qwen/qwen3-embedding-8b",
      embeddingDimensions: DEFAULT_EMBEDDING_DIMENSIONS,
      ollamaEmbeddingModel: "",
      ollamaEmbeddingEndpoint: DEFAULT_OLLAMA_ENDPOINT,
      embeddingsData: null,
      isEmbedding: false,
      embeddingError: null,
      pineconeApiKey: s.envKeys.pinecone || "",
      pineconeEnvKey: "aws-us-east-1",
      pineconeIndexName: "",
      pineconeIndexes: [],
      pineconeNamespace: "",
      pineconeNamespaces: [],
      isUploadingPinecone: false,
      pineconeError: null,
      pineconeSuccess: null,
      allChunksCollapsed: false,
      scrollActiveStep: null,
    });
  },

  resetDownstream: (fromStep) => {
    const resets: Partial<AppState> = {};
    if (fromStep <= 1) {
      resets.pipeline = "";
    }
    if (fromStep <= 2) {
      resets.parsedContent = null;
      resets.parsedExcelRows = null;
      resets.parseError = null;
      resets.parseProgress = 0;
    }
    if (fromStep <= 3) {
      resets.editedChunks = [];
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
}));
