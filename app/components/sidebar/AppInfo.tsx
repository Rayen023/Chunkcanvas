"use client";

import { useCallback } from "react";
import { useAppStore } from "@/app/lib/store";

/* ─── Step definitions ────────────────────────────────────── */
const STEPS = [
  {
    num: 1,
    title: "Upload Files",
    short: "Drag & drop or browse for files and folders.",
    detail: "Supports PDF, DOCX, TXT, Excel, CSV, images, audio, and video.",
  },
  {
    num: 2,
    title: "Configure & Parse",
    short: "Select a pipeline and provider per file type.",
    detail: "Local (Ollama, vLLM) or cloud (OpenRouter). Supports caching and cancellation.",
  },
  {
    num: 3,
    title: "Review Parsed Content",
    short: "Verify and edit extracted content before chunking.",
    detail: "Downloadable as plain text.",
  },
  {
    num: 4,
    title: "Chunking",
    short: "Configure chunk size, overlap, and separators.",
    detail: "Live preview updates automatically. Edit or delete individual chunks. Downloadable as JSON.",
  },
  {
    num: 5,
    title: "Embeddings",
    short: "Generate vector embeddings for each chunk.",
    detail: "Providers: OpenRouter, Voyage AI, Cohere, Ollama, vLLM. Ensure index dimensions match the model.",
  },
  {
    num: 6,
    title: "Vector Databases",
    short: "Configure and upsert to a vector database.",
    detail: "Supports Pinecone, Chroma, MongoDB, and FAISS. Can customize field mapping before upsert.",
  },
];

/* ─── Derive per-step completion state from the store ─────── */
function useStepStates(): Record<number, { hasData: boolean; isComplete: boolean }> {
  const files = useAppStore((s) => s.files);
  const parsedResults = useAppStore((s) => s.parsedResults);
  const parsedContent = useAppStore((s) => s.parsedContent);
  const editedChunks = useAppStore((s) => s.editedChunks);
  const embeddingsData = useAppStore((s) => s.embeddingsData);
  const chunksHash = useAppStore((s) => s.chunksHash);
  const embeddingsForChunksHash = useAppStore((s) => s.embeddingsForChunksHash);
  const pineconeSuccess = useAppStore((s) => s.pineconeSuccess);
  const chromaSuccess = useAppStore((s) => s.chromaSuccess);
  const faissSuccess = useAppStore((s) => s.faissSuccess);

  const allFilesParsed =
    files.length > 0 &&
    files.every((f) => parsedResults.some((r) => r.filename === f.name));

  const hasEmbeddings = !!(embeddingsData && embeddingsData.length > 0);
  const embeddingsFresh = hasEmbeddings && embeddingsForChunksHash === chunksHash;
  const hasDbSuccess = !!(pineconeSuccess || chromaSuccess || faissSuccess);

  return {
    1: { hasData: files.length > 0, isComplete: files.length > 0 },
    2: { hasData: files.length > 0, isComplete: allFilesParsed },
    3: { hasData: parsedContent !== null, isComplete: embeddingsFresh && allFilesParsed },
    4: { hasData: editedChunks.length > 0, isComplete: embeddingsFresh && allFilesParsed },
    5: { hasData: hasEmbeddings, isComplete: embeddingsFresh && allFilesParsed },
    6: { hasData: hasDbSuccess, isComplete: hasDbSuccess && embeddingsFresh && allFilesParsed },
  };
}

export default function AppInfo() {
  const scrollActiveStep = useAppStore((s) => s.scrollActiveStep);
  const stepStates = useStepStates();

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
        const isActive = step.num === scrollActiveStep;
        const { hasData, isComplete } = stepStates[step.num];

        return (
          <button
            key={step.num}
            onClick={() => scrollToStep(step.num)}
            className={`
              w-full text-left rounded-lg px-3 py-2.5 transition-all duration-200 cursor-pointer
              ${isActive ? "bg-sandy/10 border border-sandy/30" : "border border-transparent hover:bg-silver-light/30"}
            `}
          >
            {/* Step header row */}
            <div className="flex items-center gap-2.5">
              {/* Badge */}
              <div
                className={`
                  flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors
                  ${isComplete ? "bg-sandy text-white" : ""}
                  ${hasData && !isComplete ? "bg-sandy/50 text-white" : ""}
                  ${!hasData ? "bg-silver-light text-silver-dark" : ""}
                `}
              >
                {isComplete ? (
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
