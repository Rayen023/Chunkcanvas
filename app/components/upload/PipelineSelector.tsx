"use client";

import { useMemo, useEffect } from "react";
import { PIPELINE, PIPELINE_ALLOWED_EXTENSIONS } from "@/app/lib/constants";
import { useAppStore } from "@/app/lib/store";
import OpenRouterForm from "../pipeline-forms/OpenRouterForm";
import OllamaForm from "../pipeline-forms/OllamaForm";
import VllmForm from "../pipeline-forms/VllmForm";
import ExcelForm from "../pipeline-forms/ExcelForm";

const ALL_PIPELINES = Object.values(PIPELINE);

/** Short descriptions for each pipeline */
const PIPELINE_DESCRIPTIONS: Record<string, string> = {
  [PIPELINE.SIMPLE_TEXT]:
    "Extracts text locally using built-in parsers (pdfjs, mammoth). No API key needed.",
  [PIPELINE.EXCEL_SPREADSHEET]:
    "Reads spreadsheet rows and columns client-side. No API key needed.",
  [PIPELINE.CSV_SPREADSHEET]:
    "Reads CSV rows client-side. No API key needed.",
  [PIPELINE.OPENROUTER_PDF]:
    "Sends each PDF page to a multimodal LLM via OpenRouter for high-quality extraction.",
  [PIPELINE.OPENROUTER_IMAGE]:
    "Describes or extracts text from images using a multimodal LLM via OpenRouter.",
  [PIPELINE.OPENROUTER_AUDIO]:
    "Transcribes audio files using a multimodal LLM via OpenRouter.",
  [PIPELINE.OPENROUTER_VIDEO]:
    "Summarises video content using a multimodal LLM via OpenRouter.",
  [PIPELINE.OLLAMA_PDF]:
    "Vision-based parsing using a local Ollama model (e.g. gemma3-v, llava).",
  [PIPELINE.OLLAMA_IMAGE]:
    "Vision-based image description using a local Ollama model.",
  [PIPELINE.VLLM_PDF]:
    "Vision-based parsing using a local vLLM instance (OpenAI-compatible).",
  [PIPELINE.VLLM_IMAGE]:
    "Vision-based image description using a local vLLM instance.",
  [PIPELINE.VLLM_AUDIO]:
    "Audio transcription using a local vLLM instance (OpenAI-compatible).",
  [PIPELINE.VLLM_VIDEO]:
    "Video understanding using a local vLLM instance (OpenAI-compatible).",
};

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
};

