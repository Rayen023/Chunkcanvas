"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/app/lib/store";
import { PIPELINE } from "@/app/lib/constants";
import FileUploader from "./components/upload/FileUploader";
import PipelineSelector from "./components/upload/PipelineSelector";
import ProgressBar from "./components/parsing/ProgressBar";

// Dynamic imports for heavy components — loaded only when needed
const OpenRouterForm = dynamic(
  () => import("./components/pipeline-forms/OpenRouterForm"),
  { loading: () => <FormSkeleton /> },
);
const ExcelForm = dynamic(
  () => import("./components/pipeline-forms/ExcelForm"),
  { loading: () => <FormSkeleton /> },
);
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
const VoyageSection = dynamic(
  () => import("./components/embeddings/VoyageSection"),
);
const PineconeSection = dynamic(
  () => import("./components/pinecone/PineconeSection"),
);

function FormSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 w-24 bg-silver-light rounded" />
      <div className="h-10 w-full bg-silver-light rounded-lg" />
      <div className="h-4 w-16 bg-silver-light rounded" />
      <div className="h-10 w-full bg-silver-light rounded-lg" />
    </div>
  );
}

export default function Home() {
  const file = useAppStore((s) => s.file);
  const pipeline = useAppStore((s) => s.pipeline);
  const parsedContent = useAppStore((s) => s.parsedContent);
  const editedChunks = useAppStore((s) => s.editedChunks);
  const isParsing = useAppStore((s) => s.isParsing);
  const parseProgress = useAppStore((s) => s.parseProgress);
  const parseProgressMsg = useAppStore((s) => s.parseProgressMsg);
  const parseError = useAppStore((s) => s.parseError);
  const isChunking = useAppStore((s) => s.isChunking);
  const openrouterApiKey = useAppStore((s) => s.openrouterApiKey);

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

  const isOpenRouter = pipeline.startsWith("OpenRouter");
  const showForm = !!pipeline;
  const canProcess =
    !!file &&
    !!pipeline &&
    !isParsing &&
    (isOpenRouter ? !!openrouterApiKey : true);

  // ── Process Document ────────────────────────────────────────
  const handleProcess = useCallback(async () => {
    const state = useAppStore.getState();
    if (!state.file || !state.pipeline) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    state.setIsParsing(true);
    state.setParseError(null);
    state.setParseProgress(0);
    state.resetDownstream(3);

    try {
      const { parseDocument } = await import("@/app/lib/parsers");

      const result = await parseDocument({
        pipeline: state.pipeline,
        file: state.file,
        openrouterApiKey: state.openrouterApiKey,
        openrouterModel: state.openrouterModel,
        openrouterPrompt: state.openrouterPrompt,
        pdfEngine: state.pdfEngine,
        excelColumn: state.excelColumn,
        onProgress: (pct, msg) => state.setParseProgress(pct, msg),
        signal: controller.signal,
      });

      state.setParsedContent(result.content);
      state.setParsedFilename(state.file.name);
      state.setParsedDocType(state.pipeline);
      if (result.excelRows) state.setParsedExcelRows(result.excelRows);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        state.setParseError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      state.setIsParsing(false);
    }
  }, []);

  // ── Chunk Document ──────────────────────────────────────────
  const handleChunk = useCallback(async () => {
    const state = useAppStore.getState();
    if (!state.parsedContent) return;

    state.setIsChunking(true);
    state.resetDownstream(4);

    try {
      const { chunkText, chunkExcelRows } = await import("@/app/lib/chunking");

      let chunks: string[];
      if (
        state.pipeline === PIPELINE.EXCEL_SPREADSHEET &&
        state.parsedExcelRows
      ) {
        chunks = await chunkExcelRows(
          state.parsedExcelRows,
          state.chunkingParams,
          state.parsedFilename,
        );
      } else {
        chunks = await chunkText(
          state.parsedContent,
          state.chunkingParams,
          state.parsedFilename,
        );
      }

      state.setEditedChunks(chunks);
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

      {/* ═══════ STEP 1 — Upload & Pipeline ═══════ */}
      <section id="step-1" className="bg-white rounded-xl shadow-sm border border-silver-light p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gunmetal">
          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-sandy text-white text-xs font-bold mr-2">
            1
          </span>
          Upload &amp; Select Pipeline
        </h2>

        <FileUploader />
        {file && <PipelineSelector />}
      </section>

      {/* ═══════ STEP 2 — Pipeline Config & Process ═══════ */}
      {showForm && (
        <section id="step-2" className="bg-white rounded-xl shadow-sm border border-silver-light p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gunmetal">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-sandy text-white text-xs font-bold mr-2">
              2
            </span>
            Configure &amp; Parse
          </h2>

          {/* Pipeline-specific form */}
          {isOpenRouter && <OpenRouterForm />}
          {pipeline === PIPELINE.EXCEL_SPREADSHEET && <ExcelForm />}
          {pipeline === PIPELINE.SIMPLE_TEXT && (
            <p className="text-sm text-silver-dark">
              No configuration needed for Simple Text extraction.
            </p>
          )}

          {/* Progress bar */}
          {isParsing && (
            <ProgressBar
              progress={parseProgress}
              message={parseProgressMsg}
            />
          )}

          {/* Error */}
          {parseError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {parseError}
            </div>
          )}

          {/* Process button */}
          <button
            onClick={handleProcess}
            disabled={!canProcess}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-sandy px-4 py-3 text-sm font-medium text-white hover:bg-sandy-light active:bg-sandy-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            {isParsing ? (
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
                Processing…
              </>
            ) : (
              "Parse Document"
            )}
          </button>
        </section>
      )}

      {/* ═══════ STEP 3 — Parsed Document & Chunking ═══════ */}
      {parsedContent && (
        <section id="step-3" className="bg-white rounded-xl shadow-sm border border-silver-light p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gunmetal">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-sandy text-white text-xs font-bold mr-2">
              3
            </span>
            Review &amp; Chunk
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
              "Chunk Document"
            )}
          </button>
        </section>
      )}

      {/* ═══════ STEP 4 — Editable Chunks ═══════ */}
      {editedChunks.length > 0 && (
        <section id="step-4" className="bg-white rounded-xl shadow-sm border border-silver-light p-6 space-y-5">
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

      {/* ═══════ STEP 5 — Voyage AI Embeddings ═══════ */}
      {editedChunks.length > 0 && (
        <section id="step-5">
          <VoyageSection />
        </section>
      )}

      {/* ═══════ STEP 6 — Pinecone Upload ═══════ */}
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
