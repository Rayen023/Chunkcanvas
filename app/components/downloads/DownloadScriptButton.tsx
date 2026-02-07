"use client";

import { useCallback, useState } from "react";
import { useAppStore } from "@/app/lib/store";
import type { ScriptStage, ScriptConfig } from "@/app/lib/script-generator";
import { PIPELINE } from "@/app/lib/constants";

interface Props {
  stage: ScriptStage;
  label: string;
}

export default function DownloadScriptButton({ stage, label }: Props) {
  const pipeline = useAppStore((s) => s.pipeline);
  const chunkingParams = useAppStore((s) => s.chunkingParams);
  const parsedFilename = useAppStore((s) => s.parsedFilename);
  const openrouterModel = useAppStore((s) => s.openrouterModel);
  const openrouterPrompt = useAppStore((s) => s.openrouterPrompt);
  const pdfEngine = useAppStore((s) => s.pdfEngine);
  const excelColumn = useAppStore((s) => s.excelColumn);
  const voyageModel = useAppStore((s) => s.voyageModel);
  const pineconeIndexName = useAppStore((s) => s.pineconeIndexName);
  const pineconeEnvKey = useAppStore((s) => s.pineconeEnvKey);
  const editedChunks = useAppStore((s) => s.editedChunks);

  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const { generatePipelineScript } = await import(
        "@/app/lib/script-generator"
      );
      const { downloadZip } = await import("@/app/lib/downloads");
      const { PINECONE_ENVIRONMENTS } = await import("@/app/lib/constants");

      const env = PINECONE_ENVIRONMENTS.find((e) => e.key === pineconeEnvKey);

      const config: ScriptConfig = {
        pipeline,
        chunkingParams,
        openrouterModel,
        openrouterPrompt,
        pdfEngine,
        excelColumn: pipeline === PIPELINE.EXCEL_SPREADSHEET ? excelColumn : undefined,
        voyageModel,
        pineconeIndexName,
        pineconeCloud: env?.cloud,
        pineconeRegion: env?.region,
      };

      const files = generatePipelineScript(stage, config);
      const stem = parsedFilename.replace(/\.[^.]+$/, "") || "document";
      await downloadZip(files as unknown as Record<string, string>, `${stem}_${stage}_pipeline.zip`);
    } finally {
      setDownloading(false);
    }
  }, [
    pipeline, chunkingParams, parsedFilename, openrouterModel,
    openrouterPrompt, pdfEngine, excelColumn, voyageModel,
    pineconeIndexName, pineconeEnvKey, stage,
  ]);

  if (editedChunks.length === 0) return null;

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="w-full flex items-center justify-center gap-2 rounded-lg bg-white border border-silver px-4 py-3 text-sm font-medium text-gunmetal hover:border-sandy transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
      {downloading ? "Generating…" : label}
    </button>
  );
}
