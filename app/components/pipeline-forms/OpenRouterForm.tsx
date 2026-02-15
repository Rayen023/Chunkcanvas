"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useAppStore } from "@/app/lib/store";
import {
  OPENROUTER_DEFAULT_MODEL,
  PDF_ENGINES,
  DEFAULT_PROMPTS,
  FALLBACK_MODELS,
} from "@/app/lib/constants";
import { PIPELINE_MODALITY } from "@/app/lib/types";
import type { OpenRouterModelFull, Modality } from "@/app/lib/types";

function formatPricing(pricePerToken: string): string {
  const val = parseFloat(pricePerToken);
  if (isNaN(val) || val === 0) return "Free";
  const perMillion = val * 1_000_000;
  if (perMillion < 0.01) return `$${perMillion.toFixed(4)}/M`;
  if (perMillion < 1) return `$${perMillion.toFixed(3)}/M`;
  return `$${perMillion.toFixed(2)}/M`;
}

function formatCtx(ctx: number): string {
  if (!ctx || ctx === 0) return "?";
  if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(1)}M`;
  if (ctx >= 1_000) return `${Math.round(ctx / 1_000)}k`;
  return String(ctx);
}

export default function OpenRouterForm({ ext }: { ext: string }) {
  const pipelinesByExt = useAppStore((s) => s.pipelinesByExt);
  const pipeline = pipelinesByExt[ext] ?? "";
  const apiKey = useAppStore((s) => s.openrouterApiKey);
  const setOpenrouterApiKey = useAppStore((s) => s.setOpenrouterApiKey);
  const envOpenrouterKey = useAppStore((s) => s.envKeys.openrouter);
  const config = useAppStore((s) => s.configByExt[ext]);
  const setConfigForExt = useAppStore((s) => s.setConfigForExt);
  const files = useAppStore((s) => s.files);
  const pdfFiles = useMemo(
    () => files.filter(f => (f.name.split(".").pop()?.toLowerCase() ?? "") === ext),
    [files, ext],
  );

  const model = config?.openrouterModel ?? "google/gemini-3-flash-preview";
  const prompt = config?.openrouterPrompt ?? "";
  const pdfEngine = config?.pdfEngine ?? "native";
  const pagesPerBatch = config?.openrouterPagesPerBatch ?? 0;

  const setModel = useCallback((v: string) => setConfigForExt(ext, { openrouterModel: v }), [ext, setConfigForExt]);
  const setPrompt = useCallback((v: string) => setConfigForExt(ext, { openrouterPrompt: v }), [ext, setConfigForExt]);
  const setPdfEngine = useCallback((v: string) => setConfigForExt(ext, { pdfEngine: v as "native" | "pdf-text" | "mistral-ocr" }), [ext, setConfigForExt]);
  const setPagesPerBatch = useCallback((v: number) => setConfigForExt(ext, { openrouterPagesPerBatch: v }), [ext, setConfigForExt]);

  const modality: Modality = PIPELINE_MODALITY[pipeline] ?? "file";
  const isPdf = pipeline.includes("PDF");

  // ── Calculate PDF Pages (all files) ────────────────────────
  const [pageMap, setPageMap] = useState<Map<string, number>>(new Map());

  const maxPages = useMemo(() => {
    if (pageMap.size === 0) return 0;
    return Math.max(...pageMap.values());
  }, [pageMap]);

  const totalPagesAllFiles = useMemo(() => {
    if (pageMap.size === 0) return 0;
    let sum = 0;
    pageMap.forEach((v) => { sum += v; });
    return sum;
  }, [pageMap]);

  const totalBatches = useMemo(() => {
    if (pageMap.size === 0) return 0;
    const batchSize = pagesPerBatch > 0 ? pagesPerBatch : maxPages;
    if (batchSize === 0) return 0;
    let sum = 0;
    pageMap.forEach((pages) => { sum += Math.ceil(pages / batchSize); });
    return sum;
  }, [pageMap, pagesPerBatch, maxPages]);

  const clampPages = useCallback((val: number) => {
    let next = Math.max(1, val);
    if (maxPages > 0 && next > maxPages) next = maxPages;
    return next;
  }, [maxPages]);

  useEffect(() => {
    if (!isPdf || pdfFiles.length === 0) {
      setPageMap(new Map());
      return;
    }

    let cancelled = false;
    const countAllPages = async () => {
      try {
        const { PDFDocument } = await import("pdf-lib");
        const results = new Map<string, number>();
        let globalMax = 0;

        await Promise.all(
          pdfFiles.map(async (f) => {
            try {
              const buffer = await f.arrayBuffer();
              const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
              const count = doc.getPageCount();
              results.set(f.name, count);
              if (count > globalMax) globalMax = count;
            } catch (err) {
              console.error(`Failed to count pages for ${f.name}:`, err);
            }
          }),
        );

        if (!cancelled) {
          setPageMap(results);
          // Set default to max pages if 0 or exceeds max
          if (pagesPerBatch === 0 || pagesPerBatch > globalMax) {
            setPagesPerBatch(globalMax);
          }
        }
      } catch (err) {
        console.error("Failed to count PDF pages:", err);
      }
    };
    countAllPages();
    return () => { cancelled = true; };
  }, [pdfFiles, isPdf, setPagesPerBatch, pagesPerBatch]);

  // Auto-fill env key once
  useEffect(() => {
    if (!apiKey && envOpenrouterKey) setOpenrouterApiKey(envOpenrouterKey);
  }, [apiKey, envOpenrouterKey, setOpenrouterApiKey]);

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

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize prompt height
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const newHeight = Math.min(Math.max(el.scrollHeight + 2, 100), 300);
    el.style.height = `${newHeight}px`;
  }, [prompt]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gunmetal mb-1">
          OpenRouter API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setOpenrouterApiKey(e.target.value)}
          placeholder="sk-or-..."
          className="w-full rounded-lg border border-silver bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
        />
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
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm bg-card focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none appearance-none"
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

      {/* PDF Engine & Pages per Batch (PDF only) */}
      {isPdf && (
        <div className="space-y-4">
          {/* PDF Processing Engine */}
          <div>
            <label className="block text-sm font-medium text-gunmetal mb-1">
              PDF Processing Engine
            </label>
            <select
              value={pdfEngine}
              onChange={(e) =>
                setPdfEngine(e.target.value)
              }
              className="w-full rounded-lg border border-silver px-3 py-2 text-sm bg-card focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none appearance-none"
            >
              {PDF_ENGINES.map((eng) => (
                <option key={eng.key} value={eng.key}>
                  {eng.label}
                </option>
              ))}
            </select>
          </div>

          {/* Pages per Batch */}
          <div className="rounded-lg border border-silver bg-card p-4 space-y-3">
            {/* Header row: label + total batches badge */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gunmetal">
                  Pages per request
                </label>
                <p className="text-xs text-silver-dark mt-0.5">
                  How many PDF pages to send in each request
                </p>
              </div>
              {maxPages > 0 && (
                <div className="text-right shrink-0 ml-4">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-sandy/10 px-2.5 py-1 text-sm font-semibold text-sandy tabular-nums">
                    {totalBatches}
                    <span className="text-xs font-medium text-sandy/70">Request{totalBatches !== 1 ? "s" : ""}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Controls: stepper + slider + All button */}
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-lg border border-silver overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (pagesPerBatch === 0) {
                      setPagesPerBatch(1);
                      return;
                    }
                    setPagesPerBatch(clampPages(pagesPerBatch - 1));
                  }}
                  disabled={pagesPerBatch <= 1}
                  className="px-3 py-2 text-sm font-medium text-gunmetal hover:bg-sandy/10 active:bg-sandy/20 disabled:opacity-40 transition-colors duration-150"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={maxPages || undefined}
                  value={pagesPerBatch === 0 ? "" : pagesPerBatch}
                  onChange={(e) => {
                    if (e.target.value === "") {
                      setPagesPerBatch(0);
                      return;
                    }
                    const val = Number(e.target.value);
                    if (Number.isNaN(val)) return;
                    setPagesPerBatch(clampPages(val));
                  }}
                  placeholder={maxPages > 0 ? String(maxPages) : "All"}
                  className="w-14 py-2 text-center text-sm font-medium tabular-nums border-x border-silver bg-transparent focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (pagesPerBatch === 0) {
                      setPagesPerBatch(1);
                      return;
                    }
                    setPagesPerBatch(clampPages(pagesPerBatch + 1));
                  }}
                  disabled={maxPages > 0 && pagesPerBatch >= maxPages}
                  className="px-3 py-2 text-sm font-medium text-gunmetal hover:bg-sandy/10 active:bg-sandy/20 disabled:opacity-40 transition-colors duration-150"
                >
                  +
                </button>
              </div>

              {maxPages > 1 && (
                <input
                  type="range"
                  min={1}
                  max={maxPages}
                  value={pagesPerBatch > 0 ? pagesPerBatch : maxPages}
                  onChange={(e) => setPagesPerBatch(clampPages(Number(e.target.value)))}
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-sandy bg-silver/40 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sandy [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-sandy [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                />
              )}

              {maxPages > 1 && (
                <button
                  type="button"
                  onClick={() => setPagesPerBatch(maxPages)}
                  className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors duration-150 ${
                    pagesPerBatch === maxPages
                      ? "bg-sandy text-white border-sandy"
                      : "border-silver text-gunmetal hover:bg-sandy/10 hover:border-sandy/50"
                  }`}
                >
                  All
                </button>
              )}
            </div>

            {/* Per-file breakdown */}
            {maxPages > 0 && (
              <div className="border-t border-silver/50 pt-3">
                <div className="space-y-1.5">
                  {Array.from(pageMap.entries()).map(([name, pages]) => {
                    const batchSize = pagesPerBatch > 0 ? pagesPerBatch : maxPages;
                    const batches = batchSize > 0 ? Math.ceil(pages / batchSize) : 1;
                    return (
                      <div key={name} className="flex items-center justify-between text-xs">
                        <span className="text-gunmetal/80 truncate mr-3 font-mono" title={name}>
                          {name}
                        </span>
                        <span className="shrink-0 tabular-nums text-silver-dark">
                          {pages} pg{pages !== 1 ? "s" : ""}
                          {" → "}
                          <span className="font-medium text-gunmetal">{batches}</span> request{batches !== 1 ? "s" : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed border-silver/40 text-xs font-medium">
                  <span className="text-gunmetal/70">Total</span>
                  <span className="tabular-nums text-gunmetal">
                    {totalPagesAllFiles} pages → {totalBatches} request{totalBatches !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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

