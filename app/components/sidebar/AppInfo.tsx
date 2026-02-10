"use client";

import { useCallback } from "react";
import { useAppStore } from "@/app/lib/store";

/* ─── Step definitions ────────────────────────────────────── */
const STEPS = [
  {
    num: 1,
    title: "Upload & Pipeline",
    short: "Drop a file and pick a processing pipeline.",
    detail: "Supports PDF, DOCX, TXT, Markdown, Excel, images, audio, and video. The pipeline is auto-selected when only one matches.",
    badge: null,
  },
  {
    num: 2,
    title: "Configure & Parse",
    short: "Set pipeline options, then process the document.",
    detail: "For OpenRouter pipelines, enter your API key and choose a model. PDFs are parsed page-by-page via multimodal LLMs.",
    badge: null,
  },
  {
    num: 3,
    title: "Review & Chunk",
    short: "Inspect parsed text and split it into chunks.",
    detail: "Adjust separators, chunk size, and overlap. The chunker uses LangChain's RecursiveCharacterTextSplitter.",
    badge: null,
  },
  {
    num: 4,
    title: "Edit & Download",
    short: "Edit individual chunks, then export.",
    detail: "Download chunks as JSON or generate a reproducible Python pipeline script (.zip).",
    badge: null,
  },
  {
    num: 5,
    title: "Embeddings",
    short: "Generate vector embeddings with OpenRouter or Voyage AI.",
    detail: "Chunks are batched and sent to your chosen embedding provider. Results can be downloaded as JSON.",
    badge: null,
  },
  {
    num: 6,
    title: "Vector Databases",
    short: "Upload embeddings to a vector database.",
    detail: "Create or select an index, then upsert vectors with chunk text as metadata.",
    badge: null,
  },
];

/* ─── Compute the current active step from store state ────── */
function useActiveStep(): number {
  const files = useAppStore((s) => s.files);
  const pipelinesByExt = useAppStore((s) => s.pipelinesByExt);
  const parsedContent = useAppStore((s) => s.parsedContent);
  const editedChunks = useAppStore((s) => s.editedChunks);
  const embeddingsData = useAppStore((s) => s.embeddingsData);
  const scrollActiveStep = useAppStore((s) => s.scrollActiveStep);

  // After embeddings → step 6 (Pinecone)
  if (embeddingsData && embeddingsData.length > 0) return 6;

  // When chunks exist but no embeddings → use scroll detection (4 or 5)
  if (editedChunks.length > 0) {
    return scrollActiveStep ?? 4;
  }

  // Before chunks
  if (parsedContent) return 3;
  if (files.length > 0 && Object.values(pipelinesByExt).some(Boolean)) return 2;
  return 1;
}

export default function AppInfo() {
  const currentStep = useActiveStep();

  const scrollToStep = useCallback((stepNum: number) => {
    const el = document.getElementById(`step-${stepNum}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <div className="space-y-1">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-silver-dark mb-3">
        Workflow
      </h3>

      {STEPS.map((step) => {
        const isActive = step.num === currentStep;
        const isDone = step.num < currentStep;
        const isFuture = step.num > currentStep;

        return (
          <button
            key={step.num}
            onClick={() => scrollToStep(step.num)}
            className={`
              w-full text-left rounded-lg px-3 py-2.5 transition-all duration-200 cursor-pointer
              ${isActive ? "bg-sandy/10 border border-sandy/30" : "border border-transparent"}
              ${isDone ? "opacity-70 hover:opacity-90" : ""}
              ${isFuture ? "opacity-40 hover:opacity-60" : ""}
              ${!isActive ? "hover:bg-silver-light/30" : ""}
            `}
          >
            {/* Step header row */}
            <div className="flex items-center gap-2.5">
              {/* Badge */}
              <div
                className={`
                  flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors
                  ${isActive ? "bg-sandy text-white" : ""}
                  ${isDone ? "bg-sandy/60 text-white" : ""}
                  ${isFuture ? "bg-silver-light text-silver-dark" : ""}
                `}
              >
                {isDone ? (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.num
                )}
              </div>

              {/* Title */}
              <span
                className={`text-xs font-medium ${isActive ? "text-gunmetal" : "text-gunmetal-light"}`}
              >
                {step.title}
              </span>

              {/* API Key badge */}
              {step.badge && (
                <span className="ml-auto flex-shrink-0 rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 leading-tight">
                  {step.badge}
                </span>
              )}
            </div>

            {/* Active step shows contextual description */}
            {isActive && (
              <div className="mt-1.5 ml-7.5 space-y-1">
                <p className="text-[11px] text-gunmetal-light leading-relaxed">
                  {step.short}
                </p>
                <p className="text-[10px] text-silver-dark leading-relaxed">
                  {step.detail}
                </p>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
