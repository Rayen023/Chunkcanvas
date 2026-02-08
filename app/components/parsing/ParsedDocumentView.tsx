"use client";

import { useAppStore } from "@/app/lib/store";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";

export default function ParsedDocumentView() {
  const parsedContent = useAppStore((s) => s.parsedContent);
  const setParsedContent = useAppStore((s) => s.setParsedContent);
  const isParsing = useAppStore((s) => s.isParsing);
  const [showSaved, setShowSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevLenRef = useRef(0);
  const userScrolledRef = useRef(false);

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
