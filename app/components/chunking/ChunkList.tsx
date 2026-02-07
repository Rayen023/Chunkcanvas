"use client";

import { useCallback } from "react";
import { useAppStore } from "@/app/lib/store";
import ChunkCard from "./ChunkCard";

export default function ChunkList() {
  const editedChunks = useAppStore((s) => s.editedChunks);
  const updateChunk = useAppStore((s) => s.updateChunk);
  const deleteChunk = useAppStore((s) => s.deleteChunk);
  const allChunksCollapsed = useAppStore((s) => s.allChunksCollapsed);
  const setAllChunksCollapsed = useAppStore((s) => s.setAllChunksCollapsed);

  const onUpdate = useCallback(
    (index: number, text: string) => updateChunk(index, text),
    [updateChunk],
  );

  const onDelete = useCallback(
    (index: number) => deleteChunk(index),
    [deleteChunk],
  );

  if (editedChunks.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gunmetal">Chunks</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAllChunksCollapsed(!allChunksCollapsed)}
            className="flex items-center gap-1.5 rounded-lg border border-silver-light px-3 py-1.5 text-xs font-medium text-gunmetal-light hover:border-sandy hover:text-sandy transition-colors cursor-pointer"
          >
            {allChunksCollapsed ? (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                Expand All
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                </svg>
                Collapse All
              </>
            )}
          </button>
          <span className="text-sm text-gunmetal-light">
            <strong>{editedChunks.length}</strong> chunks
          </span>
        </div>
      </div>

      {/* Auto-save notice */}
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
        Edits are <strong>auto-saved</strong> — just type in any chunk below and
        your changes are kept automatically. No need to press save.
      </div>

      <div className="space-y-3">
        {editedChunks.map((text, i) => (
          <ChunkCard
            key={`chunk-${i}`}
            index={i}
            text={text}
            onUpdate={onUpdate}
            onDelete={onDelete}
            forceCollapsed={allChunksCollapsed}
          />
        ))}
      </div>
    </div>
  );
}
