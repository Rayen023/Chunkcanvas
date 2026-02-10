"use client";

import { useAppStore } from "@/app/lib/store";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";

/** Regex matching the file separator used during multi-file parsing: ═══ filename ═══ */
const FILE_SEP_RE = /═══ (.+?) ═══/g;

export default function ParsedDocumentView() {
  const parsedContent = useAppStore((s) => s.parsedContent);
  const setParsedContent = useAppStore((s) => s.setParsedContent);
  const isParsing = useAppStore((s) => s.isParsing);
  const [showSaved, setShowSaved] = useState(false);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevLenRef = useRef(0);
  const userScrolledRef = useRef(false);

  // ── Derive file sections from parsed content ───────────
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

  /** Scroll the textarea so the given character offset is at the top */
  const scrollToFile = useCallback(
    (name: string) => {
      const el = textareaRef.current;
      if (!el || !parsedContent) return;
      setActiveFile(name);
      const section = fileSections.find((s) => s.name === name);
      if (!section) return;

      // Measure exact pixel position using an off-screen mirror textarea
      // that matches all text-layout-relevant CSS properties.
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

      // Place cursor first (setSelectionRange triggers browser auto-scroll),
      // then override scrollTop in the next frame so our position wins.
      el.focus();
      el.setSelectionRange(section.charOffset, section.charOffset);
      const scrollPos = Math.max(0, targetY - 16);
      el.scrollTop = scrollPos;
      requestAnimationFrame(() => {
        el.scrollTop = scrollPos;
      });
    },
    [parsedContent, fileSections],
  );

  // Hide the "Saved" indicator after 2 seconds
  useEffect(() => {
    if (showSaved) {
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showSaved]);

  // Reset scroll tracking when parsing starts
  useEffect(() => {
    if (isParsing) {
      userScrolledRef.current = false;
      prevLenRef.current = 0;
    }
  }, [isParsing]);

  // Auto-scroll to bottom during streaming (unless user scrolled up)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el || !isParsing || userScrolledRef.current) return;
    const len = parsedContent?.length ?? 0;
    if (len > prevLenRef.current) {
      el.scrollTop = el.scrollHeight;
      prevLenRef.current = len;
    }
  }, [parsedContent, isParsing]);

  // Detect if user scrolled away from bottom
  const handleScroll = useCallback(() => {
    const el = textareaRef.current;
    if (!el || !isParsing) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    userScrolledRef.current = !atBottom;
  }, [isParsing]);

  const wordCount = useMemo(() => {
    if (!parsedContent) return 0;
    const words = parsedContent.trim().split(/\s+/);
    return words.length === 1 && words[0] === "" ? 0 : words.length;
  }, [parsedContent]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setParsedContent(e.target.value);
    setShowSaved(true);
  };

  if (parsedContent === null) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gunmetal">
          {isParsing ? "Streaming Output" : "Parsed Document"}
        </h2>
        <div className="flex items-center gap-2">
          {isParsing && (
            <div className="flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 animate-pulse">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="4" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="20" cy="12" r="2" />
              </svg>
              Streaming…
            </div>
          )}
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
          <span className="text-xs text-silver-dark bg-silver-light/50 px-2 py-0.5 rounded-full">
            {wordCount.toLocaleString()} words
          </span>
        </div>
      </div>

      {/* ── File navigation tabs (multi-file only) ─────────── */}
      {fileSections.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 pb-1">
          <span className="text-xs font-medium text-silver-dark whitespace-nowrap mr-1">
            <svg className="inline h-3.5 w-3.5 -mt-0.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            Jump to:
          </span>
          {fileSections.map((sec, i) => (
            <button
              key={`${sec.name}-${i}`}
              type="button"
              onClick={() => scrollToFile(sec.name)}
              className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                activeFile === sec.name
                  ? "bg-sandy text-white shadow-sm"
                  : "bg-slate-100 text-gunmetal-light hover:bg-sandy/15 hover:text-sandy-dark"
              }`}
            >
              {sec.name}
            </button>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={parsedContent}
        onChange={handleChange}
        readOnly={isParsing}
        onScroll={handleScroll}
        className={`w-full h-[500px] rounded-xl border p-4 text-sm font-mono text-gunmetal-light resize-y focus:outline-none focus:ring-2 focus:ring-sandy/50 focus:border-sandy ${
          isParsing
            ? "border-blue-200 bg-slate-50 cursor-default"
            : "border-silver-light bg-white"
        }`}
      />
    </div>
  );
}
