"use client";

import { useCallback, useState } from "react";
import { useAppStore } from "@/app/lib/store";
import StatusMessage from "@/app/components/shared/StatusMessage";

export default function FaissStatus() {
  const apiBase = useAppStore((s) => s.faissApiBase);
  const setApiBase = useAppStore((s) => s.setFaissApiBase);

  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [checking, setChecking] = useState(false);
  const [showExample, setShowExample] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    setStatus("idle");
    setMessage("");

    try {
      const base = apiBase.replace(/\/+$/, "");
      const res = await fetch(`${base}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("ok");
      setMessage("FAISS server is reachable");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  }, [apiBase]);

  const dockerCmd = `docker compose up faiss -d`;
  const manualCmd = `cd backend && uv run uvicorn app.faiss_server:app --reload --port 8010`;

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
        FAISS Server Status
      </summary>

      <div className="mt-3 space-y-2 p-3 rounded-lg bg-config-bg border border-config-border">
        <div className="flex items-center justify-between">
          <label className="block text-xs text-gunmetal-light">FAISS FastAPI URL</label>
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
          value={apiBase}
          onChange={(e) => setApiBase(e.target.value)}
          placeholder="http://localhost:8010"
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
            <span className="font-semibold">{message}</span>
          </StatusMessage>
        )}

        {status === "error" && (
          <StatusMessage type="error" label="Error:">
            {message || "FAISS server is not reachable"}
          </StatusMessage>
        )}

        <div className="mt-1">
          <button
            type="button"
            onClick={() => setShowExample((v) => !v)}
            className="text-[10px] text-sandy hover:underline cursor-pointer"
          >
            {showExample ? "Hide launch command" : "Show launch command"}
          </button>
          {showExample && (
            <div className="mt-2 space-y-2">
              <p className="text-[9px] text-gunmetal-light font-medium uppercase tracking-wider">Docker Compose</p>
              <div className="p-2 bg-slate-900 rounded text-[10px] font-mono text-slate-300 break-all select-auto whitespace-pre-wrap">
                {dockerCmd}
              </div>
              <p className="text-[9px] text-gunmetal-light font-medium uppercase tracking-wider">Standalone</p>
              <div className="p-2 bg-slate-900 rounded text-[10px] font-mono text-slate-300 break-all select-auto whitespace-pre-wrap">
                {manualCmd}
              </div>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
