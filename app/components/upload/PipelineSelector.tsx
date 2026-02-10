"use client";

import { useMemo, useEffect } from "react";
import { PIPELINE, PIPELINE_ALLOWED_EXTENSIONS } from "@/app/lib/constants";
import { useAppStore } from "@/app/lib/store";

const ALL_PIPELINES = Object.values(PIPELINE);

/** Short descriptions for each pipeline */
const PIPELINE_DESCRIPTIONS: Record<string, string> = {
  [PIPELINE.SIMPLE_TEXT]:
    "Extracts text locally using built-in parsers (pdfjs, mammoth). No API key needed.",
  [PIPELINE.EXCEL_SPREADSHEET]:
    "Reads spreadsheet rows and columns client-side. No API key needed.",
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
};

/** Whether a pipeline requires an API key */
const PIPELINE_NEEDS_KEY: Record<string, boolean> = {
  [PIPELINE.SIMPLE_TEXT]: false,
  [PIPELINE.EXCEL_SPREADSHEET]: false,
  [PIPELINE.OPENROUTER_PDF]: true,
  [PIPELINE.OPENROUTER_IMAGE]: true,
  [PIPELINE.OPENROUTER_AUDIO]: true,
  [PIPELINE.OPENROUTER_VIDEO]: true,
  [PIPELINE.OLLAMA_PDF]: false,
  [PIPELINE.OLLAMA_IMAGE]: false,
  [PIPELINE.VLLM_PDF]: false,
  [PIPELINE.VLLM_IMAGE]: false,
  [PIPELINE.VLLM_AUDIO]: false,
};

export default function PipelineSelector() {
  const file = useAppStore((s) => s.file);
  const pipeline = useAppStore((s) => s.pipeline);
  const setPipeline = useAppStore((s) => s.setPipeline);

  const ext = useMemo(
    () => file?.name.split(".").pop()?.toLowerCase() ?? "",
    [file],
  );

  /** Only the pipelines that are compatible with the current file (or all if no file) */
  const validPipelines = useMemo(() => {
    if (!ext) return ALL_PIPELINES;
    return ALL_PIPELINES.filter(
      (p) => PIPELINE_ALLOWED_EXTENSIONS[p]?.has(ext) ?? false,
    );
  }, [ext]);

  // Auto-select if exactly one compatible
  useEffect(() => {
    if (!ext) return;
    if (validPipelines.length === 1) {
      setPipeline(validPipelines[0]);
    }
  }, [validPipelines, ext, setPipeline]);

  // If the current selection is no longer valid after a file change, clear it
  useEffect(() => {
    if (pipeline && ext && !validPipelines.includes(pipeline as typeof ALL_PIPELINES[number])) {
      setPipeline("");
    }
  }, [pipeline, ext, validPipelines, setPipeline]);

  return (
    <div className="space-y-2.5">
      <label className="block text-sm font-medium text-gunmetal">
        Processing Pipeline
      </label>

      <div className="space-y-1.5">
        {validPipelines.map((name) => {
          const isSelected = pipeline === name;
          const needsKey = PIPELINE_NEEDS_KEY[name];
          const desc = PIPELINE_DESCRIPTIONS[name] ?? "";

          return (
            <button
              key={name}
              type="button"
              onClick={() => setPipeline(name)}
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

                <span className={`text-sm font-medium ${isSelected ? "text-gunmetal" : "text-gunmetal-light"}`}>
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

        {ext && validPipelines.length === 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
            No compatible pipeline found for <code className="font-mono">.{ext}</code> files.
          </div>
        )}
      </div>
    </div>
  );
}
