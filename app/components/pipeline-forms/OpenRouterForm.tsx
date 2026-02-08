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
import type { OpenRouterModelFull, Modality } from "@/app/lib/types";

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

export default function OpenRouterForm() {
  const pipeline = useAppStore((s) => s.pipeline);
  const apiKey = useAppStore((s) => s.openrouterApiKey);
  const envKey = useAppStore((s) => s.envKeys.openrouter);
  const model = useAppStore((s) => s.openrouterModel);
  const prompt = useAppStore((s) => s.openrouterPrompt);
  const pdfEngine = useAppStore((s) => s.pdfEngine);
  const pagesPerBatch = useAppStore((s) => s.openrouterPagesPerBatch);
  const file = useAppStore((s) => s.file);

  const setApiKey = useAppStore((s) => s.setOpenrouterApiKey);
  const setModel = useAppStore((s) => s.setOpenrouterModel);
  const setPrompt = useAppStore((s) => s.setOpenrouterPrompt);
  const setPdfEngine = useAppStore((s) => s.setPdfEngine);
  const setPagesPerBatch = useAppStore((s) => s.setOpenrouterPagesPerBatch);

  const modality: Modality = PIPELINE_MODALITY[pipeline] ?? "file";
  const isPdf = pipeline.includes("PDF");

  // ── Calculate PDF Pages ───────────────────────────────────
  const [totalPages, setTotalPages] = useState<number>(0);

  useEffect(() => {
    if (!isPdf || !file) return;
    
    let cancelled = false;
    const countPages = async () => {
      try {
        const { PDFDocument } = await import("pdf-lib");
        const buffer = await file.arrayBuffer();
        // Load with ignoreEncryption to avoid errors on some files, though encrypted files might still fail
        const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        if (!cancelled) {
          const count = doc.getPageCount();
          setTotalPages(count);
          // Set default to all pages (total count) if 0 or invalid
          if (pagesPerBatch === 0 || pagesPerBatch > count) {
            setPagesPerBatch(count);
          }
        }
      } catch (err) {
        console.error("Failed to count PDF pages:", err);
      }
    };
    countPages();
    return () => { cancelled = true; };
  }, [file, isPdf, setPagesPerBatch, pagesPerBatch]);

  // Auto-fill env key once
  useEffect(() => {
    if (!apiKey && envKey) setApiKey(envKey);
  }, [apiKey, envKey, setApiKey]);

  // Set default prompt on pipeline change
  useEffect(() => {
    setPrompt(DEFAULT_PROMPTS[modality] ?? "");
  }, [modality, setPrompt]);

  // ── Models fetch (full metadata) ──────────────────────────
  const [allModels, setAllModels] = useState<OpenRouterModelFull[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const fetchModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const { fetchAvailableModelsFull } = await import("@/app/lib/openrouter");
      const models = await fetchAvailableModelsFull(apiKey);
      setAllModels(models);
    } catch {
      setAllModels(Object.values(FALLBACK_MODELS).map((m) => ({
        ...m,
        output_modalities: ["text"],
        context_length: 0,
        pricing: { prompt: "0", completion: "0" },
      })));
    } finally {
      setLoadingModels(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const filteredModels = useMemo(() => {
    const filtered = allModels.filter(
      (m) =>
        m.input_modalities.includes(modality) &&
        !m.output_modalities.includes("embeddings"),
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
    if (filteredModels.length && !filteredModels.find((m: OpenRouterModelFull) => m.id === model)) {
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
          {filteredModels.map((m: OpenRouterModelFull) => {
            const inPrice = formatPricing(m.pricing.prompt);
            const outPrice = formatPricing(m.pricing.completion);
            const ctx = formatCtx(m.context_length);
            return (
              <option key={m.id} value={m.id}>
                {m.name} ({m.id}) — In: {inPrice} · Out: {outPrice} · {ctx} ctx
              </option>
            );
          })}
        </select>
      </div>

      {/* PDF Engine (PDF only) */}
      {isPdf && (
        <div className="grid grid-cols-2 gap-4">
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
          <div>
            <label className="block text-sm font-medium text-gunmetal mb-1">
              Pages Per Batch
            </label>
            <div className="relative">
              <input
                type="number"
                min={1}
                max={totalPages || undefined}
                value={pagesPerBatch === 0 ? "" : pagesPerBatch}
                onChange={(e) => {
                  let val = parseInt(e.target.value);
                  if (isNaN(val)) val = 0;
                  // Clamp value to total pages if known
                  if (totalPages > 0 && val > totalPages) val = totalPages;
                  setPagesPerBatch(val);
                }}
                placeholder={totalPages > 0 ? `Max: ${totalPages}` : "All pages"}
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
              />
              {totalPages > 0 && (
                <span className="absolute right-3 top-2 text-xs text-silver-dark pointer-events-none">
                  / {totalPages}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-silver-dark">
              Process {pagesPerBatch} page{pagesPerBatch !== 1 ? "s" : ""} at a time.
            </p>
          </div>
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
