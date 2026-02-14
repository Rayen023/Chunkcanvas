"use client";

import { useMemo, useEffect, useState } from "react";
import { PIPELINE, PIPELINE_ALLOWED_EXTENSIONS } from "@/app/lib/constants";
import { useAppStore } from "@/app/lib/store";
import OpenRouterForm from "../pipeline-forms/OpenRouterForm";
import OllamaForm from "../pipeline-forms/OllamaForm";
import VllmForm from "../pipeline-forms/VllmForm";
import DoclingForm from "../pipeline-forms/DoclingForm";
import ExcelForm from "../pipeline-forms/ExcelForm";
import {
  ProviderSelector,
  ConfigContainer,
  ConfigHeader,
  ProviderOption,
} from "@/app/components/shared/ConfigSection";
import StatusMessage from "@/app/components/shared/StatusMessage";
import { useIsLocalMode, LOCAL_PIPELINE_IDS } from "@/app/lib/local-mode";

const ALL_PIPELINES = Object.values(PIPELINE);

/** Whether a pipeline requires an API key */
const PIPELINE_NEEDS_KEY: Record<string, boolean> = {
  [PIPELINE.SIMPLE_TEXT]: false,
  [PIPELINE.EXCEL_SPREADSHEET]: false,
  [PIPELINE.CSV_SPREADSHEET]: false,
  [PIPELINE.OPENROUTER_PDF]: true,
  [PIPELINE.OPENROUTER_IMAGE]: true,
  [PIPELINE.OPENROUTER_AUDIO]: true,
  [PIPELINE.OPENROUTER_VIDEO]: true,
  [PIPELINE.OLLAMA_PDF]: false,
  [PIPELINE.OLLAMA_IMAGE]: false,
  [PIPELINE.VLLM_PDF]: false,
  [PIPELINE.VLLM_IMAGE]: false,
  [PIPELINE.VLLM_AUDIO]: false,
  [PIPELINE.VLLM_VIDEO]: false,
  [PIPELINE.DOCLING_PDF]: false,
};

const PIPELINE_META: Record<string, Omit<ProviderOption, "id" | "label">> = {
  [PIPELINE.SIMPLE_TEXT]: {
    badge: "Local",
    icon: "/tech-icons/pdf-mammoth.svg",
    requiresApiKey: false,
  },
  [PIPELINE.EXCEL_SPREADSHEET]: {
    badge: "Local",
    icon: "/tech-icons/xlsx.svg",
    requiresApiKey: false,
  },
  [PIPELINE.CSV_SPREADSHEET]: {
    badge: "Local",
    icon: "/tech-icons/csv.svg",
    requiresApiKey: false,
  },
  [PIPELINE.OPENROUTER_PDF]: {
    badge: "Cloud",
    icon: "/tech-icons/openrouter.svg",
    requiresApiKey: true,
  },
  [PIPELINE.OPENROUTER_IMAGE]: {
    badge: "Cloud",
    icon: "/tech-icons/openrouter.svg",
    requiresApiKey: true,
  },
  [PIPELINE.OPENROUTER_AUDIO]: {
    badge: "Cloud",
    icon: "/tech-icons/openrouter.svg",
    requiresApiKey: true,
  },
  [PIPELINE.OPENROUTER_VIDEO]: {
    badge: "Cloud",
    icon: "/tech-icons/openrouter.svg",
    requiresApiKey: true,
  },
  [PIPELINE.OLLAMA_PDF]: {
    badge: "Local",
    icon: "/tech-icons/ollama.svg",
    requiresApiKey: false,
  },
  [PIPELINE.OLLAMA_IMAGE]: {
    badge: "Local",
    icon: "/tech-icons/ollama.svg",
    requiresApiKey: false,
  },
  [PIPELINE.VLLM_PDF]: {
    badge: "Local",
    icon: "/tech-icons/vllm-color.svg",
    requiresApiKey: false,
  },
  [PIPELINE.VLLM_IMAGE]: {
    badge: "Local",
    icon: "/tech-icons/vllm-color.svg",
    requiresApiKey: false,
  },
  [PIPELINE.VLLM_AUDIO]: {
    badge: "Local",
    icon: "/tech-icons/vllm-color.svg",
    requiresApiKey: false,
  },
  [PIPELINE.VLLM_VIDEO]: {
    badge: "Local",
    icon: "/tech-icons/vllm-color.svg",
    requiresApiKey: false,
  },
  [PIPELINE.DOCLING_PDF]: {
    badge: "Local",
    icon: "/tech-icons/docling.svg",
    requiresApiKey: false,
  },
};

