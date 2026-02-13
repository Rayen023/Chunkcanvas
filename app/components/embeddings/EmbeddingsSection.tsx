"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useAppStore } from "@/app/lib/store";
import { VOYAGE_MODELS, COHERE_MODELS, EMBEDDING_MODELS, OPENROUTER_DEFAULT_EMBEDDING_MODEL, DEFAULT_OLLAMA_ENDPOINT, DEFAULT_EMBEDDING_DIMENSIONS } from "@/app/lib/constants";
import ActionRow from "@/app/components/downloads/ActionRow";
import { ProviderSelector, ConfigContainer, ConfigHeader, ProviderOption } from "@/app/components/shared/ConfigSection";
import StatusMessage from "@/app/components/shared/StatusMessage";
import type { EmbeddingsJson } from "@/app/lib/types";
import type { ScriptConfig } from "@/app/lib/script-generator";
import { PIPELINE } from "@/app/lib/constants";

const PROVIDER_OPTIONS: ProviderOption[] = [
  { id: "openrouter", label: "OpenRouter", icon: "/tech-icons/openrouter.svg", badge: "Cloud", requiresApiKey: true },
  { id: "voyage", label: "Voyage AI", icon: "/tech-icons/voyage-color.svg", badge: "Cloud", requiresApiKey: true },
  { id: "cohere", label: "Cohere", icon: "/tech-icons/cohere-color.svg", badge: "Cloud", requiresApiKey: true },
  { id: "ollama", label: "Ollama", icon: "/tech-icons/ollama.svg", badge: "Local", requiresApiKey: false },
  { id: "vllm", label: "vLLM", icon: "/tech-icons/vllm-color.svg", badge: "Local", requiresApiKey: false },
];

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function chunkEmbeddingCacheKey(opts: {
  provider: string;
  modelKey: string;
  dimensions: number;
  endpoint?: string;
  chunkText: string;
}): string {
  const endpointPart = opts.endpoint ? `|ep:${opts.endpoint}` : "";
  return `v1|p:${opts.provider}|m:${opts.modelKey}|d:${opts.dimensions}${endpointPart}|t:${fnv1a32(opts.chunkText)}`;
}

interface OllamaEmbedModel {
  name: string;
  parameterSize?: string;
  embeddingDimensions?: number;
}

/** Format pricing for display: convert per-token price to $/M tokens */
function formatPricing(pricePerToken: string): string {
  const val = parseFloat(pricePerToken);
  if (isNaN(val) || val === 0) return "Free";
  const perMillion = val * 1_000_000;
  if (perMillion < 0.01) return `$${perMillion.toFixed(4)}/M`;
  if (perMillion < 1) return `$${perMillion.toFixed(3)}/M`;
  return `$${perMillion.toFixed(2)}/M`;
}

