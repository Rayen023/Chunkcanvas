"use client";

import { useCallback, useState } from "react";
import { useAppStore } from "@/app/lib/store";
import StatusMessage from "@/app/components/shared/StatusMessage";

export default function DoclingStatus() {
  const endpoint = useAppStore((s) => s.doclingEndpoint);
  const setEndpoint = useAppStore((s) => s.setDoclingEndpoint);

  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    setStatus("idle");

    try {
      const base = endpoint.replace(/\/+$/, "");
      const res = await fetch(`${base}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("ok");
    } catch {
      setStatus("error");
    }

    setChecking(false);
  }, [endpoint]);

  const dockerCmd = `docker compose up docling -d`;
  const manualCmd = `cd backend && uv run uvicorn app.docling_server:app --reload --port 8020`;

  const [showExample, setShowExample] = useState(false);

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
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5l7 7-7 7"
          />
        </svg>
        Docling Server Status
      </summary>

      <div className="mt-3 space-y-2 p-3 rounded-lg bg-config-bg border border-config-border">
        <div className="flex items-center justify-between">
          <label className="block text-xs text-gunmetal-light">
            Docling endpoint
          </label>
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
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
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
          <StatusMessage type="success" label="Connected">
            Docling backend server is reachable (serve ibm-granite/granite-docling-258M via vLLM)
          </StatusMessage>
        )}
        {status === "error" && (
          <StatusMessage type="error" label="Offline">
            Could not reach {endpoint}
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
