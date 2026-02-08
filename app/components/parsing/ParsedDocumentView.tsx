"use client";

import { useAppStore } from "@/app/lib/store";
import { useMemo, useState, useEffect } from "react";

export default function ParsedDocumentView() {
  const parsedContent = useAppStore((s) => s.parsedContent);
  const setParsedContent = useAppStore((s) => s.setParsedContent);
  const [showSaved, setShowSaved] = useState(false);

  // Hide the "Saved" indicator after 2 seconds
  useEffect(() => {
    if (showSaved) {
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showSaved]);

  const wordCount = useMemo(() => {
    if (!parsedContent) return 0;
    const words = parsedContent.trim().split(/\s+/);
    return words.length === 1 && words[0] === "" ? 0 : words.length;
  }, [parsedContent]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setParsedContent(e.target.value);
    setShowSaved(true);
  };

  if (!parsedContent) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gunmetal">Parsed Document</h2>
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
          <span className="text-xs text-silver-dark bg-silver-light/50 px-2 py-0.5 rounded-full">
            {wordCount.toLocaleString()} words
          </span>
        </div>
      </div>
      <textarea
        value={parsedContent}
        onChange={handleChange}
        className="w-full h-[500px] rounded-xl border border-silver-light bg-white p-4 text-sm font-mono text-gunmetal-light resize-y focus:outline-none focus:ring-2 focus:ring-sandy/50 focus:border-sandy"
      />
    </div>
  );
}
