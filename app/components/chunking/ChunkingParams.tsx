"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/app/lib/store";
import {
  DEFAULT_SEPARATORS,
  DEFAULT_SEPARATOR_LABELS,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CHUNK_OVERLAP,
} from "@/app/lib/constants";

/** All known separators the user can toggle on/off */
const ALL_SEPARATORS = DEFAULT_SEPARATORS;

export default function ChunkingParams() {
  const chunkingParams = useAppStore((s) => s.chunkingParams);
  const setChunkingParams = useAppStore((s) => s.setChunkingParams);
  const resetChunkingDefaults = useAppStore((s) => s.resetChunkingDefaults);
  const [showCustom, setShowCustom] = useState(false);
  const [customSep, setCustomSep] = useState("");

  /** Whether current params differ from defaults */
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

  /** Toggle a separator on/off */
  const toggleSep = (sep: string) => {
    const next = activeSeps.has(sep)
      ? chunkingParams.separators.filter((s) => s !== sep)
      : [...chunkingParams.separators, sep];
    setChunkingParams({ separators: next });
  };

  /** Add a custom separator */
  const addCustom = () => {
    const sep = customSep
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t");
    if (!sep || activeSeps.has(sep)) return;
    setChunkingParams({ separators: [...chunkingParams.separators, sep] });
    setCustomSep("");
    setShowCustom(false);
  };

  /** Remove a custom (non-default) separator */
  const removeCustomSep = (sep: string) => {
    setChunkingParams({
      separators: chunkingParams.separators.filter((s) => s !== sep),
    });
  };

  /** Human-readable label for a separator */
  const label = (sep: string): string =>
    DEFAULT_SEPARATOR_LABELS[sep] ??
    JSON.stringify(sep).slice(1, -1); // fallback: escaped string

  // Custom separators that aren't in the default list
  const extraSeps = chunkingParams.separators.filter(
    (s) => !ALL_SEPARATORS.includes(s),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gunmetal">
          Chunking Parameters
        </h3>
        {isModified && (
          <button
            type="button"
            onClick={resetChunkingDefaults}
            className="flex items-center gap-1 rounded-md border border-silver-light px-2 py-1 text-[11px] font-medium text-silver-dark hover:border-sandy hover:text-sandy transition-colors cursor-pointer"
            title="Reset chunking parameters to defaults"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Defaults
          </button>
        )}
      </div>

      {/* Separators — tag cloud */}
      <div>
        <label className="block text-xs font-medium text-gunmetal-light mb-2">
          Separators
          <span className="ml-1.5 text-[10px] text-silver-dark font-normal">
            (ordered coarsest → finest; click to toggle)
          </span>
        </label>

        <div className="flex flex-wrap gap-1.5">
          {ALL_SEPARATORS.map((sep) => {
            const active = activeSeps.has(sep);
            return (
              <button
                key={sep}
                type="button"
                onClick={() => toggleSep(sep)}
                className={`
                  inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer select-none
                  ${active
                    ? "border-sandy bg-sandy/10 text-sandy-dark"
                    : "border-silver-light bg-white text-silver-dark line-through opacity-60 hover:opacity-80"
                  }
                `}
                title={active ? `Click to remove "${label(sep)}"` : `Click to add "${label(sep)}"`}
              >
                {label(sep)}
              </button>
            );
          })}

          {/* Extra custom separators */}
          {extraSeps.map((sep) => (
            <span
              key={sep}
              className="inline-flex items-center gap-1 rounded-md border border-sandy bg-sandy/10 px-2.5 py-1 text-[11px] font-medium text-sandy-dark"
            >
              {label(sep)}
              <button
                type="button"
                onClick={() => removeCustomSep(sep)}
                className="ml-0.5 hover:text-red-500 transition-colors cursor-pointer"
                title="Remove custom separator"
              >
                &times;
              </button>
            </span>
          ))}

          {/* Add custom separator */}
          {showCustom ? (
            <span className="inline-flex items-center gap-1">
              <input
                type="text"
                value={customSep}
                onChange={(e) => setCustomSep(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustom()}
                placeholder="e.g. \\n\\n or |"
                className="w-28 rounded-md border border-silver px-2 py-1 text-[11px] focus:ring-1 focus:ring-sandy/50 focus:border-sandy outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={addCustom}
                className="rounded-md bg-sandy px-2 py-1 text-[11px] font-medium text-white hover:bg-sandy-light transition-colors cursor-pointer"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setShowCustom(false); setCustomSep(""); }}
                className="text-silver-dark hover:text-gunmetal transition-colors text-xs cursor-pointer"
              >
                &times;
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              className="inline-flex items-center rounded-md border border-dashed border-silver px-2.5 py-1 text-[11px] text-silver-dark hover:border-sandy hover:text-sandy transition-colors cursor-pointer"
            >
              + Custom
            </button>
          )}
        </div>

        <p className="mt-2 text-[10px] text-silver-dark leading-relaxed">
          The splitter tries separators left-to-right, keeping paragraphs and tables intact when possible.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Chunk size */}
        <div>
          <label className="block text-xs font-medium text-gunmetal-light mb-1">
            Chunk size (characters)
          </label>
          <input
            type="number"
            value={chunkingParams.chunkSize}
            step={128}
            min={128}
            onChange={(e) =>
              setChunkingParams({ chunkSize: Number(e.target.value) })
            }
            className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
          />
        </div>

        {/* Chunk overlap */}
        <div>
          <label className="block text-xs font-medium text-gunmetal-light mb-1">
            Chunk overlap
          </label>
          <input
            type="number"
            value={chunkingParams.chunkOverlap}
            step={5}
            min={0}
            onChange={(e) =>
              setChunkingParams({ chunkOverlap: Number(e.target.value) })
            }
            className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
          />
        </div>
      </div>
    </div>
  );
}
