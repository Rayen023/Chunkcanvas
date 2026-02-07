"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/app/lib/store";
import { VOYAGE_MODELS } from "@/app/lib/constants";
import DownloadScriptButton from "../downloads/DownloadScriptButton";
import type { EmbeddingsJson } from "@/app/lib/types";

export default function VoyageSection() {
  const editedChunks = useAppStore((s) => s.editedChunks);
  const parsedFilename = useAppStore((s) => s.parsedFilename);
  const pipeline = useAppStore((s) => s.pipeline);

  const voyageApiKey = useAppStore((s) => s.voyageApiKey);
  const voyageModel = useAppStore((s) => s.voyageModel);
  const envKey = useAppStore((s) => s.envKeys.voyage);
  const embeddingsData = useAppStore((s) => s.embeddingsData);
  const isEmbedding = useAppStore((s) => s.isEmbedding);
  const embeddingError = useAppStore((s) => s.embeddingError);

  const setVoyageApiKey = useAppStore((s) => s.setVoyageApiKey);
  const setVoyageModel = useAppStore((s) => s.setVoyageModel);
  const setEmbeddingsData = useAppStore((s) => s.setEmbeddingsData);
  const setIsEmbedding = useAppStore((s) => s.setIsEmbedding);
  const setEmbeddingError = useAppStore((s) => s.setEmbeddingError);

  const [downloadingJson, setDownloadingJson] = useState(false);

  // Auto-fill env key
  useEffect(() => {
    if (!voyageApiKey && envKey) setVoyageApiKey(envKey);
  }, [voyageApiKey, envKey, setVoyageApiKey]);

  // Generate embeddings
  const handleGenerate = useCallback(async () => {
    if (!voyageApiKey || editedChunks.length === 0) return;
    setIsEmbedding(true);
    setEmbeddingError(null);
    setEmbeddingsData(null);

    try {
      const { generateEmbeddings } = await import("@/app/lib/voyage");
      const embeddings = await generateEmbeddings(
        voyageApiKey,
        voyageModel,
        editedChunks,
      );
      setEmbeddingsData(embeddings);
    } catch (err) {
      setEmbeddingError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsEmbedding(false);
    }
  }, [
    voyageApiKey, voyageModel, editedChunks,
    setIsEmbedding, setEmbeddingError, setEmbeddingsData,
  ]);

  // Download embeddings JSON
  const handleDownloadEmbeddings = useCallback(async () => {
    if (!embeddingsData) return;
    setDownloadingJson(true);
    try {
      const dims = embeddingsData[0]?.length ?? 0;
      const data: EmbeddingsJson = {
        metadata: {
          source_file: parsedFilename,
          pipeline,
          embedding_model: voyageModel,
          num_chunks: editedChunks.length,
          embedding_dimensions: dims,
        },
        chunks: editedChunks.map((text, i) => ({
          index: i,
          text,
          embedding: embeddingsData[i],
        })),
      };
      const stem = parsedFilename.replace(/\.[^.]+$/, "");
      const { downloadJson } = await import("@/app/lib/downloads");
      await downloadJson(data, `${stem}_embeddings.json`);
    } finally {
      setDownloadingJson(false);
    }
  }, [embeddingsData, editedChunks, parsedFilename, pipeline, voyageModel]);

  if (editedChunks.length === 0) return null;

  const modelInfo = VOYAGE_MODELS.find((m) => m.key === voyageModel);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-silver-light p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gunmetal">
        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-sandy text-white text-xs font-bold mr-2">
          5
        </span>
        Voyage AI Embeddings
      </h2>

      {/* API Key */}
      <div>
        <label className="block text-sm font-medium text-gunmetal mb-1">
          Voyage AI API Key
        </label>
        <input
          type="password"
          value={voyageApiKey}
          onChange={(e) => setVoyageApiKey(e.target.value)}
          placeholder="pa-..."
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
        />
      </div>

      {/* Model */}
      <div>
        <label className="block text-sm font-medium text-gunmetal mb-1">
          Embedding Model
        </label>
        <select
          value={voyageModel}
          onChange={(e) => setVoyageModel(e.target.value)}
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none appearance-none"
        >
          {VOYAGE_MODELS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label} — {m.description} ({m.dimensions}d)
            </option>
          ))}
        </select>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={!voyageApiKey || isEmbedding}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-sandy px-4 py-3 text-sm font-medium text-white hover:bg-sandy-light active:bg-sandy-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
      >
        {isEmbedding ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating embeddings with {modelInfo?.label ?? voyageModel}…
          </>
        ) : (
          <>Generate Embeddings</>
        )}
      </button>

      {/* Error */}
      {embeddingError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
          {embeddingError}
        </div>
      )}

      {/* Success + Downloads */}
      {embeddingsData && (
        <div className="space-y-3">
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
            Generated {embeddingsData.length} embeddings (
            {embeddingsData[0]?.length ?? 0} dimensions each).
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleDownloadEmbeddings}
              disabled={downloadingJson}
              className="flex items-center justify-center gap-2 rounded-lg bg-white border border-silver px-4 py-3 text-sm font-medium text-gunmetal hover:border-sandy hover:text-sandy transition-colors disabled:opacity-50 cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {downloadingJson ? "Preparing…" : "Download JSON"}
            </button>

            <DownloadScriptButton
              stage="embeddings"
              label="Download Script (.zip)"
            />
          </div>
        </div>
      )}
    </div>
  );
}
