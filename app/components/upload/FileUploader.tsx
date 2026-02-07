"use client";

import { useCallback, useRef, useState } from "react";
import { ALL_ACCEPTED_EXTENSIONS } from "@/app/lib/constants";
import { useAppStore } from "@/app/lib/store";

export default function FileUploader() {
  const setFile = useAppStore((s) => s.setFile);
  const file = useAppStore((s) => s.file);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = useCallback(
    (f: File | null) => {
      if (!f) return;
      setFile(f);
    },
    [setFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
    },
    [handleFile],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => inputRef.current?.click()}
      className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
        dragActive
          ? "border-sandy bg-sandy/5"
          : "border-silver hover:border-sandy-light"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ALL_ACCEPTED_EXTENSIONS.join(",")}
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        className="hidden"
      />

      <div className="flex flex-col items-center gap-2">
        <svg
          className="h-10 w-10 text-silver-dark"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>

        {file ? (
          <div>
            <p className="text-sm font-medium text-gunmetal">{file.name}</p>
            <p className="text-xs text-silver-dark">
              {(file.size / 1024).toFixed(1)} KB — click or drag to replace
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-gunmetal">
              Drop a file here or click to browse
            </p>
            <p className="text-xs text-silver-dark mt-1">
              PDF, DOCX, TXT, MD, XLSX, images, audio, video
            </p>
            <p className="text-xs text-silver-dark mt-0.5">
              Video files: 100 MB max
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
