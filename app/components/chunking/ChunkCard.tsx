"use client";

import { useState, useCallback, useEffect, memo } from "react";

interface Props {
  index: number;
  text: string;
  onUpdate: (index: number, text: string) => void;
  onDelete: (index: number) => void;
  forceCollapsed?: boolean;
}

function ChunkCard({ index, text, onUpdate, onDelete, forceCollapsed }: Props) {
  const [localExpanded, setLocalExpanded] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [prevText, setPrevText] = useState(text);

  // Sync local expanded state when the global toggle changes
  useEffect(() => {
    if (forceCollapsed !== undefined) {
      setLocalExpanded(!forceCollapsed);
    }
  }, [forceCollapsed]);

  const expanded = localExpanded;

  // Reset confirmation if text changes (e.g. reused component for next chunk after delete)
  if (text !== prevText) {
    setPrevText(text);
    setIsConfirming(false);
  }

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onUpdate(index, e.target.value);
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
    <div className="rounded-xl border border-silver-light bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div
        onClick={() => setLocalExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 cursor-pointer hover:bg-silver-light/30 transition-colors select-none"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gunmetal">
            📑 Chunk {index + 1}
          </span>
          
          {isConfirming ? (
             <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs font-medium text-red-600">Sure?</span>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="rounded-md bg-red-600 px-2 py-1 text-xs font-bold text-white hover:bg-red-700 transition-colors cursor-pointer shadow-sm"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={handleCancelDelete}
                  className="rounded-md bg-silver-light px-2 py-1 text-xs font-medium text-gunmetal hover:bg-silver transition-colors cursor-pointer shadow-sm"
                >
                  No
                </button>
             </div>
          ) : (
            <button
              type="button"
              onClick={handleDeleteClick}
              className="group flex items-center rounded-lg p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 transition-all cursor-pointer"
              title="Delete chunk"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              <span className="max-w-0 overflow-hidden opacity-0 whitespace-nowrap text-xs font-medium group-hover:max-w-[100px] group-hover:ml-1 group-hover:opacity-100 transition-all duration-300">
                Delete chunk
              </span>
            </button>
          )}
        </div>
        <svg
          className={`h-4 w-4 text-silver-dark transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>

      {/* Content */}
      {expanded && (
        <div className="px-4 pb-4">
          <textarea
            value={text}
            onChange={handleChange}
            rows={10}
            className="w-full rounded-lg border border-silver px-3 py-2 text-sm font-mono text-gunmetal-light focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none resize-y"
          />
        </div>
      )}
    </div>
  );
}

export default memo(ChunkCard);
