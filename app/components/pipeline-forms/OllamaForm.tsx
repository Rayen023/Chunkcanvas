"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAppStore } from "@/app/lib/store";
import { DEFAULT_OLLAMA_ENDPOINT, DEFAULT_PROMPTS } from "@/app/lib/constants";
import { PIPELINE_MODALITY } from "@/app/lib/types";
import type { Modality } from "@/app/lib/types";

interface OllamaModelInfo {
  name: string;
  parameterSize?: string;
  quantization?: string;
  capabilities?: string[];
  families?: string[];
}

export default function OllamaForm() {
  const pipeline = useAppStore((s) => s.pipeline);
  const endpoint = useAppStore((s) => s.ollamaEndpoint);
  const model = useAppStore((s) => s.ollamaModel);
  const prompt = useAppStore((s) => s.ollamaPrompt);

  const setEndpoint = useAppStore((s) => s.setOllamaEndpoint);
  const setModel = useAppStore((s) => s.setOllamaModel);
  const setPrompt = useAppStore((s) => s.setOllamaPrompt);

  const modality: Modality = PIPELINE_MODALITY[pipeline] ?? "file";

  // Set default prompt on pipeline change
  useEffect(() => {
    setPrompt(DEFAULT_PROMPTS[modality] ?? "");
  }, [modality, setPrompt]);

  // ── Models fetch & capability enrichment ──────────────
  const [allModels, setAllModels] = useState<OllamaModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [unloadingModel, setUnloadingModel] = useState(false);

  const fetchModels = useCallback(async () => {
    setLoadingModels(true);
    setModelError(null);
    try {
      const {
        listOllamaModelsEnriched,
      } = await import("@/app/lib/ollama");
      const models = await listOllamaModelsEnriched(endpoint);
      setAllModels(models);
    } catch (err) {
      setModelError(
        err instanceof Error ? err.message : "Failed to fetch Ollama models",
      );
      setAllModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Unload current model from VRAM
  const handleUnloadModel = useCallback(async () => {
    if (!model) return;
    setUnloadingModel(true);
    try {
      const { unloadOllamaModel } = await import("@/app/lib/ollama");
      await unloadOllamaModel(model, endpoint);
      setModelError(null);
    } catch (err) {
      setModelError(
        err instanceof Error ? err.message : "Failed to unload model",
      );
    } finally {
      setUnloadingModel(false);
    }
  }, [model, endpoint]);

  // Filter to vision-capable models only (for PDF/image parsing)
  const visionModels = useMemo(() => {
    return allModels.filter((m) =>
      m.capabilities?.some((c) => c.toLowerCase().includes("vision")),
    );
  }, [allModels]);

  // Ensure selected model is valid
  useEffect(() => {
    if (visionModels.length > 0 && !visionModels.find((m) => m.name === model)) {
      setModel(visionModels[0].name);
    }
  }, [visionModels, model, setModel]);

  return (
    <div className="space-y-4">
      {/* Endpoint */}
      <div>
        <label className="block text-sm font-medium text-gunmetal mb-1">
          Ollama Endpoint
        </label>
        <input
          type="text"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder={DEFAULT_OLLAMA_ENDPOINT}
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
        />
      </div>

      {/* Model Selector */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gunmetal">
            Vision Model
            {loadingModels && (
              <span className="ml-2 text-xs text-silver-dark animate-pulse">
                Loading models…
              </span>
            )}
            {!loadingModels && visionModels.length > 0 && (
              <span className="ml-2 text-xs text-silver-dark font-normal">
                ({visionModels.length} vision model{visionModels.length !== 1 ? "s" : ""})
              </span>
            )}
          </label>
          <div className="flex gap-2">
            <button
              onClick={fetchModels}
              disabled={loadingModels}
              className="text-xs text-sandy hover:text-sandy-dark cursor-pointer disabled:opacity-50"
            >
              Refresh
            </button>
            {model && (
              <button
                onClick={handleUnloadModel}
                disabled={unloadingModel}
                className="text-xs text-red-500 hover:text-red-700 cursor-pointer disabled:opacity-50"
                title="Unload model from VRAM"
              >
                {unloadingModel ? "Unloading…" : "Free VRAM"}
              </button>
            )}
          </div>
        </div>

        {modelError && (
          <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-700">
            {modelError}
          </div>
        )}

        {!loadingModels && visionModels.length === 0 && !modelError && (
          <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-700">
            No vision-capable models found. Make sure Ollama is running and you have a vision model pulled
            (e.g. <code>ollama pull gemma3</code> or <code>ollama pull llava</code>).
          </div>
        )}

        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={visionModels.length === 0}
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none appearance-none disabled:opacity-50"
        >
          {visionModels.length === 0 && (
            <option value="">No vision models available</option>
          )}
          {visionModels.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
              {m.parameterSize ? ` (${m.parameterSize})` : ""}
              {m.quantization ? ` [${m.quantization}]` : ""}
            </option>
          ))}
        </select>

        {/* Show all other (non-vision) models as info */}
        {allModels.length > visionModels.length && (
          <p className="mt-1 text-xs text-silver-dark">
            {allModels.length - visionModels.length} non-vision model{allModels.length - visionModels.length !== 1 ? "s" : ""} hidden
            (only vision-capable models shown for parsing).
          </p>
        )}
      </div>

      {/* Prompt */}
      <div>
        <label className="block text-sm font-medium text-gunmetal mb-1">
          Prompt / Instruction
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={6}
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none resize-y"
        />
      </div>
    </div>
  );
}
