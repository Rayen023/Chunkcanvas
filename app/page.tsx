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
const DownloadJsonButton = dynamic(
  () => import("./components/downloads/DownloadJsonButton"),
);
const DownloadScriptButton = dynamic(
  () => import("./components/downloads/DownloadScriptButton"),
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

  const [parsingTimer, setParsingTimer] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isParsing) {
      interval = setInterval(() => {
        setParsingTimer((t) => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isParsing]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const abortRef = useRef<AbortController | null>(null);

  // ── Scroll-based step detection between steps 4 and 5 ────
  const setScrollActiveStep = useAppStore((s) => s.setScrollActiveStep);
  const embeddingsData = useAppStore((s) => s.embeddingsData);

  useEffect(() => {
    // Only enable scroll detection when chunks exist but no embeddings
    const hasChunks = editedChunks.length > 0;
    const hasEmbeddings = embeddingsData && embeddingsData.length > 0;

    if (!hasChunks || hasEmbeddings) {
      setScrollActiveStep(null);
      return;
    }

    const step4El = document.getElementById("step-4");
    const step5El = document.getElementById("step-5");
    if (!step4El || !step5El) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the most visible section
        let bestStep: number | null = null;
        let bestRatio = 0;
        for (const entry of entries) {
          const stepNum = entry.target.id === "step-4" ? 4 : 5;
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

    observer.observe(step4El);
    observer.observe(step5El);

    // Also set initial value based on what's visible
    const step5Rect = step5El.getBoundingClientRect();
    const inView = step5Rect.top < window.innerHeight && step5Rect.bottom > 0;
    setScrollActiveStep(inView ? 5 : 4);

    return () => observer.disconnect();
  }, [editedChunks.length, embeddingsData, setScrollActiveStep]);

  const pipelinesByExt = useAppStore((s) => s.pipelinesByExt);

  /** Unique set of file extensions present in uploaded files */
  const fileExts = useMemo(() => {
    const exts = new Set<string>();
    for (const f of files) {
      exts.add(f.name.split(".").pop()?.toLowerCase() ?? "");
    }
    return exts;
  }, [files]);

  /** All pipelines currently selected across extension groups */
  const selectedPipelines = useMemo(
    () => Object.values(pipelinesByExt).filter(Boolean),
    [pipelinesByExt],
  );

  /** Whether every extension has a pipeline selected */
  const allExtsCovered = useMemo(
    () => fileExts.size > 0 && [...fileExts].every((ext) => !!pipelinesByExt[ext]),
    [fileExts, pipelinesByExt],
  );

  const needsOpenRouter = selectedPipelines.some((p) => p.startsWith("OpenRouter"));

  const canProcess =
    files.length > 0 &&
    allExtsCovered &&
    !isParsing &&
    (needsOpenRouter ? !!openrouterApiKey : true);

  // ── Cancel Processing ───────────────────────────────────────
  const handleCancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      const state = useAppStore.getState();
      state.setIsParsing(false);      state.setParseProgress(0, "");      state.setParseError("Processing cancelled by user");
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
    state.resetDownstream(3);
    state.setParsedResults([]);

    // Any file using a local-streaming pipeline?
    const anyLocalPdf = Object.values(state.pipelinesByExt).some(
      (p) => p === PIPELINE.OLLAMA_PDF || p === PIPELINE.VLLM_PDF,
    );
    if (anyLocalPdf) {
      state.setParsedContent("");
    }

    const { parseDocument } = await import("@/app/lib/parsers");
    const parsedResults: ParsedFileResult[] = [];
    const totalFiles = state.files.length;

    for (let fileIdx = 0; fileIdx < totalFiles; fileIdx++) {
      if (controller.signal.aborted) break;

      const currentFile = state.files[fileIdx];
      const fileExt = currentFile.name.split(".").pop()?.toLowerCase() ?? "";
      const filePipeline = state.pipelinesByExt[fileExt] || state.pipeline;
      const cfg = state.configByExt[fileExt] ?? defaultExtConfig();

      state.setCurrentProcessingFile(currentFile.name);
      const baseProgress = (fileIdx / totalFiles) * 100;
      const fileProgressRange = 100 / totalFiles;

      state.setParseProgress(
        baseProgress,
        `[${fileIdx + 1}/${totalFiles}] ${currentFile.name}`,
      );

      const isLocalPdf =
        filePipeline === PIPELINE.OLLAMA_PDF ||
        filePipeline === PIPELINE.VLLM_PDF;
      const streamingPages: Map<number, string> = new Map();

      try {
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
                    totalFiles > 1
                      ? `\n═══ ${r.filename} ═══\n${r.content}`
                      : r.content,
                  ),
                  totalFiles > 1
                    ? `\n═══ ${currentFile.name} ═══\n${currentFileContent}`
                    : currentFileContent,
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
        });

        // Update combined content after each file
        const combinedContent = parsedResults
          .map((r) =>
            totalFiles > 1
              ? `\n═══ ${r.filename} ═══\n${r.content}`
              : r.content,
          )
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

    // Final state
    if (parsedResults.length > 0) {
      state.setParsedFilename(
        totalFiles === 1
          ? parsedResults[0].filename
          : `${parsedResults.length} files`,
      );
      const uniquePipelines = [...new Set(parsedResults.map((r) => r.pipeline))];
      state.setParsedDocType(
        uniquePipelines.length === 1 ? uniquePipelines[0] : "Mixed pipelines",
      );

      const allExcelRows = parsedResults
        .filter((r) => r.excelRows)
        .flatMap((r) => r.excelRows!);
      if (allExcelRows.length > 0) {
        state.setParsedExcelRows(allExcelRows);
      }
    }

    state.setIsParsing(false);
    state.setCurrentProcessingFile("");
  }, []);

  // ── Chunk Document(s) — each file chunked independently ──
  const handleChunk = useCallback(async () => {
    const state = useAppStore.getState();
    const results = state.parsedResults;
    if (results.length === 0 && !state.parsedContent) return;

    state.setIsChunking(true);
    state.resetDownstream(4);

    try {
      const { chunkText, chunkExcelRows } = await import("@/app/lib/chunking");

      const allChunks: string[] = [];
      const allSourceFiles: string[] = [];

      if (results.length > 0) {
        // Multi-file: chunk each file independently (ensures file boundaries)
        for (const result of results) {
          let fileChunks: string[];
          if (
            (result.pipeline === PIPELINE.EXCEL_SPREADSHEET ||
              result.pipeline === PIPELINE.CSV_SPREADSHEET) &&
            result.excelRows
          ) {
            fileChunks = await chunkExcelRows(
              result.excelRows,
              state.chunkingParams,
              result.filename,
            );
          } else {
            fileChunks = await chunkText(
              result.content,
              state.chunkingParams,
              result.filename,
            );
          }
          allChunks.push(...fileChunks);
          allSourceFiles.push(...fileChunks.map(() => result.filename));
        }
      } else {
        // Fallback: single parsedContent
        const chunks = await chunkText(
          state.parsedContent!,
          state.chunkingParams,
          state.parsedFilename,
        );
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

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-8">
      {/* ── Mobile Header ──────────────────────────────── */}
      <div className="lg:hidden flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-sandy flex items-center justify-center text-white font-bold text-sm">
          CC
        </div>
        <span className="text-lg font-semibold text-gunmetal">
          ChunkCanvas
        </span>
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

          {/* Progress bar */}
          {isParsing && (
            <ProgressBar
              progress={parseProgress}
              message={parseProgressMsg}
              timer={formatTime(parsingTimer)}
            />
          )}

          {/* Error */}
          {parseError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {parseError}
            </div>
          )}

          {/* Process / Cancel buttons */}
          {isParsing ? (
            <div className="flex gap-2">
              <button
                disabled
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sandy px-4 py-3 text-sm font-medium text-white opacity-75 cursor-not-allowed"
              >
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
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

      {/* ═══════ STEP 3 — Parsed Document & Chunking ═══════ */}
      {(parsedContent !== null) && (
        <section id="step-3" className="bg-card rounded-xl shadow-sm border border-silver-light p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gunmetal">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-sandy text-white text-xs font-bold mr-2">
              3
            </span>
            {isParsing ? "Live Preview" : "Review & Chunk"}
          </h2>

          <ParsedDocumentView />

          <div className="h-px bg-silver-light" />

          <ChunkingParams />

          <button
            onClick={handleChunk}
            disabled={isChunking}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-sandy px-4 py-3 text-sm font-medium text-white hover:bg-sandy-light active:bg-sandy-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            {isChunking ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Chunking…
              </>
            ) : (
              `Chunk Document${files.length > 1 ? "s" : ""}`
            )}
          </button>
        </section>
      )}

      {/* ═══════ STEP 4 — Editable Chunks ═══════ */}
      {editedChunks.length > 0 && (
        <section id="step-4" className="bg-card rounded-xl shadow-sm border border-silver-light p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gunmetal">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-sandy text-white text-xs font-bold mr-2">
              4
            </span>
            Edit Chunks &amp; Download
          </h2>

          <ChunkList />

          <div className="h-px bg-silver-light" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DownloadJsonButton />
            <DownloadScriptButton
              stage="chunks"
              label="Download Pipeline Script (.zip)"
            />
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
