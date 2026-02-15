"use client";

import { useCallback, useRef, useState } from "react";
import { ALL_ACCEPTED_EXTENSIONS } from "@/app/lib/constants";
import { useAppStore } from "@/app/lib/store";

async function traverseEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise<File[]>((resolve) => {
      (entry as FileSystemFileEntry).file((f) => resolve([f]));
    });
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const entries = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    const results: File[] = [];
    for (const e of entries) results.push(...(await traverseEntry(e)));
    return results;
  }
  return [];
}

export default function FileUploader() {
  const files = useAppStore((s) => s.files);
  const setFiles = useAppStore((s) => s.setFiles);
  const addFiles = useAppStore((s) => s.addFiles);
  const inputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [dupeWarning, setDupeWarning] = useState<string[] | null>(null);

  const handleFileArray = useCallback(
    (incoming: File[]) => {
      if (incoming.length === 0) return;

      const seen = new Map<string, number>();
      const batchDupes: string[] = [];
      for (const f of incoming) {
        seen.set(f.name, (seen.get(f.name) ?? 0) + 1);
      }
      for (const [name, count] of seen) {
        if (count > 1) batchDupes.push(name);
      }

      const existingNames = new Set(files.map((f) => f.name));
      const crossDupes = incoming
        .filter((f) => existingNames.has(f.name))
        .map((f) => f.name);

      const allDupes = [...new Set([...batchDupes, ...crossDupes])];

      const uniqueNames = new Set<string>();
      const deduped = incoming.filter((f) => {
        if (uniqueNames.has(f.name) || existingNames.has(f.name)) return false;
        uniqueNames.add(f.name);
        return true;
      });

      if (allDupes.length > 0) {
        setDupeWarning(allDupes);
        setTimeout(() => setDupeWarning(null), 5000);
      }

      if (deduped.length === 0) return;
      if (files.length === 0) {
        setFiles(deduped);
      } else {
        addFiles(deduped);
      }

      requestAnimationFrame(() => {
        document.getElementById("step-2")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      if (inputRef.current) inputRef.current.value = "";
      if (dirInputRef.current) dirInputRef.current.value = "";
    },
    [files, setFiles, addFiles],
  );

  const handleFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming || incoming.length === 0) return;
      handleFileArray(Array.from(incoming));
      if (inputRef.current) inputRef.current.value = "";
      if (dirInputRef.current) dirInputRef.current.value = "";    },
    [handleFileArray],
  );

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const items = Array.from(e.dataTransfer.items);
      const hasDir = items.some((i) => i.webkitGetAsEntry?.()?.isDirectory);

      if (hasDir) {
        const allFiles: File[] = [];
        for (const item of items) {
          const entry = item.webkitGetAsEntry?.();
          if (entry) {
            allFiles.push(...(await traverseEntry(entry)));
          } else if (item.kind === "file") {
            const f = item.getAsFile();
            if (f) allFiles.push(f);
          }
        }
        handleFileArray(allFiles);
      } else {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles, handleFileArray],
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

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="space-y-3">
      {dupeWarning && dupeWarning.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <svg className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <div>
            <p className="font-medium">Duplicate files skipped</p>
            <p className="text-xs mt-0.5 text-amber-700">
              {dupeWarning.join(", ")} — only one copy of each file is kept.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDupeWarning(null)}
            className="ml-auto text-amber-500 hover:text-amber-700 cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <input
        ref={dirInputRef}
        type="file"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...({ webkitdirectory: "true" } as any)}
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

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
          multiple
          accept={ALL_ACCEPTED_EXTENSIONS.join(",")}
          onChange={(e) => handleFiles(e.target.files)}
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

          {files.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-gunmetal">
                {files.length} file{files.length !== 1 ? "s" : ""} selected
              </p>
              <p className="text-xs text-silver-dark">
                {(totalSize / 1024).toFixed(1)} KB total — click or drag to add
                more files
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-gunmetal">
                Drop file(s) or folder here, or click to browse
              </p>
              <p className="text-xs text-silver-dark mt-1">
                PDF, Images, Audio, Video, XLSX, DOCX, CSV... 
              </p>
              <p className="text-xs text-silver-dark mt-0.5">
                Mixed file types supported — each type gets its own pipeline
              </p>
            </div>
          )}
        </div>
      </div>

      {files.length === 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); dirInputRef.current?.click(); }}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-silver px-3 py-2 text-sm text-silver-dark hover:border-sandy-light hover:text-gunmetal transition-colors cursor-pointer"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
          </svg>
          Upload folder
        </button>
      )}

    </div>
  );
}