export default function PipelineSelector() {
  const files = useAppStore((s) => s.files);
  const pipelinesByExt = useAppStore((s) => s.pipelinesByExt);
  const setPipelineForExt = useAppStore((s) => s.setPipelineForExt);
  const lastPipelineByExt = useAppStore((s) => s.lastPipelineByExt);

  // Global OpenRouter API key (shared across all ext groups)
  const openrouterApiKey = useAppStore((s) => s.openrouterApiKey);
  const setOpenrouterApiKey = useAppStore((s) => s.setOpenrouterApiKey);
  const envOpenrouterKey = useAppStore((s) => s.envKeys.openrouter);

  // Auto-fill env key once
  useEffect(() => {
    if (!openrouterApiKey && envOpenrouterKey) setOpenrouterApiKey(envOpenrouterKey);
  }, [openrouterApiKey, envOpenrouterKey, setOpenrouterApiKey]);

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
  const multiGroup = extKeys.length > 1;

  /** Whether any ext uses an OpenRouter pipeline */
  const anyOpenRouter = useMemo(
    () => Object.values(pipelinesByExt).some((p) => p.startsWith("OpenRouter")),
    [pipelinesByExt],
  );

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

  return (
    <div className="space-y-5">
      {/* Global OpenRouter API Key — shown once when any ext uses OpenRouter */}
      {anyOpenRouter && (
        <div className="space-y-1.5 p-3 bg-amber-50/50 rounded-lg border border-amber-100">
          <label className="block text-sm font-medium text-gunmetal">
            OpenRouter API Key
          </label>
          <input
            type="password"
            value={openrouterApiKey}
            onChange={(e) => setOpenrouterApiKey(e.target.value)}
            placeholder="sk-or-..."
            className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
          />
          {!openrouterApiKey && (
            <p className="text-xs text-amber-600">
              Required for all OpenRouter pipelines.
            </p>
          )}
        </div>
      )}

      {/* Per-extension groups */}
      <div className="space-y-5">
        {extKeys.map((ext) => {
          const groupFiles = extGroups[ext];
          const pipelines = extPipelines[ext] ?? [];
          const selected = pipelinesByExt[ext] ?? "";

          return (
            <div key={ext} className="space-y-2">
              {/* Extension group header */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gunmetal bg-sandy/15 px-2 py-0.5 rounded-full uppercase tracking-wide">
                  .{ext}
                </span>
                <span className="text-xs text-silver-dark">
                  {groupFiles.length} file
                  {groupFiles.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Pipeline options */}
              <div className="space-y-1.5 ml-1">
                {pipelines.map((name) => {
                  const isSelected = selected === name;
                  const needsKey = PIPELINE_NEEDS_KEY[name];
                  const desc = PIPELINE_DESCRIPTIONS[name] ?? "";

                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setPipelineForExt(ext, name)}
                      className={`
                        w-full text-left rounded-lg border px-3.5 py-2.5 transition-all duration-150 cursor-pointer
                        ${
                          isSelected
                            ? "border-sandy bg-sandy/8 ring-2 ring-sandy/30"
                            : "border-silver-light bg-white hover:border-sandy/50 hover:bg-sandy/4"
                        }
                      `}
                    >
                      <div className="flex items-center gap-2">
                        {/* Radio circle */}
                        <span
                          className={`
                            flex-shrink-0 h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors
                            ${isSelected ? "border-sandy" : "border-silver"}
                          `}
                        >
                          {isSelected && (
                            <span className="h-2 w-2 rounded-full bg-sandy" />
                          )}
                        </span>

                        <span
                          className={`text-sm font-medium ${isSelected ? "text-gunmetal" : "text-gunmetal-light"}`}
                        >
                          {name}
                        </span>

                        {needsKey && (
                          <span className="ml-auto flex-shrink-0 rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            API Key
                          </span>
                        )}
                      </div>

                      {desc && (
                        <p className="mt-1 ml-6 text-[11px] leading-relaxed text-silver-dark">
                          {desc}
                        </p>
                      )}
                    </button>
                  );
                })}

                {pipelines.length === 0 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
                    No compatible pipeline found for{" "}
                    <code className="font-mono">.{ext}</code> files.
                  </div>
                )}
              </div>

              {/* Per-extension config form — appears below selected pipeline */}
              {selected && selected !== PIPELINE.SIMPLE_TEXT && (
                <div className="ml-1 p-4 bg-slate-50 rounded-lg border border-silver-light space-y-3">
                  {selected.startsWith("OpenRouter") && (
                    <OpenRouterForm ext={ext} />
                  )}
                  {selected.startsWith("Ollama") && (
                    <OllamaForm ext={ext} />
                  )}
                  {selected.startsWith("vLLM") && (
                    <VllmForm ext={ext} />
                  )}
                  {(selected === PIPELINE.EXCEL_SPREADSHEET ||
                    selected === PIPELINE.CSV_SPREADSHEET) && (
                    <ExcelForm ext={ext} />
                  )}
                </div>
              )}
              {selected === PIPELINE.SIMPLE_TEXT && (
                <p className="ml-1 text-xs text-silver-dark italic">
                  No configuration needed for Simple Text extraction.
                </p>
              )}

              {/* Separator between groups */}
              {multiGroup && ext !== extKeys[extKeys.length - 1] && (
                <div className="h-px bg-silver-light mt-3" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
