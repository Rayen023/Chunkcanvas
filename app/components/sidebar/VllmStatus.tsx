"use client";

import { useState, useCallback } from "react";
import { useAppStore } from "@/app/lib/store";

export default function VllmStatus() {
  const endpoint = useAppStore((s) => s.vllmEndpoint);
  const setEndpoint = useAppStore((s) => s.setVllmEndpoint);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [models, setModels] = useState<{ id: string; max_model_len?: number }[]>([]);
  const [checking, setChecking] = useState(false);
  const [showExample, setShowExample] = useState(false);

  const exampleCommand = `vllm serve ${models[0]?.id || "model_name"} --port ${endpoint ? new URL(endpoint).port : "8000"}`;

  const check = useCallback(async () => {
    setChecking(true);
    setStatus("idle");
    setModels([]);

    try {
      // Try /health first
      const healthRes = await fetch(`${endpoint}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (healthRes.ok) {
        setStatus("ok");
        // Also try to list models
        try {
          const modelsRes = await fetch(`${endpoint}/v1/models`, {
            signal: AbortSignal.timeout(5000),
          });
          if (modelsRes.ok) {
            const json = await modelsRes.json();
            setModels(
              (json.data ?? []).map(
                (m: { id: string; max_model_len?: number }) => ({
                  id: m.id,
                  max_model_len: m.max_model_len,
                }),
              ),
            );
          }
        } catch {
          /* Models fetch optional */
        }
        setChecking(false);
        return;
      }
    } catch {
      /* health endpoint failed, try models */
    }

    try {
      const modelsRes = await fetch(`${endpoint}/v1/models`, {
        signal: AbortSignal.timeout(5000),
      });
      if (modelsRes.ok) {
        const json = await modelsRes.json();
        setModels(
          (json.data ?? []).map((m: { id: string; max_model_len?: number }) => ({
            id: m.id,
            max_model_len: m.max_model_len,
          })),
        );
        setStatus("ok");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }

    setChecking(false);
  }, [endpoint]);

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-semibold text-gunmetal select-none flex items-center gap-2">
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
        vLLM Server Status
      </summary>

      <div className="mt-3 space-y-2">
        <label className="block text-xs text-gunmetal-light">
          vLLM endpoint
        </label>
        <input
          type="text"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          className="w-full rounded-lg border border-silver px-3 py-1.5 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
        />
        <div className="mt-1">
          <button
            onClick={() => setShowExample(!showExample)}
            className="text-[10px] text-sandy hover:underline cursor-pointer"
          >
            {showExample ? "Hide example command" : "Show example command"}
          </button>
          {showExample && (
            <div className="mt-1 p-2 bg-slate-900 rounded text-[10px] font-mono text-slate-300 break-all select-all">
              {exampleCommand}
            </div>
          )}
        </div>
        <button
          onClick={check}
          disabled={checking}
          className="w-full rounded-lg bg-sandy px-3 py-1.5 text-sm font-medium text-white hover:bg-sandy-light active:bg-sandy-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          {checking ? "Checking…" : "Check"}
        </button>

        {status === "ok" && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-700">
            <span className="font-semibold">&#x2714; vLLM server is healthy</span>
            {models.length > 0 && (
              <ul className="mt-1 ml-4 list-disc">
                {models.map((m) => (
                  <li key={m.id}>
                    {m.id} {m.max_model_len ? `(ctx: ${m.max_model_len})` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {status === "error" && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-700">
            vLLM server not reachable at <code>{endpoint}</code>
          </div>
        )}
      </div>
    </details>
  );
}