/** Format context length for display */
function formatCtx(ctx: number): string {
  if (!ctx || ctx === 0) return "?";
  if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(1)}M`;
  if (ctx >= 1_000) return `${Math.round(ctx / 1_000)}k`;
  return String(ctx);
}

interface VllmEmbedModel {
  id: string;
  max_model_len?: number;
}

export default function EmbeddingsSection() {
  const editedChunks = useAppStore((s) => s.editedChunks);
  const parsedFilename = useAppStore((s) => s.parsedFilename);
  const pipeline = useAppStore((s) => s.pipeline);

  // Embedding provider
  const embeddingProvider = useAppStore((s) => s.embeddingProvider);
  const setEmbeddingProvider = useAppStore((s) => s.setEmbeddingProvider);

  // Voyage state
  const voyageApiKey = useAppStore((s) => s.voyageApiKey);
  const voyageModel = useAppStore((s) => s.voyageModel);
  const envVoyageKey = useAppStore((s) => s.envKeys.voyage);
  const setVoyageApiKey = useAppStore((s) => s.setVoyageApiKey);
  const setVoyageModel = useAppStore((s) => s.setVoyageModel);

  // Cohere state
  const cohereApiKey = useAppStore((s) => s.cohereApiKey);
  const cohereModel = useAppStore((s) => s.cohereModel);
  const envCohereKey = useAppStore((s) => s.envKeys.cohere);
  const setCohereApiKey = useAppStore((s) => s.setCohereApiKey);
  const setCohereModel = useAppStore((s) => s.setCohereModel);

  // OpenRouter state
  const openrouterApiKey = useAppStore((s) => s.openrouterApiKey);
  const envOpenrouterKey = useAppStore((s) => s.envKeys.openrouter);
  const openrouterEmbeddingModel = useAppStore((s) => s.openrouterEmbeddingModel);
  const setOpenrouterApiKey = useAppStore((s) => s.setOpenrouterApiKey);
  const setOpenrouterEmbeddingModel = useAppStore((s) => s.setOpenrouterEmbeddingModel);

  // Ollama state
  const ollamaEmbeddingModel = useAppStore((s) => s.ollamaEmbeddingModel);
  const ollamaEmbeddingEndpoint = useAppStore((s) => s.ollamaEmbeddingEndpoint);
  const setOllamaEmbeddingModel = useAppStore((s) => s.setOllamaEmbeddingModel);
  const setOllamaEmbeddingEndpoint = useAppStore((s) => s.setOllamaEmbeddingEndpoint);

  // vLLM state
  const vllmEmbeddingModel = useAppStore((s) => s.vllmEmbeddingModel);
  const vllmEmbeddingEndpoint = useAppStore((s) => s.vllmEmbeddingEndpoint);
  const setVllmEmbeddingModel = useAppStore((s) => s.setVllmEmbeddingModel);
  const setVllmEmbeddingEndpoint = useAppStore((s) => s.setVllmEmbeddingEndpoint);

  // Shared embedding dimensions
  const embeddingDimensions = useAppStore((s) => s.embeddingDimensions);
  const setEmbeddingDimensions = useAppStore((s) => s.setEmbeddingDimensions);

  // Track the user's intended dimensions to restore them when switching to larger models.
  // We initialize from the persistent store value.
  const [userDesiredDimensions, setUserDesiredDimensions] = useState(embeddingDimensions || DEFAULT_EMBEDDING_DIMENSIONS);

  // Ollama embedding models
  const [ollamaEmbedModels, setOllamaEmbedModels] = useState<OllamaEmbedModel[]>([]);
  const [loadingOllamaModels, setLoadingOllamaModels] = useState(false);
  const [ollamaModelError, setOllamaModelError] = useState<string | null>(null);

  // vLLM embedding models
  const [vllmEmbedModels, setVllmEmbedModels] = useState<VllmEmbedModel[]>([]);
  const [loadingVllmModels, setLoadingVllmModels] = useState(false);
  const [vllmModelError, setVllmModelError] = useState<string | null>(null);
  const [showVllmExample, setShowVllmExample] = useState(false);

  // Shared embedding state
  const embeddingsData = useAppStore((s) => s.embeddingsData);
  const embeddingsMeta = useAppStore((s) => s.embeddingsMeta);
  const embeddingChunkCache = useAppStore((s) => s.embeddingChunkCache);
  const setEmbeddingChunkCache = useAppStore((s) => s.setEmbeddingChunkCache);
  const setEmbeddingsMeta = useAppStore((s) => s.setEmbeddingsMeta);
  const isEmbedding = useAppStore((s) => s.isEmbedding);
  const embeddingError = useAppStore((s) => s.embeddingError);
  const setEmbeddingsData = useAppStore((s) => s.setEmbeddingsData);
  const setIsEmbedding = useAppStore((s) => s.setIsEmbedding);
  const setEmbeddingError = useAppStore((s) => s.setEmbeddingError);

  const [downloadingJson, setDownloadingJson] = useState(false);
  const [generatingScript, setGeneratingScript] = useState(false);

  // Script Dependencies
  const chunkingParams = useAppStore((s) => s.chunkingParams);
  const openrouterModel = useAppStore((s) => s.openrouterModel);
  const openrouterPrompt = useAppStore((s) => s.openrouterPrompt);
  const pdfEngine = useAppStore((s) => s.pdfEngine);
  const excelColumn = useAppStore((s) => s.excelColumn);
  const excelSheet = useAppStore((s) => s.excelSheet);
  const pineconeIndexName = useAppStore((s) => s.pineconeIndexName);
  const pineconeEnvKey = useAppStore((s) => s.pineconeEnvKey);

  // ... (OpenRouter embedding models logic) ...
  const orEmbeddingModels = useMemo(() => {
    const sorted = [...EMBEDDING_MODELS];
    sorted.sort((a, b) => {
      if (a.id === OPENROUTER_DEFAULT_EMBEDDING_MODEL) return -1;
      if (b.id === OPENROUTER_DEFAULT_EMBEDDING_MODEL) return 1;
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, []);

  // Auto-fill env keys
  useEffect(() => {
    if (!voyageApiKey && envVoyageKey) setVoyageApiKey(envVoyageKey);
  }, [voyageApiKey, envVoyageKey, setVoyageApiKey]);

  useEffect(() => {
    if (!cohereApiKey && envCohereKey) setCohereApiKey(envCohereKey);
  }, [cohereApiKey, envCohereKey, setCohereApiKey]);

  useEffect(() => {
    if (!openrouterApiKey && envOpenrouterKey) setOpenrouterApiKey(envOpenrouterKey);
  }, [openrouterApiKey, envOpenrouterKey, setOpenrouterApiKey]);

  // Ensure selected OR embedding model is valid
  useEffect(() => {
    if (
      embeddingProvider === "openrouter" &&
      orEmbeddingModels.length > 0 &&
      !orEmbeddingModels.find((m) => m.id === openrouterEmbeddingModel)
    ) {
      setOpenrouterEmbeddingModel(orEmbeddingModels[0].id);
    }
  }, [orEmbeddingModels, openrouterEmbeddingModel, embeddingProvider, setOpenrouterEmbeddingModel, embeddingDimensions]);

  // Fetch Ollama embedding models when provider is ollama
  const fetchOllamaEmbedModels = useCallback(async () => {
    setLoadingOllamaModels(true);
    setOllamaModelError(null);
    try {
      const { listOllamaModelsEnriched, filterEmbeddingModels } = await import("@/app/lib/ollama");
      const all = await listOllamaModelsEnriched(ollamaEmbeddingEndpoint);
      const embedModels = filterEmbeddingModels(all);
      setOllamaEmbedModels(embedModels.map((m) => ({
        name: m.name,
        parameterSize: m.parameterSize,
        embeddingDimensions: m.embeddingDimensions,
      })));
    } catch (err) {
      setOllamaModelError(err instanceof Error ? err.message : "Failed to fetch Ollama models");
      setOllamaEmbedModels([]);
    } finally {
      setLoadingOllamaModels(false);
    }
  }, [ollamaEmbeddingEndpoint]);

  useEffect(() => {
    if (embeddingProvider === "ollama") {
      fetchOllamaEmbedModels();
    }
  }, [embeddingProvider, fetchOllamaEmbedModels]);

  // Ensure selected Ollama embedding model is valid
  useEffect(() => {
    if (
      embeddingProvider === "ollama" &&
      ollamaEmbedModels.length > 0 &&
      !ollamaEmbedModels.find((m) => m.name === ollamaEmbeddingModel)
    ) {
      setOllamaEmbeddingModel(ollamaEmbedModels[0].name);
    }
  }, [ollamaEmbedModels, ollamaEmbeddingModel, embeddingProvider, setOllamaEmbeddingModel]);

  // Fetch vLLM embedding models when provider is vllm
  const fetchVllmEmbedModels = useCallback(async () => {
    if (!vllmEmbeddingEndpoint) return;
    setLoadingVllmModels(true);
    setVllmModelError(null);
    try {
      await import("@/app/lib/vllm");
      // Import type via dynamic import isn't ideal for casting, using standard fetch with types
      const res = await fetch(`${vllmEmbeddingEndpoint}/v1/models`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`vLLM /v1/models: ${res.status}`);
      const json = await res.json();
      const models = ((json.data ?? []) as { id: string; max_model_len?: number }[]).map(m => ({
        id: m.id,
        max_model_len: m.max_model_len
      }));
      setVllmEmbedModels(models);
      if (models.length > 0 && (!vllmEmbeddingModel || !models.find(m => m.id === vllmEmbeddingModel))) {
        setVllmEmbeddingModel(models[0].id);
      }
    } catch (err) {
      setVllmModelError(err instanceof Error ? err.message : "Failed to fetch vLLM models");
      setVllmEmbedModels([]);
    } finally {
      setLoadingVllmModels(false);
    }
  }, [vllmEmbeddingEndpoint, vllmEmbeddingModel, setVllmEmbeddingModel]);

  useEffect(() => {
    if (embeddingProvider === "vllm") {
      const timer = setTimeout(() => {
        fetchVllmEmbedModels();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [embeddingProvider, fetchVllmEmbedModels]);

  // Current active model name for display
  const activeModelLabel = useMemo(() => {
    if (embeddingProvider === "voyage") {
      return VOYAGE_MODELS.find((m) => m.key === voyageModel)?.label ?? voyageModel;
    }
    if (embeddingProvider === "cohere") {
      return COHERE_MODELS.find((m) => m.key === cohereModel)?.label ?? cohereModel;
    }
    if (embeddingProvider === "ollama") {
      return ollamaEmbeddingModel || "Ollama";
    }
    if (embeddingProvider === "vllm") {
      return vllmEmbeddingModel || "vLLM";
    }
    return orEmbeddingModels.find((m) => m.id === openrouterEmbeddingModel)?.name ?? openrouterEmbeddingModel;
  }, [embeddingProvider, voyageModel, cohereModel, openrouterEmbeddingModel, ollamaEmbeddingModel, vllmEmbeddingModel, orEmbeddingModels]);

  // Can generate?
  const canGenerate = useMemo(() => {
    if (editedChunks.length === 0) return false;
    if (embeddingProvider === "voyage") return !!voyageApiKey;
    if (embeddingProvider === "cohere") return !!cohereApiKey;
    if (embeddingProvider === "ollama") return !!ollamaEmbeddingModel;
    if (embeddingProvider === "vllm") return !!vllmEmbeddingModel;
    return !!openrouterApiKey;
  }, [embeddingProvider, voyageApiKey, cohereApiKey, openrouterApiKey, ollamaEmbeddingModel, vllmEmbeddingModel, editedChunks.length]);

  // The embedding model key for metadata
  const embeddingModelKey = useMemo(() => {
    if (embeddingProvider === "voyage") return voyageModel;
    if (embeddingProvider === "cohere") return cohereModel;
    if (embeddingProvider === "ollama") return ollamaEmbeddingModel;
    if (embeddingProvider === "vllm") return vllmEmbeddingModel;
    return openrouterEmbeddingModel;
  }, [embeddingProvider, voyageModel, cohereModel, openrouterEmbeddingModel, ollamaEmbeddingModel, vllmEmbeddingModel]);

  // Max dimensions for the selected model across all providers
  const selectedModelMaxDimensions = useMemo(() => {
    if (embeddingProvider === "voyage") {
      return VOYAGE_MODELS.find((m) => m.key === voyageModel)?.dimensions ?? 0;
    }
    if (embeddingProvider === "cohere") {
      return COHERE_MODELS.find((m) => m.key === cohereModel)?.dimensions ?? 0;
    }
    if (embeddingProvider === "ollama") {
      return ollamaEmbedModels.find((m) => m.name === ollamaEmbeddingModel)?.embeddingDimensions ?? 0;
    }
    if (embeddingProvider === "vllm") {
      return 0; // Unknown for local vLLM
    }
    return orEmbeddingModels.find((m) => m.id === openrouterEmbeddingModel)?.dimensions ?? 0;
  }, [embeddingProvider, voyageModel, cohereModel, ollamaEmbeddingModel, ollamaEmbedModels, openrouterEmbeddingModel, orEmbeddingModels]);

  // Synchronize embedding dimensions with selected model's capacity
  useEffect(() => {
    if (selectedModelMaxDimensions > 0) {
      // If switching models, we want to respect the user's intended dimension (userDesiredDimensions)
      // but cap it to what the model supports.
      if (userDesiredDimensions > selectedModelMaxDimensions) {
        setEmbeddingDimensions(selectedModelMaxDimensions);
      } else {
        setEmbeddingDimensions(userDesiredDimensions);
      }
    } else if (embeddingDimensions === 0) {
      // Fallback if somehow reset to 0
      setEmbeddingDimensions(userDesiredDimensions || DEFAULT_EMBEDDING_DIMENSIONS);
    }
  }, [selectedModelMaxDimensions, userDesiredDimensions, setEmbeddingDimensions, embeddingDimensions]);

  const embeddingDimsForCache = useMemo(() => {
    if (embeddingProvider === "voyage") {
      return VOYAGE_MODELS.find((m) => m.key === voyageModel)?.dimensions ?? 0;
    }
    if (embeddingProvider === "cohere") {
      return COHERE_MODELS.find((m) => m.key === cohereModel)?.dimensions ?? 0;
    }
    // For providers that allow overriding dims, include the requested dims in the cache key.
    return embeddingDimensions > 0 ? embeddingDimensions : 0;
  }, [embeddingProvider, voyageModel, cohereModel, embeddingDimensions]);

  // Generate embeddings
  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setIsEmbedding(true);
    setEmbeddingError(null);

    const endpointForCache =
      embeddingProvider === "ollama"
        ? ollamaEmbeddingEndpoint
        : embeddingProvider === "vllm"
          ? vllmEmbeddingEndpoint
          : undefined;

    const meta = {
      provider: embeddingProvider,
      modelKey: embeddingModelKey,
      dimensions: embeddingDimsForCache,
      endpoint: endpointForCache,
    };

    // Assemble from cache first; only call the provider for missing chunks.
    const nextCache: Record<string, number[]> = { ...embeddingChunkCache };
    const assembled: Array<number[] | null> = new Array(editedChunks.length).fill(null);
    const missingTexts: string[] = [];
    const missingIndices: number[] = [];

    for (let i = 0; i < editedChunks.length; i++) {
      const text = editedChunks[i];
      const k = chunkEmbeddingCacheKey({
        provider: embeddingProvider,
        modelKey: embeddingModelKey,
        dimensions: embeddingDimsForCache,
        endpoint: endpointForCache,
        chunkText: text,
      });
      const cached = nextCache[k];
      if (cached) {
        assembled[i] = cached;
      } else {
        missingTexts.push(text);
        missingIndices.push(i);
      }
    }

    if (missingTexts.length === 0) {
      setEmbeddingsMeta(meta);
      setEmbeddingsData(assembled as number[][]);
      setIsEmbedding(false);
      return;
    }

    // Show loading state by clearing the active embeddings only when we actually need to compute.
    setEmbeddingsData(null);

    try {
      let newEmbeddings: number[][] = [];
      if (embeddingProvider === "voyage") {
        const { generateEmbeddings } = await import("@/app/lib/voyage");
        newEmbeddings = await generateEmbeddings(
          voyageApiKey,
          voyageModel,
          missingTexts,
        );
      } else if (embeddingProvider === "cohere") {
        const { generateEmbeddings } = await import("@/app/lib/cohere");
        newEmbeddings = await generateEmbeddings(
          cohereApiKey,
          cohereModel,
          missingTexts,
        );
      } else if (embeddingProvider === "ollama") {
        const { generateOllamaEmbeddings } = await import("@/app/lib/ollama");
        const dims = embeddingDimensions > 0 ? embeddingDimensions : undefined;
        newEmbeddings = await generateOllamaEmbeddings(
          ollamaEmbeddingModel,
          missingTexts,
          ollamaEmbeddingEndpoint,
          undefined, // batchSize — use default
          dims,
        );
      } else if (embeddingProvider === "vllm") {
        const { generateVllmEmbeddings } = await import("@/app/lib/vllm");
        const dims = embeddingDimensions > 0 ? embeddingDimensions : undefined;
        newEmbeddings = await generateVllmEmbeddings(
          vllmEmbeddingModel,
          missingTexts,
          vllmEmbeddingEndpoint,
          undefined, // batchSize
          dims,
        );
      } else {
        const { generateOpenRouterEmbeddings } = await import("@/app/lib/openrouter");
        const dims = embeddingDimensions > 0 ? embeddingDimensions : undefined;
        newEmbeddings = await generateOpenRouterEmbeddings(
          openrouterApiKey,
          openrouterEmbeddingModel,
          missingTexts,
          undefined, // batchSize — use default
          dims,
        );
      }

      if (newEmbeddings.length !== missingTexts.length) {
        throw new Error(
          `Embedding provider returned ${newEmbeddings.length} embeddings for ${missingTexts.length} chunks`,
        );
      }

      // Fill missing slots + update cache
      for (let j = 0; j < missingIndices.length; j++) {
        const idx = missingIndices[j];
        const text = editedChunks[idx];
        const emb = newEmbeddings[j];
        assembled[idx] = emb;
        const k = chunkEmbeddingCacheKey({
          provider: embeddingProvider,
          modelKey: embeddingModelKey,
          dimensions: embeddingDimsForCache,
          endpoint: endpointForCache,
          chunkText: text,
        });
        nextCache[k] = emb;
      }

      setEmbeddingChunkCache(nextCache);
      setEmbeddingsMeta(meta);
      setEmbeddingsData(assembled as number[][]);
    } catch (err) {
      setEmbeddingError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsEmbedding(false);
    }
  }, [
    canGenerate, embeddingProvider,
    voyageApiKey, voyageModel,
    cohereApiKey, cohereModel,
    openrouterApiKey, openrouterEmbeddingModel,
    ollamaEmbeddingModel, ollamaEmbeddingEndpoint,
    vllmEmbeddingModel, vllmEmbeddingEndpoint,
    embeddingDimensions,
    editedChunks,
    embeddingChunkCache, setEmbeddingChunkCache,
    embeddingModelKey, embeddingDimsForCache,
    setIsEmbedding, setEmbeddingError, setEmbeddingsData, setEmbeddingsMeta,
  ]);

  // Download embeddings JSON
  const handleDownloadEmbeddings = useCallback(async () => {
    if (!embeddingsData) return;
    setDownloadingJson(true);
    try {
      const dims = embeddingsData[0]?.length ?? 0;
      const modelForMetadata = embeddingsMeta?.modelKey ?? embeddingModelKey;
      const data: EmbeddingsJson = {
        metadata: {
          source_file: parsedFilename,
          pipeline,
          embedding_model: modelForMetadata,
          num_chunks: editedChunks.length,
          embedding_dimensions: dims,
        },
        chunks: editedChunks.map((text, i) => ({
          index: i,
          text,
          embedding: embeddingsData[i],
        })),
      };
      const stem = parsedFilename.replace(/\.[^.]+$/, "");
      const { downloadJson } = await import("@/app/lib/downloads");
      await downloadJson(data, `${stem}_embeddings.json`);
    } finally {
      setDownloadingJson(false);
    }
  }, [embeddingsData, editedChunks, parsedFilename, pipeline, embeddingModelKey, embeddingsMeta]);

  const handleGenerateScript = useCallback(async () => {
    setGeneratingScript(true);
    try {
      const { generatePipelineScript } = await import("@/app/lib/script-generator");
      const { downloadZip } = await import("@/app/lib/downloads");
      const { PINECONE_ENVIRONMENTS } = await import("@/app/lib/constants");

      const env = PINECONE_ENVIRONMENTS.find((e) => e.key === pineconeEnvKey);
      const isSpreadsheet = pipeline === PIPELINE.EXCEL_SPREADSHEET || pipeline === PIPELINE.CSV_SPREADSHEET;

      const config: ScriptConfig = {
        pipeline,
        chunkingParams,
        filename: parsedFilename,
        openrouterModel,
        openrouterPrompt,
        pdfEngine,
        excelColumn: isSpreadsheet ? excelColumn : undefined,
        excelSheet: isSpreadsheet ? excelSheet : undefined,
        embeddingProvider,
        voyageModel,
        cohereModel,
        openrouterEmbeddingModel,
        embeddingDimensions,
        pineconeIndexName,
        pineconeCloud: env?.cloud,
        pineconeRegion: env?.region,
      };

      const files = generatePipelineScript("embeddings", config);
      const stem = parsedFilename.replace(/\.[^.]+$/, "") || "document";
      await downloadZip(files as unknown as Record<string, string>, `${stem}_embeddings_pipeline.zip`);
    } finally {
      setGeneratingScript(false);
    }
  }, [
    pipeline, chunkingParams, parsedFilename, openrouterModel, openrouterPrompt,
    pdfEngine, excelColumn, excelSheet, embeddingProvider, voyageModel, cohereModel,
    openrouterEmbeddingModel, embeddingDimensions, pineconeIndexName, pineconeEnvKey,
  ]);

  if (editedChunks.length === 0) return null;

  const activeProviderOption = PROVIDER_OPTIONS.find((p) => p.id === embeddingProvider);

  return (
    <div className="bg-card rounded-xl shadow-sm border border-silver-light p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gunmetal">
        <span className="inline-flex items-center justify-center h-6 px-2 min-w-[1.5rem] rounded-full bg-sandy text-white text-xs font-bold mr-2">
          5
        </span>
        Embeddings
      </h2>

      {/* Provider Toggle */}
      <div>
        <label className="block text-sm font-medium text-gunmetal mb-2">
          Embedding Provider
        </label>
        <ProviderSelector
          options={PROVIDER_OPTIONS}
          selectedId={embeddingProvider}
          onSelect={(id) => setEmbeddingProvider(id as "openrouter" | "voyage" | "cohere" | "ollama" | "vllm")}
        />
      </div>

      <ConfigContainer active>
        <ConfigHeader
          title={`${activeProviderOption?.label || "Provider"} Configuration`}
          icon={activeProviderOption?.icon}
          description={
            activeProviderOption?.badge === "Cloud"
              ? "Cloud provider selected. API key is required."
              : ""
          }
        />

        {/* ── OpenRouter Embeddings ── */}
        {embeddingProvider === "openrouter" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-gunmetal mb-1">
                OpenRouter API Key
              </label>
              <input
                type="password"
                value={openrouterApiKey}
                onChange={(e) => setOpenrouterApiKey(e.target.value)}
                placeholder="sk-or-..."
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
              />
              {!openrouterApiKey && (
                <StatusMessage type="warning" label="Note:" className="mt-1">
                  An OpenRouter API key is required.
                </StatusMessage>
              )}
            </div>

            {/* OR Embedding Model */}
            <div>
              <label className="block text-sm font-medium text-gunmetal mb-1">
                Embedding Model
                <span className="ml-2 text-xs text-silver-dark font-normal">
                  ({orEmbeddingModels.length} models)
                </span>
              </label>
              <select
                value={openrouterEmbeddingModel}
                onChange={(e) => setOpenrouterEmbeddingModel(e.target.value)}
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm bg-card focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none appearance-none"
              >
                {orEmbeddingModels.map((m) => {
                  const inPrice = formatPricing(m.pricing.prompt);
                  const outPrice = formatPricing(m.pricing.completion);
                  const ctx = formatCtx(m.context_length);
                  const dims = m.dimensions;
                  const dimsLabel = dims ? `${dims}d` : "";
                  return (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id}) — In: {inPrice} · Out: {outPrice}{dimsLabel ? ` · ${dimsLabel}` : ""} · {ctx} ctx
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        )}

        {/* ── Voyage AI Embeddings ── */}
        {embeddingProvider === "voyage" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-gunmetal mb-1">
                Voyage AI API Key
              </label>
              <input
                type="password"
                value={voyageApiKey}
                onChange={(e) => setVoyageApiKey(e.target.value)}
                placeholder="pa-..."
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
              />
            </div>

            {/* Voyage Model */}
            <div>
              <label className="block text-sm font-medium text-gunmetal mb-1">
                Embedding Model
              </label>
              <select
                value={voyageModel}
                onChange={(e) => setVoyageModel(e.target.value)}
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm bg-card focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none appearance-none"
              >
                {VOYAGE_MODELS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label} — {m.description} ({m.dimensions}d)
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── Cohere Embeddings ── */}
        {embeddingProvider === "cohere" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-gunmetal mb-1">
                Cohere API Key
              </label>
              <input
                type="password"
                value={cohereApiKey}
                onChange={(e) => setCohereApiKey(e.target.value)}
                placeholder="your-api-key"
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
              />
            </div>

            {/* Cohere Model */}
            <div>
              <label className="block text-sm font-medium text-gunmetal mb-1">
                Embedding Model
              </label>
              <select
                value={cohereModel}
                onChange={(e) => setCohereModel(e.target.value)}
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm bg-card focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none appearance-none"
              >
                {COHERE_MODELS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label} — {m.description} ({m.dimensions}d)
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── Ollama Embeddings ── */}
        {embeddingProvider === "ollama" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
            {/* Endpoint */}
            <div>
              <label className="block text-sm font-medium text-gunmetal mb-1">
                Ollama Endpoint
              </label>
              <input
                type="text"
                value={ollamaEmbeddingEndpoint}
                onChange={(e) => setOllamaEmbeddingEndpoint(e.target.value)}
                placeholder={DEFAULT_OLLAMA_ENDPOINT}
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
              />
            </div>

            {/* Model */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gunmetal">
                  Embedding Model
                  {loadingOllamaModels && (
                    <span className="ml-2 text-xs text-silver-dark animate-pulse">
                      Loading…
                    </span>
                  )}
                  {!loadingOllamaModels && ollamaEmbedModels.length > 0 && (
                    <span className="ml-2 text-xs text-silver-dark font-normal">
                      ({ollamaEmbedModels.length} model{ollamaEmbedModels.length !== 1 ? "s" : ""})
                    </span>
                  )}
                </label>
                <button
                  onClick={fetchOllamaEmbedModels}
                  disabled={loadingOllamaModels}
                  className="text-xs text-sandy hover:text-sandy-dark cursor-pointer disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>

              {ollamaModelError && (
                <StatusMessage type="error" label="Error:" className="mb-2">
                  {ollamaModelError}
                </StatusMessage>
              )}

              {!loadingOllamaModels && ollamaEmbedModels.length === 0 && !ollamaModelError && (
                <StatusMessage type="warning" label="Note:" className="mb-2">
                  No embedding models found. Pull one with e.g. <code>ollama pull embeddinggemma</code> or <code>ollama pull all-minilm</code>.
                  Models with &quot;embed&quot; or &quot;bge&quot; in their name are detected.
                </StatusMessage>
              )}

              <select
                value={ollamaEmbeddingModel}
                onChange={(e) => setOllamaEmbeddingModel(e.target.value)}
                disabled={ollamaEmbedModels.length === 0}
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm bg-card focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none appearance-none disabled:opacity-50"
              >
                {ollamaEmbedModels.length === 0 && (
                  <option value="">No embedding models available</option>
                )}
                {ollamaEmbedModels.map((m) => {
                  const dimsLabel = m.embeddingDimensions ? ` — ${m.embeddingDimensions}d` : "";
                  return (
                    <option key={m.name} value={m.name}>
                      {m.name}{m.parameterSize ? ` (${m.parameterSize})` : ""}{dimsLabel}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        )}

        {/* ── vLLM Embeddings ── */}
        {embeddingProvider === "vllm" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
            {/* Endpoint */}
            <div>
              <label className="block text-sm font-medium text-gunmetal mb-1">
                vLLM Embedding Endpoint
              </label>
              <input
                type="text"
                value={vllmEmbeddingEndpoint}
                onChange={(e) => setVllmEmbeddingEndpoint(e.target.value)}
                placeholder="http://localhost:8001"
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
              />
            </div>

            {/* Model */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gunmetal">
                  Embedding Model
                  {loadingVllmModels && (
                    <span className="ml-2 text-xs text-silver-dark animate-pulse">
                      Loading…
                    </span>
                  )}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={fetchVllmEmbedModels}
                    disabled={loadingVllmModels}
                    className="text-xs text-sandy hover:text-sandy-dark cursor-pointer disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {vllmModelError && (
                <StatusMessage type="error" label="Error:" className="mb-2">
                  {vllmModelError}
                </StatusMessage>
              )}

              {vllmEmbedModels.length > 0 ? (
                <select
                  value={vllmEmbeddingModel}
                  onChange={(e) => setVllmEmbeddingModel(e.target.value)}
                  className="w-full rounded-lg border border-silver px-3 py-2 text-sm bg-card focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none appearance-none"
                >
                  {vllmEmbedModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id} {m.max_model_len ? `(ctx: ${m.max_model_len})` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                !loadingVllmModels && !vllmModelError && (
                  <StatusMessage type="warning" label="Note:">
                    No models detected at this endpoint.
                  </StatusMessage>
                )
              )}
              
              <div className="mt-2">
                <button
                  onClick={() => setShowVllmExample(!showVllmExample)}
                  className="text-[10px] text-sandy hover:underline cursor-pointer"
                >
                  {showVllmExample ? "Hide example command" : "Show example command"}
                </button>
                {showVllmExample && (
                  <div className="mt-1 p-2 bg-slate-900 rounded text-[10px] font-mono text-slate-300 break-all select-auto">
                    vllm serve {vllmEmbeddingModel || "jinaai/jina-embeddings-v3"} --port {vllmEmbeddingEndpoint ? new URL(vllmEmbeddingEndpoint).port : "8001"}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Shared Output Dimensions ── */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <label className="block text-sm font-medium text-gunmetal">
              Output Dimensions
            </label>
            <div className="group relative">
              <svg
                className="h-3.5 w-3.5 text-amber-500 cursor-help"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 w-48 scale-0 group-hover:scale-100 transition-all duration-200 origin-left z-10">
                <div className="bg-slate-900 text-white text-[10px] rounded p-2 shadow-lg border border-white/10">
                  Verify model support for custom dimensions.
                </div>
              </div>
            </div>
          </div>
          <input
            type="number"
            min={0}
            step={1}
            value={embeddingDimensions}
            onChange={(e) => {
              const val = Math.max(0, parseInt(e.target.value) || 0);
              setEmbeddingDimensions(val);
              setUserDesiredDimensions(val);
            }}
            className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
          />
        </div>
      </ConfigContainer>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate || isEmbedding}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-sandy px-4 py-3 text-sm font-medium text-white hover:bg-sandy-light active:bg-sandy-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
      >
        {isEmbedding ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating embeddings with {activeModelLabel}…
          </>
        ) : (
          <>Generate Embeddings</>
        )}
      </button>

      {/* Error */}
      {embeddingError && (
        <StatusMessage type="error" label="Error:">
          {embeddingError}
        </StatusMessage>
      )}

      {/* Success + Downloads */}
      {embeddingsData && (
        <div className="space-y-3">
          <StatusMessage type="success" label="Success:">
            Generated {embeddingsData.length} embeddings (
            {embeddingsData[0]?.length ?? 0} dimensions each) using{" "}
            {embeddingProvider === "voyage" ? "Voyage AI" : embeddingProvider === "cohere" ? "Cohere" : embeddingProvider === "ollama" ? "Ollama" : embeddingProvider === "vllm" ? "vLLM" : "OpenRouter"}.
          </StatusMessage>

          <ActionRow
            onDownload={handleDownloadEmbeddings}
            downloadLabel="Download JSON"
            isDownloading={downloadingJson}
            onGenerateScript={handleGenerateScript}
            scriptLabel="Generate Script"
            isGeneratingScript={generatingScript}
          />
        </div>
      )}
    </div>
  );
}
