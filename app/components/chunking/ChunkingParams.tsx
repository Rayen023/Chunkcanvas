"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/app/lib/store";
import {
  DEFAULT_SEPARATORS,
  ALL_AVAILABLE_SEPARATORS,
  DEFAULT_SEPARATOR_LABELS,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CHUNK_OVERLAP,
} from "@/app/lib/constants";
import { ChunkingParams as ChunkingParamsType } from "@/app/lib/types";

const ALL_SEPARATORS = ALL_AVAILABLE_SEPARATORS;

export default function ChunkingParams() {
  const chunkingParams = useAppStore((s) => s.chunkingParams);
  const setChunkingParams = useAppStore((s) => s.setChunkingParams);
  const resetChunkingDefaults = useAppStore((s) => s.resetChunkingDefaults);
  const editedChunks = useAppStore((s) => s.editedChunks);
  const parsedContent = useAppStore((s) => s.parsedContent);
  const parsedResults = useAppStore((s) => s.parsedResults);
  const [showCustom, setShowCustom] = useState(false);
  const [customSep, setCustomSep] = useState("");
  const [draggedSep, setDraggedSep] = useState<string | null>(null);

  useEffect(() => {
    const clear = () => setDraggedSep(null);
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
    return () => {
      window.removeEventListener("dragend", clear);
      window.removeEventListener("drop", clear);
    };
  }, []);

  const maxContentLength = useMemo(() => {
    let max = parsedContent ? parsedContent.length : 0;
    if (parsedResults && parsedResults.length > 0) {
      for (const res of parsedResults) {
        if (res.content && res.content.length > max) {
          max = res.content.length;
        }
      }
    }
    return max > 0 ? max : 8192;
  }, [parsedContent, parsedResults]);

  const isModified = useMemo(() => {
    if (chunkingParams.chunkSize !== DEFAULT_CHUNK_SIZE) return true;
    if (chunkingParams.chunkOverlap !== DEFAULT_CHUNK_OVERLAP) return true;
    if (chunkingParams.separators.length !== DEFAULT_SEPARATORS.length) return true;
    return chunkingParams.separators.some((s, i) => s !== DEFAULT_SEPARATORS[i]);
  }, [chunkingParams]);

  const activeSeps = useMemo(
    () => new Set(chunkingParams.separators),
    [chunkingParams.separators],
  );

  const handleChunkSizeChange = (size: number) => {
    const nextSize = Math.max(128, size);
    const updates: Partial<ChunkingParamsType> = { chunkSize: nextSize };
    
    if (chunkingParams.chunkOverlap >= nextSize) {
      updates.chunkOverlap = Math.floor(nextSize / 2);
    }
    
    setChunkingParams(updates);
  };

  const toggleSep = (sep: string) => {
    const next = activeSeps.has(sep)
      ? chunkingParams.separators.filter((s) => s !== sep)
      : [...chunkingParams.separators, sep];
    setChunkingParams({ separators: next });
  };

  const addCustom = () => {
    const sep = customSep
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t");
    if (!sep || activeSeps.has(sep)) return;
    setChunkingParams({ separators: [...chunkingParams.separators, sep] });
    setCustomSep("");
    setShowCustom(false);
  };

  const handleDragStart = (e: React.DragEvent, sep: string) => {
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", sep);
    } catch {
      // no-op
    }
    setDraggedSep(sep);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (!draggedSep) return;
    
    const newSeps = [...chunkingParams.separators];
    const fromIndex = newSeps.indexOf(draggedSep);
    if (fromIndex === -1 || fromIndex === index) return;
    newSeps.splice(fromIndex, 1);
    newSeps.splice(index, 0, draggedSep);
    
    setChunkingParams({ separators: newSeps });
  };

  const handleDragEnd = () => {
    setDraggedSep(null);
  };

  const label = (sep: string): string =>
    DEFAULT_SEPARATOR_LABELS[sep] ??
    JSON.stringify(sep).slice(1, -1); // fallback: escaped string

  return (
    <div
      className="space-y-3 rounded-lg border border-sandy p-3"
    >
      {/* Strategy + Defaults */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-silver-light/20 p-1.5 shrink-0">
            <Image src="/tech-icons/langchain-color.svg" alt="LangChain" width={32} height={32} className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <div className="text-sm sm:text-base font-bold text-gunmetal leading-tight">
              Recursive character text splitter (Langchain)
            </div>
          </div>
        </div>

        {isModified && (
          <button
            type="button"
            onClick={resetChunkingDefaults}
            className="flex items-center gap-1.5 rounded-lg border border-sandy bg-sandy/10 px-2.5 py-1 text-[10px] sm:text-xs font-medium text-sandy hover:bg-sandy hover:text-white transition-colors cursor-pointer shrink-0"
            title="Reset chunking parameters to defaults"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">Defaults</span>
            <span className="sm:hidden">Reset</span>
          </button>
        )}
      </div>

      <div className="space-y-3">
        {/* Tuning */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Chunk size */}
          <div className="rounded-lg border border-silver-light bg-card p-3 space-y-2 hover:border-sandy focus-within:border-sandy transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-sm font-semibold text-gunmetal">Chunk size (characters)</label>
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => handleChunkSizeChange(chunkingParams.chunkSize - 128)}
                  className="rounded-md border border-silver-light px-2 py-1 text-xs font-semibold text-gunmetal-light hover:border-sandy hover:text-sandy transition-colors cursor-pointer"
                  title="-128"
                >
                  −
                </button>

                <div className="flex items-center rounded-md border border-silver bg-card px-2 py-1">
                  <input
                    type="number"
                    min={128}
                    step={128}
                    value={chunkingParams.chunkSize}
                    onChange={(e) => handleChunkSizeChange(Number(e.target.value))}
                    className="w-14 sm:w-16 bg-transparent text-right text-sm font-mono font-semibold text-sandy tabular-nums outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="ml-1 text-[11px] font-medium text-silver-dark">chars</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleChunkSizeChange(chunkingParams.chunkSize + 128)}
                  className="rounded-md border border-silver-light px-2 py-1 text-xs font-semibold text-gunmetal-light hover:border-sandy hover:text-sandy transition-colors cursor-pointer"
                  title="+128"
                >
                  +
                </button>

                <button
                  type="button"
                  onClick={() => handleChunkSizeChange(Math.max(128, maxContentLength))}
                  className="rounded-md border border-silver-light px-2 py-1 text-xs font-semibold text-gunmetal-light hover:border-sandy hover:text-sandy transition-colors cursor-pointer"
                  title="Set chunk size to the maximum content length"
                >
                  Max
                </button>
              </div>
            </div>
            {/* ... slider ... */}
          </div>

          {/* Overlap */}
          <div className="rounded-lg border border-silver-light bg-card p-3 space-y-2 hover:border-sandy focus-within:border-sandy transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-sm font-semibold text-gunmetal">Overlap (characters)</label>
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setChunkingParams({ chunkOverlap: Math.max(0, chunkingParams.chunkOverlap - 10) })}
                  className="rounded-md border border-silver-light px-2 py-1 text-xs font-semibold text-gunmetal-light hover:border-sandy hover:text-sandy transition-colors cursor-pointer"
                  title="-10"
                >
                  −
                </button>

                <div className="flex items-center rounded-md border border-silver bg-card px-2 py-1">
                  <input
                    type="number"
                    min={0}
                    max={chunkingParams.chunkSize - 1}
                    step={10}
                    value={chunkingParams.chunkOverlap}
                    onChange={(e) =>
                      setChunkingParams({
                        chunkOverlap: Math.max(
                          0,
                          Math.min(Number(e.target.value), Math.max(0, chunkingParams.chunkSize - 1)),
                        ),
                      })
                    }
                    className="w-14 sm:w-16 bg-transparent text-right text-sm font-mono font-semibold text-sandy tabular-nums outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="ml-1 text-[11px] font-medium text-silver-dark">chars</span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setChunkingParams({
                      chunkOverlap: Math.min(chunkingParams.chunkOverlap + 10, Math.max(0, chunkingParams.chunkSize - 1)),
                    })
                  }
                  className="rounded-md border border-silver-light px-2 py-1 text-xs font-semibold text-gunmetal-light hover:border-sandy hover:text-sandy transition-colors cursor-pointer"
                  title="+10"
                >
                  +
                </button>

                <button
                  type="button"
                  onClick={() => setChunkingParams({ chunkOverlap: Math.max(0, chunkingParams.chunkSize - 1) })}
                  className="rounded-md border border-silver-light px-2 py-1 text-xs font-semibold text-gunmetal-light hover:border-sandy hover:text-sandy transition-colors cursor-pointer"
                  title="Set overlap to the maximum allowed"
                >
                  Max
                </button>
              </div>
            </div>
            {/* ... slider ... */}
          </div>
        </div>

        {/* Separators */}
        <div className="rounded-lg border border-silver-light bg-card p-3 space-y-2 hover:border-sandy focus-within:border-sandy transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gunmetal">Separators</div>
              <div className="text-xs text-silver-dark">
                Click to toggle. Drag active ones to reorder (left → right priority).
              </div>
            </div>

            {!showCustom && (
              <button
                type="button"
                onClick={() => setShowCustom(true)}
                className="inline-flex items-center rounded-md border border-dashed border-silver px-2.5 py-1 text-xs text-silver-dark hover:border-sandy hover:text-sandy transition-colors cursor-pointer shrink-0"
              >
                + Custom
              </button>
            )}
          </div>
          {showCustom && (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={customSep}
                onChange={(e) => setCustomSep(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustom()}
                placeholder="e.g. \\n\\n or |"
                className="flex-1 min-w-0 rounded-md border border-silver px-2 py-1 text-xs focus:ring-1 focus:ring-sandy/50 focus:border-sandy outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={addCustom}
                className="rounded-md bg-sandy px-2.5 py-1 text-xs font-medium text-white hover:bg-sandy-light transition-colors cursor-pointer"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCustom(false);
                  setCustomSep("");
                }}
                className="rounded-md border border-silver-light px-2 py-1 text-xs font-medium text-silver-dark hover:border-sandy hover:text-sandy transition-colors cursor-pointer"
                title="Cancel"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {/* Active / Draggable Separators */}
            {chunkingParams.separators.map((sep, idx) => (
              <button
                key={`active-${sep}-${idx}`}
                type="button"
                draggable
                onDragStart={(e) => handleDragStart(e, sep)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => setDraggedSep(null)}
                onDragEnd={handleDragEnd}
                onClick={() => toggleSep(sep)}
                className={
                  "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-all border-sandy bg-sandy/10 text-sandy-dark hover:bg-sandy/20 cursor-grab active:cursor-grabbing " +
                  (draggedSep === sep ? "opacity-40" : "")
                }
                title={`Drag to reorder; click to remove "${label(sep)}"`}
              >
                {label(sep)}
              </button>
            ))}

            {/* Inactive Separators */}
            {ALL_SEPARATORS.filter((s) => !activeSeps.has(s)).map((sep) => (
              <button
                key={`inactive-${sep}`}
                type="button"
                onClick={() => toggleSep(sep)}
                className="inline-flex items-center rounded-md border border-silver-light bg-card px-2.5 py-1 text-xs font-medium text-silver-dark opacity-60 hover:opacity-100 transition-all cursor-pointer hover:border-sandy"
                title={`Click to add "${label(sep)}"`}
              >
                {label(sep)}
              </button>
            ))}
          </div>

          {editedChunks.length > 0 && (
            <div className="text-xs text-silver-dark">
              Note: changing these parameters regenerates chunks and may overwrite any manual edits in the preview.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
