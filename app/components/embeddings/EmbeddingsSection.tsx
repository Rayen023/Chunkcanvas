"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useAppStore } from "@/app/lib/store";
import { VOYAGE_MODELS, EMBEDDING_MODELS, OPENROUTER_DEFAULT_EMBEDDING_MODEL, DEFAULT_OLLAMA_ENDPOINT } from "@/app/lib/constants";
import DownloadScriptButton from "../downloads/DownloadScriptButton";
import type { EmbeddingsJson } from "@/app/lib/types";

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
  const isEmbedding = useAppStore((s) => s.isEmbedding);
  const embeddingError = useAppStore((s) => s.embeddingError);
  const setEmbeddingsData = useAppStore((s) => s.setEmbeddingsData);
  const setIsEmbedding = useAppStore((s) => s.setIsEmbedding);
  const setEmbeddingError = useAppStore((s) => s.setEmbeddingError);

  const [downloadingJson, setDownloadingJson] = useState(false);

  // OpenRouter embedding models — loaded from generated JSON (run `npm run update-models` to refresh)
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
  }, [orEmbeddingModels, openrouterEmbeddingModel, embeddingProvider, setOpenrouterEmbeddingModel]);

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
    if (embeddingProvider === "ollama") {
      return ollamaEmbeddingModel || "Ollama";
    }
    if (embeddingProvider === "vllm") {
      return vllmEmbeddingModel || "vLLM";
    }
    return orEmbeddingModels.find((m) => m.id === openrouterEmbeddingModel)?.name ?? openrouterEmbeddingModel;
  }, [embeddingProvider, voyageModel, openrouterEmbeddingModel, ollamaEmbeddingModel, vllmEmbeddingModel, orEmbeddingModels]);

  // Can generate?
  const canGenerate = useMemo(() => {
    if (editedChunks.length === 0) return false;
    if (embeddingProvider === "voyage") return !!voyageApiKey;
    if (embeddingProvider === "ollama") return !!ollamaEmbeddingModel;
    if (embeddingProvider === "vllm") return !!vllmEmbeddingModel;
    return !!openrouterApiKey;
  }, [embeddingProvider, voyageApiKey, openrouterApiKey, ollamaEmbeddingModel, vllmEmbeddingModel, editedChunks.length]);

  // The embedding model key for metadata
  const embeddingModelKey = useMemo(() => {
    if (embeddingProvider === "voyage") return voyageModel;
    if (embeddingProvider === "ollama") return ollamaEmbeddingModel;
    if (embeddingProvider === "vllm") return vllmEmbeddingModel;
    return openrouterEmbeddingModel;
  }, [embeddingProvider, voyageModel, openrouterEmbeddingModel, ollamaEmbeddingModel, vllmEmbeddingModel]);

  // Generate embeddings
  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setIsEmbedding(true);
    setEmbeddingError(null);
    setEmbeddingsData(null);

    try {
      if (embeddingProvider === "voyage") {
        const { generateEmbeddings } = await import("@/app/lib/voyage");
        const embeddings = await generateEmbeddings(
          voyageApiKey,
          voyageModel,
          editedChunks,
        );
        setEmbeddingsData(embeddings);
      } else if (embeddingProvider === "ollama") {
        const { generateOllamaEmbeddings } = await import("@/app/lib/ollama");
        const dims = embeddingDimensions > 0 ? embeddingDimensions : undefined;
        const embeddings = await generateOllamaEmbeddings(
          ollamaEmbeddingModel,
          editedChunks,
          ollamaEmbeddingEndpoint,
          undefined, // batchSize — use default
          dims,
        );
        setEmbeddingsData(embeddings);
      } else if (embeddingProvider === "vllm") {
        const { generateVllmEmbeddings } = await import("@/app/lib/vllm");
        const dims = embeddingDimensions > 0 ? embeddingDimensions : undefined;
        const embeddings = await generateVllmEmbeddings(
          vllmEmbeddingModel,
          editedChunks,
          vllmEmbeddingEndpoint,
          undefined, // batchSize
          dims,
        );
        setEmbeddingsData(embeddings);
      } else {
        const { generateOpenRouterEmbeddings } = await import("@/app/lib/openrouter");
        const dims = embeddingDimensions > 0 ? embeddingDimensions : undefined;
        const embeddings = await generateOpenRouterEmbeddings(
          openrouterApiKey,
          openrouterEmbeddingModel,
          editedChunks,
          undefined, // batchSize — use default
          dims,
        );
        setEmbeddingsData(embeddings);
      }
    } catch (err) {
      setEmbeddingError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsEmbedding(false);
    }
  }, [
    canGenerate, embeddingProvider,
    voyageApiKey, voyageModel,
    openrouterApiKey, openrouterEmbeddingModel,
    ollamaEmbeddingModel, ollamaEmbeddingEndpoint,
    vllmEmbeddingModel, vllmEmbeddingEndpoint,
    embeddingDimensions,
    editedChunks,
    setIsEmbedding, setEmbeddingError, setEmbeddingsData,
  ]);

  // Download embeddings JSON
  const handleDownloadEmbeddings = useCallback(async () => {
    if (!embeddingsData) return;
    setDownloadingJson(true);
    try {
      const dims = embeddingsData[0]?.length ?? 0;
      const data: EmbeddingsJson = {
        metadata: {
          source_file: parsedFilename,
          pipeline,
          embedding_model: embeddingModelKey,
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
  }, [embeddingsData, editedChunks, parsedFilename, pipeline, embeddingModelKey]);

  if (editedChunks.length === 0) return null;

  return (
    <div className="bg-card rounded-xl shadow-sm border border-silver-light p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gunmetal">
        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-sandy text-white text-xs font-bold mr-2">
          5
        </span>
        Embeddings
      </h2>

      {/* Provider Toggle */}
      <div>
        <label className="block text-sm font-medium text-gunmetal mb-2">
          Embedding Provider
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setEmbeddingProvider("openrouter")}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium border transition-colors cursor-pointer ${
              embeddingProvider === "openrouter"
                ? "bg-sandy text-white border-sandy"
                : "bg-card text-gunmetal border-silver hover:border-sandy"
            }`}
          >
            OpenRouter
          </button>
          <button
            onClick={() => setEmbeddingProvider("voyage")}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium border transition-colors cursor-pointer ${
              embeddingProvider === "voyage"
                ? "bg-sandy text-white border-sandy"
                : "bg-card text-gunmetal border-silver hover:border-sandy"
            }`}
          >
            Voyage AI
          </button>
          <button
            onClick={() => setEmbeddingProvider("ollama")}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium border transition-colors cursor-pointer ${
              embeddingProvider === "ollama"
                ? "bg-sandy text-white border-sandy"
                : "bg-card text-gunmetal border-silver hover:border-sandy"
            }`}
          >
            Ollama
          </button>
          <button
            onClick={() => setEmbeddingProvider("vllm")}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium border transition-colors cursor-pointer ${
              embeddingProvider === "vllm"
                ? "bg-sandy text-white border-sandy"
                : "bg-card text-gunmetal border-silver hover:border-sandy"
            }`}
          >
            vLLM
          </button>
        </div>
      </div>

      {/* ── OpenRouter Embeddings ── */}
      {embeddingProvider === "openrouter" && (
        <>
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
              <p className="mt-1 text-xs text-amber-600">
                An OpenRouter API key is required.
              </p>
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
        </>
      )}

      {/* ── Voyage AI Embeddings ── */}
      {embeddingProvider === "voyage" && (
        <>
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
        </>
      )}

      {/* ── Ollama Embeddings ── */}
      {embeddingProvider === "ollama" && (
        <>
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
              <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-700">
                {ollamaModelError}
              </div>
            )}

            {!loadingOllamaModels && ollamaEmbedModels.length === 0 && !ollamaModelError && (
              <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-700">
                No embedding models found. Pull one with e.g. <code>ollama pull embeddinggemma</code> or <code>ollama pull all-minilm</code>.
                Models with &quot;embed&quot; or &quot;bge&quot; in their name are detected.
              </div>
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
        </>
      )}

      {/* ── vLLM Embeddings ── */}
      {embeddingProvider === "vllm" && (
        <>
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
              <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-700">
                {vllmModelError}
              </div>
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
                <div className="rounded-lg bg-slate-50 border border-silver p-3 text-xs text-silver-dark italic">
                  No models detected at this endpoint.
                </div>
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
                <div className="mt-1 p-2 bg-slate-900 rounded text-[10px] font-mono text-slate-300 break-all select-all">
                  vllm serve {vllmEmbeddingModel || "jinaai/jina-embeddings-v3"} --port {vllmEmbeddingEndpoint ? new URL(vllmEmbeddingEndpoint).port : "8001"}
                </div>
              )}
            </div>
          </div>
        </>
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
          onChange={(e) => setEmbeddingDimensions(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
        />
      </div>

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
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
          {embeddingError}
        </div>
      )}

      {/* Success + Downloads */}
      {embeddingsData && (
        <div className="space-y-3">
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
            Generated {embeddingsData.length} embeddings (
            {embeddingsData[0]?.length ?? 0} dimensions each) using{" "}
            {embeddingProvider === "voyage" ? "Voyage AI" : embeddingProvider === "ollama" ? "Ollama" : embeddingProvider === "vllm" ? "vLLM" : "OpenRouter"}.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleDownloadEmbeddings}
              disabled={downloadingJson}
              className="flex items-center justify-center gap-2 rounded-lg bg-card border border-silver px-4 py-3 text-sm font-medium text-gunmetal hover:border-sandy hover:text-sandy transition-colors disabled:opacity-50 cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {downloadingJson ? "Preparing…" : "Download JSON"}
            </button>

            <DownloadScriptButton
              stage="embeddings"
              label="Download Script (.zip)"
            />
          </div>
        </div>
      )}
    </div>
  );
}
