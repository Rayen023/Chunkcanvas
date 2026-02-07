"use client";

import { useCallback, useState } from "react";
import { useAppStore } from "@/app/lib/store";
import type { ChunksJson } from "@/app/lib/types";

export default function DownloadJsonButton() {
  const editedChunks = useAppStore((s) => s.editedChunks);
  const parsedFilename = useAppStore((s) => s.parsedFilename);
  const pipeline = useAppStore((s) => s.pipeline);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const data: ChunksJson = {
        metadata: {
          source_file: parsedFilename,
          pipeline,
          num_chunks: editedChunks.length,
        },
        chunks: editedChunks.map((text, i) => ({ index: i, text })),
      };

      const stem = parsedFilename.replace(/\.[^.]+$/, "");
      const { downloadJson } = await import("@/app/lib/downloads");
      await downloadJson(data, `${stem}_chunks.json`);
    } finally {
      setDownloading(false);
    }
  }, [editedChunks, parsedFilename, pipeline]);

  if (editedChunks.length === 0) return null;

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="w-full flex items-center justify-center gap-2 rounded-lg bg-sandy px-4 py-3 text-sm font-medium text-white hover:bg-sandy-light active:bg-sandy-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {downloading ? "Preparing…" : "Download Chunks as JSON"}
    </button>
  );
}
