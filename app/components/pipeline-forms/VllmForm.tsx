"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/app/lib/store";
import { DEFAULT_VLLM_ENDPOINT, DEFAULT_PROMPTS } from "@/app/lib/constants";
import { PIPELINE_MODALITY } from "@/app/lib/types";
import type { Modality } from "@/app/lib/types";

export default function VllmForm({ ext }: { ext: string }) {
  const pipelinesByExt = useAppStore((s) => s.pipelinesByExt);
  const pipeline = pipelinesByExt[ext] ?? "";
  const config = useAppStore((s) => s.configByExt[ext]);
  const setConfigForExt = useAppStore((s) => s.setConfigForExt);

  const endpoint = config?.vllmEndpoint ?? DEFAULT_VLLM_ENDPOINT;
  const model = config?.vllmModel ?? "";
  const prompt = config?.vllmPrompt ?? "";

  const setEndpoint = useCallback((v: string) => setConfigForExt(ext, { vllmEndpoint: v }), [ext, setConfigForExt]);
  const setModel = useCallback((v: string) => setConfigForExt(ext, { vllmModel: v }), [ext, setConfigForExt]);
  const setPrompt = useCallback((v: string) => setConfigForExt(ext, { vllmPrompt: v }), [ext, setConfigForExt]);

  const modality: Modality = PIPELINE_MODALITY[pipeline] ?? "file";

  // Set default prompt on pipeline change
  useEffect(() => {
    setPrompt(DEFAULT_PROMPTS[modality] ?? "");
  }, [modality, setPrompt]);

  // ── Models fetch ──────────────
  const [availableModels, setAvailableModels] = useState<{ id: string; max_model_len?: number }[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [showExample, setShowExample] = useState(false);

  const fetchModels = useCallback(async () => {
    if (!endpoint) return;
    setLoadingModels(true);
    setModelError(null);
    try {
      const res = await fetch(`${endpoint}/v1/models`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`vLLM /v1/models: ${res.status}`);
      const json = await res.json();
      const models = ((json.data ?? []) as { id: string; max_model_len?: number }[]).map(m => ({
        id: m.id,
        max_model_len: m.max_model_len
      }));
      setAvailableModels(models);
      if (models.length > 0 && (!model || !models.find(m => m.id === model))) {
        setModel(models[0].id);
      }
    } catch (err) {
      setModelError(
        err instanceof Error ? err.message : "Failed to fetch vLLM models",
      );
      setAvailableModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, [endpoint, model, setModel]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchModels();
    }, 500);
    return () => clearTimeout(timer);
  }, [endpoint, fetchModels]);

  const exampleCommand = modality === "audio"
    ? `vllm serve ${model || "openai/whisper-large-v3"} --port ${endpoint ? new URL(endpoint).port : "8000"}`
    : modality === "video"
    ? `vllm serve ${model || "llava-hf/LLaVA-NeXT-Video-7B-hf"} --port ${endpoint ? new URL(endpoint).port : "8000"}`
    : `vllm serve ${model || "Qwen3-VL-8B-Instruct-FP8"} --port ${endpoint ? new URL(endpoint).port : "8000"}`;

  return (
    <div className="space-y-4">
      {/* Endpoint */}
      <div>
        <label className="block text-sm font-medium text-gunmetal mb-1">
          vLLM Endpoint
        </label>
        <input
          type="text"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder={DEFAULT_VLLM_ENDPOINT}
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
        />
        <div className="mt-1">
          <button
            onClick={() => setShowExample(!showExample)}
            className="text-[10px] text-sandy hover:underline cursor-pointer"
          >
            {showExample ? "Hide example command" : "Show example command"}
          </button>
          {showExample && (
            <div className="mt-1 p-2 bg-slate-900 rounded text-[10px] font-mono text-slate-300 break-all select-all">
              {exampleCommand}
            </div>
          )}
        </div>
      </div>

      {/* Model Status/Selector */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gunmetal">
            Active Model
            {loadingModels && (
              <span className="ml-2 text-xs text-silver-dark animate-pulse">
                Fetching models…
              </span>
            )}
          </label>
        </div>

        {modelError && (
          <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-700">
            {modelError}
          </div>
        )}

        {availableModels.length > 0 ? (
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-lg border border-silver px-3 py-2 text-sm bg-card focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none appearance-none"
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id} {m.max_model_len ? `(ctx: ${m.max_model_len})` : ""}
              </option>
            ))}
          </select>
        ) : (
          !loadingModels && !modelError && (
            <div className="rounded-lg bg-slate-50 border border-silver p-3 text-xs text-silver-dark italic">
              No models detected at this endpoint.
            </div>
          )
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
