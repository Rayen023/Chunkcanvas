"use client";

import { useCallback, useState } from "react";
import { useAppStore } from "@/app/lib/store";
import StatusMessage from "@/app/components/shared/StatusMessage";

export default function ChromaStatus() {
  const localUrl = useAppStore((s) => s.chromaLocalUrl);
  const setLocalUrl = useAppStore((s) => s.setChromaLocalUrl);

  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [checking, setChecking] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    setStatus("idle");
    setMessage("");

    try {
      const base = localUrl.replace(/\/+$/, "");
      const res = await fetch(`${base}/api/v1/heartbeat`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("ok");
      setMessage("Chroma server is reachable");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  }, [localUrl]);

  const getPort = (url: string) => {
    try {
      const p = new URL(url).port;
      return p || (url.startsWith("https") ? "443" : "8002");
    } catch {
      return "8002";
    }
  };

  const launchCommand = `cd backend && source .venv/bin/activate && uv run chroma run --host localhost --port ${getPort(localUrl)} --path ./my_chroma_data`;

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-semibold text-gunmetal flex items-center gap-2">
        <svg
          className="h-4 w-4 transition-transform group-open:rotate-90"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Chroma Server Status
      </summary>

      <div className="mt-3 space-y-2 p-3 rounded-lg bg-config-bg border border-config-border">
        <div className="flex items-center justify-between">
          <label className="block text-xs text-gunmetal-light">Chroma URL</label>
          <button
            onClick={check}
            disabled={checking}
            className="text-xs text-sandy hover:text-sandy-dark cursor-pointer disabled:opacity-50 flex items-center gap-1"
          >
            {checking ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <input
          type="text"
          value={localUrl}
          onChange={(e) => setLocalUrl(e.target.value)}
          placeholder="http://localhost:8002"
          className="w-full rounded-lg border border-silver bg-card text-gunmetal px-3 py-1.5 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
        />

        <button
          onClick={check}
          disabled={checking}
          className="w-full rounded-lg bg-sandy px-3 py-1.5 text-sm font-medium text-white hover:bg-sandy-light active:bg-sandy-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          {checking ? "Checking…" : "Check Connection"}
        </button>

        {status === "ok" && (
          <StatusMessage type="success" label="Success:">
            <span className="font-semibold">&#x2714; {message}</span>
          </StatusMessage>
        )}

        {status === "error" && (
          <StatusMessage type="error" label="Error:">
            {message || "Chroma is not reachable"}
          </StatusMessage>
        )}

        <div className="mt-1">
          <button
            type="button"
            onClick={() => setShowExamples((v) => !v)}
            className="text-[10px] text-sandy hover:underline cursor-pointer"
          >
            {showExamples ? "Hide launch command" : "Show launch command"}
          </button>
          {showExamples && (
            <div className="mt-1 p-2 bg-slate-900 rounded text-[10px] font-mono text-slate-300 break-all select-auto whitespace-pre-wrap">
              {launchCommand}
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
