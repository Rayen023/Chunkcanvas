"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useAppStore } from "@/app/lib/store";
import { DEFAULT_OLLAMA_ENDPOINT, DEFAULT_PROMPTS } from "@/app/lib/constants";
import { PIPELINE_MODALITY } from "@/app/lib/types";
import type { Modality } from "@/app/lib/types";
import StatusMessage from "@/app/components/shared/StatusMessage";

interface OllamaModelInfo {
  name: string;
  parameterSize?: string;
  quantization?: string;
  capabilities?: string[];
  families?: string[];
}

export default function OllamaForm({ ext }: { ext: string }) {
  const pipelinesByExt = useAppStore((s) => s.pipelinesByExt);
  const pipeline = pipelinesByExt[ext] ?? "";
  const config = useAppStore((s) => s.configByExt[ext]);
  const setConfigForExt = useAppStore((s) => s.setConfigForExt);

  const endpoint = config?.ollamaEndpoint ?? DEFAULT_OLLAMA_ENDPOINT;
  const model = config?.ollamaModel ?? "";
  const prompt = config?.ollamaPrompt ?? "";

  const setEndpoint = useCallback((v: string) => setConfigForExt(ext, { ollamaEndpoint: v }), [ext, setConfigForExt]);
  const setModel = useCallback((v: string) => setConfigForExt(ext, { ollamaModel: v }), [ext, setConfigForExt]);
  const setPrompt = useCallback((v: string) => setConfigForExt(ext, { ollamaPrompt: v }), [ext, setConfigForExt]);

  const modality: Modality = PIPELINE_MODALITY[pipeline] ?? "file";

  // Set default prompt on pipeline change
  useEffect(() => {
    setPrompt(DEFAULT_PROMPTS[modality] ?? "");
  }, [modality, setPrompt]);

  // ── Models fetch & capability enrichment ──────────────
  const [allModels, setAllModels] = useState<OllamaModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

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

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize prompt height
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const newHeight = Math.min(Math.max(el.scrollHeight + 2, 100), 300);
    el.style.height = `${newHeight}px`;
  }, [prompt]);

  const [showExample, setShowExample] = useState(false);

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
          className="w-full rounded-lg border border-silver bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
        />
        <div className="mt-1">
          <button
            onClick={() => setShowExample(!showExample)}
            className="text-[10px] text-sandy hover:underline cursor-pointer"
          >
            {showExample ? "Hide launch command" : "Show launch command"}
          </button>
          {showExample && (
            <div className="mt-1 p-2 bg-slate-900 rounded text-[10px] font-mono text-slate-300 break-all select-auto whitespace-pre-wrap">
              ollama serve
            </div>
          )}
        </div>
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
          </div>
        </div>

        {modelError && (
          <StatusMessage type="error" label="Error:" className="mb-2">
            {modelError}
          </StatusMessage>
        )}

        {!loadingModels && visionModels.length === 0 && !modelError && (
          <StatusMessage type="warning" label="Note:" className="mb-2">
            No vision-capable models found. Make sure Ollama is running and you have a vision model pulled
            (e.g. <code>ollama pull gemma3</code> or <code>ollama pull llava</code>).
          </StatusMessage>
        )}

        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={visionModels.length === 0}
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm bg-card focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none appearance-none disabled:opacity-50"
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
          Prompt
        </label>
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={{ minHeight: "100px", maxHeight: "300px" }}
          className="w-full rounded-lg border border-silver bg-card px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none resize-y overflow-y-auto"
        />
      </div>
    </div>
  );
}