const PIPELINE_LABELS: Record<string, string> = {
  [PIPELINE.SIMPLE_TEXT]: "PDF.js",
  [PIPELINE.EXCEL_SPREADSHEET]: "XLSX",
  [PIPELINE.CSV_SPREADSHEET]: "CSV Parser",
  [PIPELINE.OPENROUTER_PDF]: "OpenRouter",
  [PIPELINE.OPENROUTER_IMAGE]: "OpenRouter",
  [PIPELINE.OPENROUTER_AUDIO]: "OpenRouter",
  [PIPELINE.OPENROUTER_VIDEO]: "OpenRouter",
  [PIPELINE.OLLAMA_PDF]: "Ollama",
  [PIPELINE.OLLAMA_IMAGE]: "Ollama",
  [PIPELINE.VLLM_PDF]: "vLLM",
  [PIPELINE.VLLM_IMAGE]: "vLLM",
  [PIPELINE.VLLM_AUDIO]: "vLLM",
  [PIPELINE.VLLM_VIDEO]: "vLLM",
  [PIPELINE.DOCLING_PDF]: "Docling",
};

export default function PipelineSelector() {
  const files = useAppStore((s) => s.files);
  const setFiles = useAppStore((s) => s.setFiles);
  const removeFile = useAppStore((s) => s.removeFile);
  const pipelinesByExt = useAppStore((s) => s.pipelinesByExt);
  const setPipelineForExt = useAppStore((s) => s.setPipelineForExt);
  const lastPipelineByExt = useAppStore((s) => s.lastPipelineByExt);
  const isLocal = useIsLocalMode();

  /** Pipeline IDs disabled in cloud mode (remote access) */
  const disabledPipelineIds = useMemo(
    () => (isLocal ? undefined : LOCAL_PIPELINE_IDS),
    [isLocal],
  );

  // Auto-deselect local pipelines when in cloud mode
  useEffect(() => {
    if (isLocal) return;
    for (const [ext, selected] of Object.entries(pipelinesByExt)) {
      if (selected && LOCAL_PIPELINE_IDS.has(selected)) {
        setPipelineForExt(ext, "");
      }
    }
  }, [isLocal, pipelinesByExt, setPipelineForExt]);

  /** Group files by extension */
  const extGroups = useMemo(() => {
    const groups: Record<string, File[]> = {};
    for (const f of files) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!groups[ext]) groups[ext] = [];
      groups[ext].push(f);
    }
    return groups;
  }, [files]);

  /** For each extension, compute the list of compatible pipelines */
  const extPipelines = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const ext of Object.keys(extGroups)) {
      result[ext] = ALL_PIPELINES.filter(
        (p) => PIPELINE_ALLOWED_EXTENSIONS[p]?.has(ext) ?? false,
      );
    }
    return result;
  }, [extGroups]);

  const extKeys = Object.keys(extGroups);

  // Track which file lists are expanded (for groups with many files)
  const [expandedExts, setExpandedExts] = useState<Set<string>>(new Set());
  const toggleExpand = (ext: string) =>
    setExpandedExts((prev) => {
      const next = new Set(prev);
      if (next.has(ext)) {
        next.delete(ext);
      } else {
        next.add(ext);
      }
      return next;
    });

  /** Pipelines that have a real configuration form */
  const HAS_CONFIG: Set<string> = new Set([
    PIPELINE.OPENROUTER_PDF, PIPELINE.OPENROUTER_IMAGE, PIPELINE.OPENROUTER_AUDIO, PIPELINE.OPENROUTER_VIDEO,
    PIPELINE.OLLAMA_PDF, PIPELINE.OLLAMA_IMAGE,
    PIPELINE.VLLM_PDF, PIPELINE.VLLM_IMAGE, PIPELINE.VLLM_AUDIO, PIPELINE.VLLM_VIDEO,
    PIPELINE.DOCLING_PDF,
    PIPELINE.EXCEL_SPREADSHEET, PIPELINE.CSV_SPREADSHEET,
  ]);

  // Auto-select: single compatible pipeline, or restore last-used if compatible
  useEffect(() => {
    for (const [ext, pipelines] of Object.entries(extPipelines)) {
      // Skip if already selected
      if (pipelinesByExt[ext]) continue;
      if (pipelines.length === 1) {
        setPipelineForExt(ext, pipelines[0]);
      } else if (pipelines.length > 1 && lastPipelineByExt[ext] && pipelines.includes(lastPipelineByExt[ext])) {
        // Restore last-used pipeline if it's still compatible
        setPipelineForExt(ext, lastPipelineByExt[ext]);
      }
    }
  }, [extPipelines, pipelinesByExt, setPipelineForExt, lastPipelineByExt]);

  // Clear invalid selections (e.g. after removing files)
  useEffect(() => {
    for (const [ext, selected] of Object.entries(pipelinesByExt)) {
      if (
        selected &&
        extPipelines[ext] &&
        !extPipelines[ext].includes(selected)
      ) {
        setPipelineForExt(ext, "");
      }
    }
  }, [extPipelines, pipelinesByExt, setPipelineForExt]);

  /** Find the global index of a File object inside the store's files array */
  const getGlobalIndex = (file: File) => files.indexOf(file);

  return (
    <div className="space-y-4">
      {/* ── Cloud-mode banner ──────────────────────────── */}
      {!isLocal && (
        <div className="rounded-lg border border-sandy/30 bg-sandy/5 px-4 py-3 text-xs text-gunmetal dark:text-white/80 space-y-1">
          <div className="flex items-center gap-2 font-semibold text-sandy">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
            Cloud Mode
          </div>
          <p>Local providers (Ollama, vLLM, Docling) require self-hosting.
            <a href="https://github.com/chunkcanvas" target="_blank" rel="noopener noreferrer" className="text-sandy hover:underline ml-1">Clone the repo</a> to run locally with all providers.</p>
        </div>
      )}

      {/* ── Clear all files button ──────────────────────── */}
      {files.length > 1 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setFiles([])}
            className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 font-medium transition-colors cursor-pointer"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            Clear all files
          </button>
        </div>
      )}

      {extKeys.map((ext) => {
        const groupFiles = extGroups[ext];
        const pipelines = extPipelines[ext] ?? [];
        const selected = pipelinesByExt[ext] ?? "";
        const pipelineOptions: ProviderOption[] = pipelines.map((pipelineId) => ({
          id: pipelineId,
          label: PIPELINE_LABELS[pipelineId] ?? pipelineId,
          badge: PIPELINE_META[pipelineId]?.badge,
          icon: PIPELINE_META[pipelineId]?.icon,
          requiresApiKey: PIPELINE_NEEDS_KEY[pipelineId],
        }));
        const selectedOption = pipelineOptions.find((option) => option.id === selected);

        const FILE_PREVIEW_LIMIT = 5;
        const isExpanded = expandedExts.has(ext);
        const visibleFiles = isExpanded ? groupFiles : groupFiles.slice(0, FILE_PREVIEW_LIMIT);
        const hiddenCount = groupFiles.length - FILE_PREVIEW_LIMIT;
        const showConfig = selected && HAS_CONFIG.has(selected);
        const MAX_FILE_LIST_HEIGHT = 200; // px – scroll kicks in beyond this

        return (
          <div
            key={ext}
            className="rounded-xl border border-silver-light bg-card overflow-hidden"
          >
            {/* ── Group Header ──────────────────────────────── */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gunmetal/[0.02] dark:bg-white/[0.02] border-b border-silver-light">
              <div className="flex items-center gap-2.5">
                {/* Extension icon */}
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-sandy/10 text-sandy">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <div>
                  <span className="text-sm font-semibold text-gunmetal uppercase tracking-wide">.{ext}</span>
                  <span className="text-xs text-silver-dark ml-2">
                    {groupFiles.length} file{groupFiles.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Selected pipeline badge */}
                {selected && selectedOption && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sandy/10 text-sandy text-xs font-medium px-2.5 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-sandy" />
                    {selectedOption.label}
                  </span>
                )}
              </div>
            </div>

            <div className="px-4 py-3 space-y-3">
              {/* ── File list (scrollable) ────────────────────── */}
              <div
                className="space-y-0.5 overflow-y-auto pr-1"
                style={{ maxHeight: isExpanded ? `${MAX_FILE_LIST_HEIGHT}px` : undefined }}
              >
                {visibleFiles.map((f, i) => {
                  const globalIdx = getGlobalIndex(f);
                  return (
                    <div
                      key={`${f.name}-${i}`}
                      className="group flex items-center gap-2 text-xs text-gunmetal rounded-md px-1.5 py-1 hover:bg-gunmetal/[0.03] dark:hover:bg-white/[0.03] transition-colors"
                    >
                      <svg className="h-3 w-3 text-silver-dark flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                      <span className="truncate font-mono">{f.name}</span>
                      <span className="text-silver-dark whitespace-nowrap ml-auto">
                        {f.size < 1024
                          ? `${f.size} B`
                          : f.size < 1048576
                            ? `${(f.size / 1024).toFixed(1)} KB`
                            : `${(f.size / 1048576).toFixed(1)} MB`}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(globalIdx)}
                        className="flex-shrink-0 rounded p-0.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all cursor-pointer"
                        title={`Remove ${f.name}`}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(ext)}
                    className="text-xs text-sandy hover:text-sandy-dark font-medium cursor-pointer transition-colors mt-0.5 px-1.5"
                  >
                    {isExpanded ? "Show less" : `+${hiddenCount} more file${hiddenCount !== 1 ? "s" : ""}`}
                  </button>
                )}
              </div>

              {/* ── Pipeline selection ────────────────────────── */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-silver-dark">Select pipeline</p>
                <ProviderSelector
                  options={pipelineOptions}
                  selectedId={selected}
                  onSelect={(id) => setPipelineForExt(ext, id)}
                  disabledIds={disabledPipelineIds}
                  disabledTooltip="Requires local setup — clone the repo and run locally to use this provider"
                />

                {pipelines.length === 0 && (
                  <StatusMessage type="warning" label="Note:">
                    No compatible pipeline found for{" "}
                    <code className="font-mono">.{ext}</code> files.
                  </StatusMessage>
                )}
              </div>

              {/* ── Config form (only for pipelines that need it) ── */}
              {showConfig && (
                <ConfigContainer active>
                  <ConfigHeader
                    title={`${selectedOption?.label || "Pipeline"} Configuration`}
                    icon={selectedOption?.icon}
                    description={
                      selectedOption?.badge === "Cloud"
                        ? "Cloud provider selected. API key is required."
                        : ""
                    }
                  />
                  {selected.startsWith("OpenRouter") && (
                    <OpenRouterForm ext={ext} />
                  )}
                  {selected.startsWith("Ollama") && (
                    <OllamaForm ext={ext} />
                  )}
                  {selected.startsWith("vLLM") && (
                    <VllmForm ext={ext} />
                  )}
                  {selected === PIPELINE.DOCLING_PDF && (
                    <DoclingForm ext={ext} />
                  )}
                  {(selected === PIPELINE.EXCEL_SPREADSHEET ||
                    selected === PIPELINE.CSV_SPREADSHEET) && (
                    <div className="space-y-6">
                      {groupFiles.map(file => (
                        <ExcelForm key={file.name} ext={ext} file={file} />
                      ))}
                    </div>
                  )}
                </ConfigContainer>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
