"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useAppStore } from "@/app/lib/store";
import { useTheme } from "next-themes";
import ChunkCard from "./ChunkCard";
import { countTokens } from "@/app/lib/tokenizer";

export default function ChunkList({
  variant = "standalone",
  pending = false,
}: {
  variant?: "standalone" | "panel";
  pending?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const editedChunks = useAppStore((s) => s.editedChunks);
  const isChunking = useAppStore((s) => s.isChunking);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const chunkSourceFiles = useAppStore((s) => s.chunkSourceFiles);
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

  const totalTokens = useMemo(() => {
    return editedChunks.reduce((acc, chunk) => acc + countTokens(chunk), 0);
  }, [editedChunks]);

  if (editedChunks.length === 0) return null;

  const compact = variant === "panel";

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      <div
        className={
          compact
            ? "sticky top-0 z-10 py-2 bg-card/95 backdrop-blur border-b border-silver-light flex items-center justify-between gap-3"
            : "flex items-center justify-between gap-4"
        }
      >
        <div className="flex items-center gap-3 min-w-0">
          <h2 className={compact ? "text-sm font-semibold text-gunmetal whitespace-nowrap" : "text-lg font-semibold text-gunmetal whitespace-nowrap"}>
            Chunks
          </h2>
          <div className="flex items-center gap-2 text-xs text-silver-dark border-l border-silver-light/60 pl-3 min-w-0">
            <span className="h-1 w-1 rounded-full bg-sandy shrink-0" />
            <span className="truncate">Auto-save on edit</span>
          </div>
          {(isChunking || pending) && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-silver-dark">
              {isChunking ? (
                <>
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Updating
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1" aria-hidden>
                    <span className="h-1.5 w-1.5 rounded-full bg-sandy animate-pulse" />
                    <span className="h-1.5 w-1.5 rounded-full bg-sandy/70 animate-pulse [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-sandy/50 animate-pulse [animation-delay:300ms]" />
                  </span>
                  Applying…
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setAllChunksCollapsed(!allChunksCollapsed)}
            className={
              compact
                ? "flex items-center gap-1.5 rounded-lg border border-silver-light px-2.5 py-1 text-[11px] font-medium text-gunmetal-light hover:border-sandy hover:text-sandy transition-colors cursor-pointer"
                : "flex items-center gap-1.5 rounded-lg border border-silver-light px-3 py-1.5 text-xs font-medium text-gunmetal-light hover:border-sandy hover:text-sandy transition-colors cursor-pointer"
            }
          >
            {allChunksCollapsed ? (
              <>
                <svg className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                <span className="hidden sm:inline">Expand</span>
                <span className="sm:hidden">All</span>
              </>
            ) : (
              <>
                <svg className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                </svg>
                <span className="hidden sm:inline">Collapse</span>
                <span className="sm:hidden">All</span>
              </>
            )}
          </button>

          <span className={compact ? "text-[10px] sm:text-[11px] text-gunmetal-light whitespace-nowrap" : "text-xs sm:text-sm text-gunmetal-light whitespace-nowrap"}>
            <strong>{editedChunks.length}</strong>
            <span className="ml-1 text-silver-dark hidden sm:inline">chunks</span>
            <span className="mx-1 text-silver">•</span>
            <strong>{totalTokens.toLocaleString()}</strong>
            <span className="ml-1 text-silver-dark hidden sm:inline">tokens</span>
          </span>
        </div>
      </div>

      <div className={compact ? "space-y-1.5" : "space-y-2"}>
        {editedChunks.map((text, i) => (
          <ChunkCard
            key={`chunk-${i}`}
            index={i}
            text={text}
            sourceFile={chunkSourceFiles[i]}
            onUpdate={onUpdate}
            onDelete={onDelete}
            forceCollapsed={allChunksCollapsed}
            isLightMode={mounted && resolvedTheme === "light"}
          />
        ))}
      </div>
    </div>
  );
}
