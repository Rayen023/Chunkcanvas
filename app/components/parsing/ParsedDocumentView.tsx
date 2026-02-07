"use client";

import { useAppStore } from "@/app/lib/store";

export default function ParsedDocumentView() {
  const parsedContent = useAppStore((s) => s.parsedContent);

  if (!parsedContent) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gunmetal">Parsed Document</h2>
      <textarea
        readOnly
        value={parsedContent}
        className="w-full h-[500px] rounded-xl border border-silver-light bg-white p-4 text-sm font-mono text-gunmetal-light resize-y focus:outline-none"
      />
    </div>
  );
}
