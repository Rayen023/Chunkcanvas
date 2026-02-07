"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAppStore } from "@/app/lib/store";
import {
  OPENROUTER_DEFAULT_MODEL,
  PDF_ENGINES,
  DEFAULT_PROMPTS,
  FALLBACK_MODELS,
} from "@/app/lib/constants";
import { PIPELINE_MODALITY } from "@/app/lib/types";
import type { OpenRouterModel, Modality } from "@/app/lib/types";

export default function OpenRouterForm() {
  const pipeline = useAppStore((s) => s.pipeline);
  const apiKey = useAppStore((s) => s.openrouterApiKey);
  const envKey = useAppStore((s) => s.envKeys.openrouter);
  const model = useAppStore((s) => s.openrouterModel);
  const prompt = useAppStore((s) => s.openrouterPrompt);
  const pdfEngine = useAppStore((s) => s.pdfEngine);

  const setApiKey = useAppStore((s) => s.setOpenrouterApiKey);
  const setModel = useAppStore((s) => s.setOpenrouterModel);
  const setPrompt = useAppStore((s) => s.setOpenrouterPrompt);
  const setPdfEngine = useAppStore((s) => s.setPdfEngine);

  const modality: Modality = PIPELINE_MODALITY[pipeline] ?? "file";
  const isPdf = pipeline.includes("PDF");

  // Auto-fill env key once
  useEffect(() => {
    if (!apiKey && envKey) setApiKey(envKey);
  }, [apiKey, envKey, setApiKey]);

  // Set default prompt on pipeline change
  useEffect(() => {
    setPrompt(DEFAULT_PROMPTS[modality] ?? "");
  }, [modality, setPrompt]);

  // ── Models fetch ──────────────────────────────────────────
  const [allModels, setAllModels] = useState<OpenRouterModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const fetchModels = useCallback(async () => {
    if (!apiKey) {
      setAllModels(Object.values(FALLBACK_MODELS));
      return;
    }
    setLoadingModels(true);
    try {
      const { fetchAvailableModels } = await import("@/app/lib/openrouter");
      const models = await fetchAvailableModels(apiKey);
      setAllModels(models);
    } catch {
      setAllModels(Object.values(FALLBACK_MODELS));
    } finally {
      setLoadingModels(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const filteredModels = useMemo(() => {
    const filtered = allModels.filter((m) =>
      m.input_modalities.includes(modality),
    );
    filtered.sort((a, b) => {
      if (a.id === OPENROUTER_DEFAULT_MODEL) return -1;
      if (b.id === OPENROUTER_DEFAULT_MODEL) return 1;
      return a.name.localeCompare(b.name);
    });
    return filtered;
  }, [allModels, modality]);

  // Ensure selected model is valid
  useEffect(() => {
    if (filteredModels.length && !filteredModels.find((m) => m.id === model)) {
      setModel(filteredModels[0].id);
    }
  }, [filteredModels, model, setModel]);

  return (
    <div className="space-y-4">
      {/* API Key */}
      <div>
        <label className="block text-sm font-medium text-gunmetal mb-1">
          OpenRouter API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-or-..."
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
        />
        {!apiKey && (
          <p className="mt-1 text-xs text-amber-600">
            An OpenRouter API key is required.
          </p>
        )}
      </div>

      {/* Model Selector */}
      <div>
        <label className="block text-sm font-medium text-gunmetal mb-1">
          Model
          {loadingModels && (
            <span className="ml-2 text-xs text-silver-dark animate-pulse">
              Loading models…
            </span>
          )}
        </label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none appearance-none"
        >
          {filteredModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.id})
            </option>
          ))}
        </select>
      </div>

      {/* PDF Engine (PDF only) */}
      {isPdf && (
        <div>
          <label className="block text-sm font-medium text-gunmetal mb-1">
            PDF Processing Engine
          </label>
          <select
            value={pdfEngine}
            onChange={(e) =>
              setPdfEngine(e.target.value as "native" | "pdf-text" | "mistral-ocr")
            }
            className="w-full rounded-lg border border-silver px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none appearance-none"
          >
            {PDF_ENGINES.map((eng) => (
              <option key={eng.key} value={eng.key}>
                {eng.label}
              </option>
            ))}
          </select>
        </div>
      )}

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
