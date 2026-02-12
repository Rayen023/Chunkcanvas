"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore, defaultExtConfig } from "@/app/lib/store";
import { PIPELINE } from "@/app/lib/constants";
import type { ParsedFileResult } from "@/app/lib/types";
import FileUploader from "./components/upload/FileUploader";
import PipelineSelector from "./components/upload/PipelineSelector";
import ProgressBar from "./components/parsing/ProgressBar";

// Dynamic imports for heavy components — loaded only when needed
const ParsedDocumentView = dynamic(
  () => import("./components/parsing/ParsedDocumentView"),
);
const ChunkingParams = dynamic(
  () => import("./components/chunking/ChunkingParams"),
);
const ChunkList = dynamic(
  () => import("./components/chunking/ChunkList"),
);
const ChunkActions = dynamic(
  () => import("./components/chunking/ChunkActions"),
);
const EmbeddingsSection = dynamic(
  () => import("./components/embeddings/EmbeddingsSection"),
);
const PineconeSection = dynamic(
  () => import("./components/pinecone/PineconeSection"),
);

export default function Home() {
  const files = useAppStore((s) => s.files);
  const parsedContent = useAppStore((s) => s.parsedContent);
  const editedChunks = useAppStore((s) => s.editedChunks);
  const isParsing = useAppStore((s) => s.isParsing);
  const parseProgress = useAppStore((s) => s.parseProgress);
  const parseProgressMsg = useAppStore((s) => s.parseProgressMsg);
  const parseError = useAppStore((s) => s.parseError);
  const isChunking = useAppStore((s) => s.isChunking);
  const openrouterApiKey = useAppStore((s) => s.openrouterApiKey);
  const chunkingParams = useAppStore((s) => s.chunkingParams);
  const parsedResults = useAppStore((s) => s.parsedResults);

  const [parsingTimer, setParsingTimer] = useState(0);
  const [isChunkPreviewPending, setIsChunkPreviewPending] = useState(false);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const abortRef = useRef<AbortController | null>(null);

  const buildParseCacheKey = useCallback((file: File, filePipeline: string, cfg: ReturnType<typeof defaultExtConfig>) => {
    const fileFingerprint = `${file.name}|${file.size}|${file.lastModified}`;
    // Keep only config fields that affect parsing output.
    const relevantCfg: Record<string, unknown> = {
      openrouterModel: cfg.openrouterModel,
      openrouterPrompt: cfg.openrouterPrompt,
      openrouterPagesPerBatch: cfg.openrouterPagesPerBatch,
      pdfEngine: cfg.pdfEngine,
      ollamaEndpoint: cfg.ollamaEndpoint,
      ollamaModel: cfg.ollamaModel,
      ollamaPrompt: cfg.ollamaPrompt,
      vllmEndpoint: cfg.vllmEndpoint,
      vllmModel: cfg.vllmModel,
      vllmPrompt: cfg.vllmPrompt,
      excelSheet: cfg.excelSheet,
      excelColumn: cfg.excelColumn,
    };
    // Stable stringify (keys are fixed, so JSON.stringify is stable enough here)
    return `v1|${fileFingerprint}|p:${filePipeline}|cfg:${JSON.stringify(relevantCfg)}`;
  }, []);

  // ── Cancel Processing ───────────────────────────────────────
  const handleCancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      const state = useAppStore.getState();
      state.setIsParsing(false);
      state.setParseProgress(0, "");
      state.setParseError("Processing cancelled by user");
    }
  }, []);

  // ── Process Document(s) — sequential multi-file ──────────
  const handleProcess = useCallback(async () => {
    const state = useAppStore.getState();
    if (state.files.length === 0) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setParsingTimer(0);
    state.setIsParsing(true);
    state.setParseError(null);
    state.setParseProgress(0, "Initializing...");

    // We keep prior parsed results and embeddings unless the user explicitly Reset/Clear-all.
    // This run will update/append parse results for the current file list as needed.

    const anyLocalPdf = Object.values(state.pipelinesByExt).some(
      (p) => p === PIPELINE.OLLAMA_PDF || p === PIPELINE.VLLM_PDF,
    );
    if (anyLocalPdf) {
      // Ensure UI can show live streaming progress for local PDF parsing.
      if (state.parsedContent === null) state.setParsedContent("");
    }

    const { parseDocument } = await import("@/app/lib/parsers");
    const parsedResults: ParsedFileResult[] = [];
    const nextParseCache: Record<string, ParsedFileResult> = { ...state.parseCache };
    const totalFiles = state.files.length;

    for (let fileIdx = 0; fileIdx < totalFiles; fileIdx++) {
      if (controller.signal.aborted) break;

      const currentFile = state.files[fileIdx];
      const fileExt = currentFile.name.split(".").pop()?.toLowerCase() ?? "";
      const filePipeline = state.pipelinesByExt[fileExt] || state.pipeline;
      const cfg = state.configByExt[fileExt] ?? defaultExtConfig();

      const cacheKey = buildParseCacheKey(currentFile, filePipeline, cfg);
      const cached = nextParseCache[cacheKey];

      state.setCurrentProcessingFile(currentFile.name);
      const baseProgress = (fileIdx / totalFiles) * 100;
      const fileProgressRange = 100 / totalFiles;

      state.setParseProgress(
        baseProgress,
        `[${fileIdx + 1}/${totalFiles}] ${currentFile.name}`,
      );

      const isLocalPdf = filePipeline === PIPELINE.OLLAMA_PDF || filePipeline === PIPELINE.VLLM_PDF;
      const streamingPages: Map<number, string> = new Map();

      try {
        if (cached) {
          parsedResults.push({ ...cached, cacheKey });

          const combinedContent = parsedResults
            .map((r) => (totalFiles > 1 ? `\n═══ ${r.filename} ═══\n${r.content}` : r.content))
            .join("\n\n");
          state.setParsedContent(combinedContent);
          state.setParsedResults([...parsedResults]);

          state.setParseProgress(
            baseProgress + fileProgressRange,
            `[${fileIdx + 1}/${totalFiles}] ${currentFile.name} — Reused cached parse`,
          );
          continue;
        }

        const result = await parseDocument({
          pipeline: filePipeline,
          file: currentFile,
          openrouterApiKey: state.openrouterApiKey,
          openrouterModel: cfg.openrouterModel,
          openrouterPrompt: cfg.openrouterPrompt,
          openrouterPagesPerBatch: cfg.openrouterPagesPerBatch,
          pdfEngine: cfg.pdfEngine,
          ollamaEndpoint: cfg.ollamaEndpoint,
          ollamaModel: cfg.ollamaModel,
          ollamaPrompt: cfg.ollamaPrompt,
          vllmEndpoint: cfg.vllmEndpoint,
          vllmModel: cfg.vllmModel,
          vllmPrompt: cfg.vllmPrompt,
          excelColumn: cfg.excelColumn,
          excelSheet: cfg.excelSheet,
          onProgress: (pct, msg) => {
            const adjusted = baseProgress + (pct / 100) * fileProgressRange;
            state.setParseProgress(
              adjusted,
              `[${fileIdx + 1}/${totalFiles}] ${currentFile.name} — ${msg || "Processing…"}`,
            );
          },
          signal: controller.signal,
          onPageStream: isLocalPdf
            ? (pageNum, _token, fullPage) => {
                streamingPages.set(pageNum, fullPage);
                const sorted = Array.from(streamingPages.entries())
                  .sort(([a], [b]) => a - b)
                  .map(([num, text]) => `--- Page ${num} ---\n${text}`);
                const currentFileContent = sorted.join("\n\n");
                const allContent = [
                  ...parsedResults.map((r) =>
                    totalFiles > 1 ? `\n═══ ${r.filename} ═══\n${r.content}` : r.content,
                  ),
                  totalFiles > 1 ? `\n═══ ${currentFile.name} ═══\n${currentFileContent}` : currentFileContent,
                ].join("\n\n");
                state.setParsedContent(allContent);
              }
            : undefined,
        });

        parsedResults.push({
          filename: currentFile.name,
          content: result.content,
          excelRows: result.excelRows,
          pipeline: filePipeline,
          cacheKey,
        });

        nextParseCache[cacheKey] = {
          filename: currentFile.name,
          content: result.content,
          excelRows: result.excelRows,
          pipeline: filePipeline,
          cacheKey,
        };

        const combinedContent = parsedResults
          .map((r) => (totalFiles > 1 ? `\n═══ ${r.filename} ═══\n${r.content}` : r.content))
          .join("\n\n");
        state.setParsedContent(combinedContent);
        state.setParsedResults([...parsedResults]);
      } catch (err) {
        if ((err as Error).name === "AbortError") break;
        state.setParseError(
          `Error parsing ${currentFile.name}: ${err instanceof Error ? err.message : String(err)}`,
        );
        break;
      }
    }

    if (parsedResults.length > 0) {
      state.setParsedFilename(totalFiles === 1 ? parsedResults[0].filename : `${parsedResults.length} files`);
      const uniquePipelines = [...new Set(parsedResults.map((r) => r.pipeline))];
      state.setParsedDocType(uniquePipelines.length === 1 ? uniquePipelines[0] : "Mixed pipelines");

      const allExcelRows = parsedResults.filter((r) => r.excelRows).flatMap((r) => r.excelRows!);
      if (allExcelRows.length > 0) {
        state.setParsedExcelRows(allExcelRows);
      }
    }

    state.setParseCache(nextParseCache);
    state.setIsParsing(false);
    state.setCurrentProcessingFile("");
  }, [buildParseCacheKey]);

  // ── Chunk Document(s) — each file chunked independently ──
  const handleChunk = useCallback(async () => {
    const state = useAppStore.getState();
    const results = state.parsedResults;
    if (results.length === 0 && !state.parsedContent) return;

    state.setIsChunking(true);

    try {
      const { chunkText, chunkExcelRows } = await import("@/app/lib/chunking");
      const allChunks: string[] = [];
      const allSourceFiles: string[] = [];

      if (results.length > 0) {
        for (const result of results) {
          let fileChunks: string[];
          if (
            (result.pipeline === PIPELINE.EXCEL_SPREADSHEET || result.pipeline === PIPELINE.CSV_SPREADSHEET) &&
            result.excelRows
          ) {
            fileChunks = await chunkExcelRows(result.excelRows, state.chunkingParams, result.filename);
          } else {
            fileChunks = await chunkText(result.content, state.chunkingParams, result.filename);
          }
          allChunks.push(...fileChunks);
          allSourceFiles.push(...fileChunks.map(() => result.filename));
        }
      } else {
        const chunks = await chunkText(state.parsedContent!, state.chunkingParams, state.parsedFilename);
        allChunks.push(...chunks);
        allSourceFiles.push(...chunks.map(() => state.parsedFilename));
      }

      state.setEditedChunks(allChunks);
      state.setChunkSourceFiles(allSourceFiles);
    } catch (err) {
      state.setParseError(err instanceof Error ? err.message : String(err));
    } finally {
      state.setIsChunking(false);
    }
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isParsing) {
      interval = setInterval(() => {
        setParsingTimer((t) => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isParsing]);

  // ── Scroll-based step detection ────────────────────────────
  const setScrollActiveStep = useAppStore((s) => s.setScrollActiveStep);
  const embeddingsData = useAppStore((s) => s.embeddingsData);

  useEffect(() => {
    // Only activate scroll detection if we have content
    if (!parsedContent) {
      setScrollActiveStep(null);
      return;
    }

    const stepIds = ["step-3", "step-4", "step-5", "step-6"];
    const elements = stepIds.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // We want to find the visible step that is "most" on screen or highest up
        // Simple logic: find the one with highest intersection ratio
        let bestStep: number | null = null;
        let bestRatio = 0;

        for (const entry of entries) {
          const id = entry.target.id;
          const stepNum = parseInt(id.replace("step-", ""), 10);
          if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestStep = stepNum;
          }
        }
        
        if (bestStep !== null) {
          setScrollActiveStep(bestStep);
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [parsedContent, editedChunks.length, embeddingsData, setScrollActiveStep]);

  // ── Live Chunking ──────────────────────────────────────────
  useEffect(() => {
    if ((parsedContent || parsedResults.length > 0) && !isParsing) {
      setIsChunkPreviewPending(true);
      const timer = setTimeout(() => {
        handleChunk();
      }, 400);
      return () => clearTimeout(timer);
    }
    setIsChunkPreviewPending(false);
  }, [chunkingParams, parsedResults, parsedContent, isParsing, handleChunk]);

  useEffect(() => {
    if (isChunking) {
      setIsChunkPreviewPending(false);
    }
  }, [isChunking]);

  const pipelinesByExt = useAppStore((s) => s.pipelinesByExt);

  const fileExts = useMemo(() => {
    const exts = new Set<string>();
    for (const f of files) {
      exts.add(f.name.split(".").pop()?.toLowerCase() ?? "");
    }
    return exts;
  }, [files]);

  const selectedPipelines = useMemo(() => Object.values(pipelinesByExt).filter(Boolean), [pipelinesByExt]);

  const allExtsCovered = useMemo(
    () => fileExts.size > 0 && [...fileExts].every((ext) => !!pipelinesByExt[ext]),
    [fileExts, pipelinesByExt],
  );

  const needsOpenRouter = selectedPipelines.some((p) => p.startsWith("OpenRouter"));

  const canProcess =
    files.length > 0 && allExtsCovered && !isParsing && (needsOpenRouter ? !!openrouterApiKey : true);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-8">
      {/* ── Mobile Header ──────────────────────────────── */}
      <div className="lg:hidden flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-sandy flex items-center justify-center text-white font-bold text-sm">
          CC
        </div>
        <span className="text-lg font-semibold text-gunmetal">ChunkCanvas</span>
      </div>

      {/* ═══════ STEP 1 — Upload Files ═══════ */}
      <section id="step-1" className="bg-card rounded-xl shadow-sm border border-silver-light p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gunmetal">
          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-sandy text-white text-xs font-bold mr-2">
            1
          </span>
          Upload Files
        </h2>
        <FileUploader />
      </section>

      {/* ═══════ STEP 2 — Pipeline, Configure & Parse ═══════ */}
      {files.length > 0 && (
        <section id="step-2" className="bg-card rounded-xl shadow-sm border border-silver-light p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gunmetal">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-sandy text-white text-xs font-bold mr-2">
              2
            </span>
            Select Pipeline, Configure &amp; Parse
          </h2>
          <PipelineSelector />
          {isParsing && (
            <ProgressBar progress={parseProgress} message={parseProgressMsg} timer={formatTime(parsingTimer)} />
          )}
          {parseError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{parseError}</div>
          )}
          {isParsing ? (
            <div className="flex gap-2">
              <button
                disabled
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sandy px-4 py-3 text-sm font-medium text-white opacity-75 cursor-not-allowed"
              >
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing…
              </button>
              <button
                onClick={handleCancel}
                className="px-6 py-3 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 active:bg-red-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleProcess}
              disabled={!canProcess}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-sandy px-4 py-3 text-sm font-medium text-white hover:bg-sandy-light active:bg-sandy-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Parse Document{files.length > 1 ? "s" : ""}
            </button>
          )}
        </section>
      )}

      {/* ═══════ STEP 3 — Review Parsed Content ═══════ */}
      {parsedContent !== null && (
        <section id="step-3" className="bg-card rounded-xl shadow-sm border border-silver-light p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gunmetal">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-sandy text-white text-xs font-bold mr-2">
              3
            </span>
            Review Parsed Content
          </h2>
          <ParsedDocumentView />
        </section>
      )}

      {/* ═══════ STEP 4 — Chunking Configuration & Preview ═══════ */}
      {parsedContent !== null && (
        <section id="step-4" className="bg-card rounded-xl shadow-sm border border-silver-light p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold text-gunmetal">
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-sandy text-white text-xs font-bold mr-2">
                4
              </span>
              Chunking Configuration &amp; Preview
            </h2>

            {(isChunking || isChunkPreviewPending) && (
              <div className="flex items-center gap-2 rounded-lg border border-silver-light bg-card px-3 py-1.5 text-xs text-silver-dark">
                {isChunking ? (
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <span className="inline-flex items-center gap-1" aria-hidden>
                    <span className="h-1.5 w-1.5 rounded-full bg-sandy animate-pulse" />
                    <span className="h-1.5 w-1.5 rounded-full bg-sandy/70 animate-pulse [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-sandy/50 animate-pulse [animation-delay:300ms]" />
                  </span>
                )}
                {isChunking ? "Updating" : "Applying changes…"}
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[360px,1fr] lg:items-start">
            {/* Left: Params */}
            <div className="rounded-xl border border-silver-light bg-card p-4">
              <ChunkingParams />
            </div>

            {/* Right: Live preview + actions */}
            <div className="rounded-xl border border-silver-light bg-card p-4">
              {editedChunks.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden pr-1">
                    <ChunkList variant="panel" pending={isChunkPreviewPending} />
                  </div>
                  <div className="border-t border-silver-light pt-3">
                    <ChunkActions />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-silver-light p-6 text-sm text-silver-dark">
                  Chunks will appear here as you adjust the parameters.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ═══════ STEP 5 — Embeddings ═══════ */}
      {editedChunks.length > 0 && (
        <section id="step-5">
          <EmbeddingsSection />
        </section>
      )}

      {/* ═══════ STEP 6 — Vector Databases ═══════ */}
      {editedChunks.length > 0 && (
        <section id="step-6">
          <PineconeSection />
        </section>
      )}

      {/* Bottom spacing */}
      <div className="h-16" />
    </div>
  );
}
