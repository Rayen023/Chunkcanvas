"use client";

import { useAppStore } from "@/app/lib/store";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { PIPELINE } from "@/app/lib/constants";
import ActionRow from "@/app/components/downloads/ActionRow";
import type { ScriptConfig } from "@/app/lib/script-generator";
import { countTokens } from "@/app/lib/tokenizer";

const FILE_SEP_RE = /═══ (.+?) ═══/g;

export default function ParsedDocumentView() {
  const parsedContent = useAppStore((s) => s.parsedContent);
  const setParsedContent = useAppStore((s) => s.setParsedContent);
  const isParsing = useAppStore((s) => s.isParsing);
  const parsedResults = useAppStore((s) => s.parsedResults);
  const parsedFilename = useAppStore((s) => s.parsedFilename);

  // Script generation selectors
  const pipeline = useAppStore((s) => s.pipeline);
  const chunkingParams = useAppStore((s) => s.chunkingParams);
  const openrouterModel = useAppStore((s) => s.openrouterModel);
  const openrouterPrompt = useAppStore((s) => s.openrouterPrompt);
  const pdfEngine = useAppStore((s) => s.pdfEngine);
  const excelColumn = useAppStore((s) => s.excelColumn);
  const excelSheet = useAppStore((s) => s.excelSheet);
  const embeddingProvider = useAppStore((s) => s.embeddingProvider);
  const voyageModel = useAppStore((s) => s.voyageModel);
  const cohereModel = useAppStore((s) => s.cohereModel);
  const openrouterEmbeddingModel = useAppStore((s) => s.openrouterEmbeddingModel);
  const embeddingDimensions = useAppStore((s) => s.embeddingDimensions);
  const pineconeIndexName = useAppStore((s) => s.pineconeIndexName);
  const pineconeEnvKey = useAppStore((s) => s.pineconeEnvKey);

  const [showSaved, setShowSaved] = useState(false);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [isDownloadingText, setIsDownloadingText] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevLenRef = useRef(0);
  const userScrolledRef = useRef(false);

  const fileSections = useMemo(() => {
    if (!parsedContent) return [];
    const sections: { name: string; charOffset: number }[] = [];
    let match: RegExpExecArray | null;
    const re = new RegExp(FILE_SEP_RE);
    while ((match = re.exec(parsedContent)) !== null) {
      sections.push({ name: match[1], charOffset: match.index });
    }
    return sections;
  }, [parsedContent]);

  const scrollToFile = useCallback(
    (name: string) => {
      const el = textareaRef.current;
      if (!el || !parsedContent) return;
      setActiveFile(name);
      const section = fileSections.find((s) => s.name === name);
      if (!section) return;

      const mirror = document.createElement("textarea");
      const cs = getComputedStyle(el);
      mirror.style.position = "fixed";
      mirror.style.left = "-9999px";
      mirror.style.top = "0";
      mirror.style.visibility = "hidden";
      mirror.style.width = cs.width;
      mirror.style.font = cs.font;
      mirror.style.letterSpacing = cs.letterSpacing;
      mirror.style.wordSpacing = cs.wordSpacing;
      mirror.style.padding = cs.padding;
      mirror.style.border = cs.border;
      mirror.style.boxSizing = cs.boxSizing;
      mirror.style.whiteSpace = cs.whiteSpace;
      mirror.style.wordWrap = cs.wordWrap;
      mirror.style.overflowWrap = cs.overflowWrap;
      mirror.style.lineHeight = cs.lineHeight;
      mirror.style.height = "auto";
      mirror.style.overflow = "hidden";
      mirror.value = parsedContent.substring(0, section.charOffset);
      document.body.appendChild(mirror);
      const targetY = mirror.scrollHeight;
      document.body.removeChild(mirror);

      el.focus();
      el.setSelectionRange(section.charOffset, section.charOffset);

      const lineHeight = parseFloat(cs.lineHeight) || 21;
      const scrollPos = Math.max(0, targetY - lineHeight * 2);
      el.scrollTop = scrollPos;
      requestAnimationFrame(() => {
        el.scrollTop = scrollPos;
      });
    },
    [parsedContent, fileSections],
  );

  useEffect(() => {
    if (showSaved) {
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showSaved]);

  useEffect(() => {
    if (isParsing) {
      userScrolledRef.current = false;
      prevLenRef.current = 0;
    }
  }, [isParsing]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el || !isParsing || userScrolledRef.current) return;
    const len = parsedContent?.length ?? 0;
    if (len > prevLenRef.current) {
      el.scrollTop = el.scrollHeight;
      prevLenRef.current = len;
    }
  }, [parsedContent, isParsing]);

  const handleScroll = useCallback(() => {
    const el = textareaRef.current;
    if (!el || !isParsing) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    userScrolledRef.current = !atBottom;
  }, [isParsing]);

  const tokenCount = useMemo(() => {
    return countTokens(parsedContent);
  }, [parsedContent]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    
    el.style.height = "auto";
    const newHeight = Math.min(Math.max(el.scrollHeight + 2, 150), 600);
    el.style.height = `${newHeight}px`;
  }, [parsedContent]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setParsedContent(e.target.value);
    setShowSaved(true);
  };

  const handleDownloadText = useCallback(async () => {
    if (!parsedContent) return;
    setIsDownloadingText(true);
    try {
      if (parsedResults.length <= 1) {
        const { downloadString } = await import("@/app/lib/downloads");
        const r = parsedResults[0];
        const content = r ? r.content : parsedContent;
        const fname = r ? r.filename : parsedFilename;
        const stem = fname.replace(/\.[^/.]+$/, "");
        await downloadString(content, `${stem}.md`, "text/markdown;charset=utf-8");
      } else {
        const { downloadZip } = await import("@/app/lib/downloads");
        const files: Record<string, string> = {};
        parsedResults.forEach((r) => {
          const name = r.filename.replace(/\.[^/.]+$/, "") + ".md";
          files[name] = r.content;
        });
        await downloadZip(files, "parsed_documents.zip");
      }
    } finally {
      setIsDownloadingText(false);
    }
  }, [parsedContent, parsedResults, parsedFilename]);

  const handleGenerateScript = useCallback(async () => {
    setIsGeneratingScript(true);
    try {
      const { generatePipelineScript } = await import("@/app/lib/script-generator");
      const { downloadZip } = await import("@/app/lib/downloads");
      const { PINECONE_ENVIRONMENTS } = await import("@/app/lib/constants");

      const env = PINECONE_ENVIRONMENTS.find((e) => e.key === pineconeEnvKey);
      const isSpreadsheet = pipeline === PIPELINE.EXCEL_SPREADSHEET || pipeline === PIPELINE.CSV_SPREADSHEET;

      const config: ScriptConfig = {
        pipeline,
        chunkingParams,
        filename: parsedFilename,
        openrouterModel,
        openrouterPrompt,
        pdfEngine,
        excelColumn: isSpreadsheet ? excelColumn : undefined,
        excelSheet: isSpreadsheet ? excelSheet : undefined,
        embeddingProvider,
        voyageModel,
        cohereModel,
        openrouterEmbeddingModel,
        embeddingDimensions,
        pineconeIndexName,
        pineconeCloud: env?.cloud,
        pineconeRegion: env?.region,
      };

      const files = generatePipelineScript("parsing", config);
      const stem = parsedFilename.replace(/\.[^.]+$/, "") || "document";
      await downloadZip(files as unknown as Record<string, string>, `${stem}_parsing_pipeline.zip`);
    } finally {
      setIsGeneratingScript(false);
    }
  }, [
    pipeline, chunkingParams, parsedFilename, openrouterModel, openrouterPrompt,
    pdfEngine, excelColumn, excelSheet, embeddingProvider, voyageModel, cohereModel,
    openrouterEmbeddingModel, embeddingDimensions, pineconeIndexName, pineconeEnvKey,
  ]);

  if (parsedContent === null) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {isParsing && (
            <h2 className="text-lg font-semibold text-gunmetal whitespace-nowrap">
              Streaming Output
            </h2>
          )}
          {!isParsing && (
            <div className="flex items-center gap-1.5 text-xs text-silver-dark">
              <span className="h-1 w-1 rounded-full bg-sandy" />
              Changes auto-save as you edit
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 transition-all duration-300 ${
              showSaved ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
            }`}
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Saved
          </div>
          {isParsing && (
            <span className="text-xs font-medium text-sandy animate-pulse">
              Streaming...
            </span>
          )}
          <span className="text-xs text-silver-dark bg-silver-light/50 px-2 py-0.5 rounded-full">
            {tokenCount.toLocaleString()} tokens
          </span>
        </div>
      </div>

      {fileSections.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 pb-1">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-silver-dark whitespace-nowrap mr-1">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            Jump to:
          </span>
          {fileSections.map((sec, i) => {
            const isActive = activeFile === sec.name;
            return (
              <button
                key={`${sec.name}-${i}`}
                type="button"
                onClick={() => scrollToFile(sec.name)}
                className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium cursor-pointer border transition-colors duration-200 ${
                  isActive
                    ? "border-sandy bg-sandy text-white shadow-sm"
                    : "border-silver bg-white dark:bg-gunmetal/10 text-gunmetal hover:border-sandy hover:text-sandy"
                }`}
              >
                {sec.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="relative w-full">
        {isParsing && (
          <div className="absolute inset-0 rounded-xl ring-2 ring-sandy animate-pulse pointer-events-none z-10" />
        )}
        <textarea
          ref={textareaRef}
          value={parsedContent}
          onChange={handleChange}
          readOnly={isParsing}
          onScroll={handleScroll}
          className={`parsed-document-textarea w-full rounded-xl border p-4 text-sm font-mono text-gunmetal-light resize-y focus:outline-none focus:ring-2 focus:ring-sandy/50 focus:border-sandy overflow-y-auto ${
            isParsing
              ? "border-sandy cursor-default"
              : "border-silver-light"
          }`}
          style={{ minHeight: "150px", maxHeight: "600px" }}
        />
      </div>

      {!isParsing && parsedContent && (
        <div className="pt-2">
          <ActionRow
            onDownload={handleDownloadText}
            downloadLabel={
              parsedResults.length > 1
                ? "Download Parsed Text (.zip)"
                : "Download Parsed Text (.md)"
            }
            isDownloading={isDownloadingText}
            onGenerateScript={handleGenerateScript}
            scriptLabel="Generate Script"
            isGeneratingScript={isGeneratingScript}
          />
        </div>
      )}
    </div>
  );
}
