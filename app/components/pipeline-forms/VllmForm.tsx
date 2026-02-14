"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAppStore } from "@/app/lib/store";
import { DEFAULT_VLLM_ENDPOINT, DEFAULT_PROMPTS, VLLM_RECOMMENDED_MODELS } from "@/app/lib/constants";
import { PIPELINE_MODALITY, PIPELINE } from "@/app/lib/types";
import type { Modality } from "@/app/lib/types";
import StatusMessage from "@/app/components/shared/StatusMessage";

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

  const getRecommendedCommand = () => {
    let rec: { model: string; port: number; extraFlags?: string; description: string } = VLLM_RECOMMENDED_MODELS.multimodal;
    if (pipeline === PIPELINE.DOCLING_PDF) rec = VLLM_RECOMMENDED_MODELS.docling;
    else if (modality === "audio") rec = VLLM_RECOMMENDED_MODELS.audio;

    // Always use the recommended model and port for the example command, regardless of current state
    const m = rec.model;
    const p = rec.port;
    const flags = rec.extraFlags ? ` ${rec.extraFlags}` : "";
    return `vllm serve ${m} --port ${p}${flags}`;
  };

  const launchCommand = getRecommendedCommand();

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
          vLLM Endpoint
        </label>
        <input
          type="text"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder={DEFAULT_VLLM_ENDPOINT}
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
            <div className="mt-1">
              <div className="p-2 bg-slate-900 rounded text-[10px] font-mono text-slate-300 break-all select-auto whitespace-pre-wrap">
                {launchCommand}
              </div>
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
            <StatusMessage type="warning" label="Note:">
              No models detected at this endpoint.
            </StatusMessage>
          )
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
          className={`w-full rounded-lg border border-silver bg-card px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none resize-y overflow-y-auto`}
        />
      </div>
    </div>
  );
}

