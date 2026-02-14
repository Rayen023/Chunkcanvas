"use client";

import { useState, useCallback, memo, useMemo, useEffect, useRef } from "react";
import { countTokens } from "@/app/lib/tokenizer";

interface Props {
  index: number;
  text: string;
  sourceFile?: string;
  onUpdate: (index: number, text: string) => void;
  onDelete: (index: number) => void;
  forceCollapsed?: boolean;
  isLightMode?: boolean;
}

function ChunkCard({ index, text, sourceFile, onUpdate, onDelete, forceCollapsed, isLightMode }: Props) {
  const [localExpanded, setLocalExpanded] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // Hide the "Saved" indicator after 2 seconds
  useEffect(() => {
    if (showSaved) {
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showSaved]);

  // Sync local expanded state when the global toggle changes
  useEffect(() => {
    if (forceCollapsed === undefined) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalExpanded(!forceCollapsed);
  }, [forceCollapsed]);

  const expanded = localExpanded;

  const tokenCount = useMemo(() => {
    return countTokens(text);
  }, [text]);

  // Reset confirmation if text changes (e.g. reused component for next chunk after delete)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsConfirming(false);
  }, [text]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (!expanded) return;
    const el = textareaRef.current;
    if (!el) return;
    
    // Reset height to auto to get correct scrollHeight for shrinking content
    el.style.height = "auto";
    const newHeight = Math.min(Math.max(el.scrollHeight + 2, 80), 400);
    el.style.height = `${newHeight}px`;
  }, [text, expanded]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onUpdate(index, e.target.value);
      setShowSaved(true);
    },
    [index, onUpdate],
  );

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!text || text.trim() === "") {
      onDelete(index);
    } else {
      setIsConfirming(true);
    }
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(index);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfirming(false);
  };

  return (
    <div
      className={`rounded-xl border border-silver-light shadow-sm overflow-hidden ${
        isLightMode ? "!bg-[#fbfbfb]" : "dark:!bg-card"
      }`}
    >
      {/* Header */}
      <div
        onClick={() => setLocalExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 cursor-pointer hover:bg-silver-light/30 transition-colors"
      >
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
            <span className="text-sm font-medium text-gunmetal whitespace-nowrap">Chunk {index + 1}</span>

            {sourceFile && (
              <span
                className="text-[10px] text-sandy-dark bg-sandy/10 px-2 py-0.5 rounded-full font-mono truncate max-w-[120px] sm:max-w-[180px]"
                title={sourceFile}
              >
                {sourceFile}
              </span>
            )}

            <span className="text-[11px] text-silver-dark bg-silver-light/50 px-2 py-0.5 rounded-full whitespace-nowrap">
              {tokenCount.toLocaleString()} tokens
            </span>

            <span
              className={
                "inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 transition-opacity " +
                (showSaved ? "opacity-100" : "opacity-0")
              }
              aria-hidden={!showSaved}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="hidden sm:inline">Saved</span>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            {isConfirming ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-red-600">Delete?</span>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-red-700 transition-colors cursor-pointer shadow-sm"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={handleCancelDelete}
                  className="rounded-md bg-silver-light px-2 py-1 text-[11px] font-medium text-gunmetal hover:bg-silver transition-colors cursor-pointer shadow-sm"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDeleteClick}
                className="flex items-center rounded-lg p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 transition-all cursor-pointer"
                title="Delete chunk"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}

            <button
              type="button"
              onClick={() => setLocalExpanded((v) => !v)}
              className="rounded-lg p-1.5 text-silver-dark hover:bg-silver-light/40 transition-colors cursor-pointer"
              title={expanded ? "Collapse" : "Expand"}
            >
              <svg
                className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="px-3 pb-3">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            style={{ minHeight: "80px", maxHeight: "400px" }}
            className={`w-full rounded-lg border border-silver px-3 py-2 text-sm font-mono text-gunmetal-light focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none resize-y overflow-y-auto ${
              isLightMode ? "!bg-[#fbfbfb]" : "dark:!bg-black/20"
            }`}
          />
        </div>
      )}

      {!expanded && (
        <div className="px-3 pb-2 text-xs font-mono text-silver-dark whitespace-pre-wrap">
          <div className="max-h-12 overflow-hidden">
            {text.length > 260 ? `${text.slice(0, 260)}…` : text}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ChunkCard);
