"use client";

import { useState, useCallback } from "react";
import { useAppStore } from "@/app/lib/store";

export default function OllamaStatus() {
  const endpoint = useAppStore((s) => s.ollamaEndpoint);
  const setEndpoint = useAppStore((s) => s.setOllamaEndpoint);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [models, setModels] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    setStatus("idle");
    setModels([]);

    try {
      // Check if Ollama is running (GET / returns "Ollama is running")
      const healthRes = await fetch(endpoint, {
        signal: AbortSignal.timeout(5000),
      });
      if (!healthRes.ok) {
        setStatus("error");
        setChecking(false);
        return;
      }

      setStatus("ok");

      // List models via /api/tags
      try {
        const tagsRes = await fetch(`${endpoint}/api/tags`, {
          signal: AbortSignal.timeout(10000),
        });
        if (tagsRes.ok) {
          const json = await tagsRes.json();
          const names = ((json.models ?? []) as { name: string }[]).map(
            (m) => m.name,
          );
          setModels(names);
        }
      } catch {
        /* models fetch optional */
      }
    } catch {
      // Try /api/tags as fallback
      try {
        const tagsRes = await fetch(`${endpoint}/api/tags`, {
          signal: AbortSignal.timeout(5000),
        });
        if (tagsRes.ok) {
          const json = await tagsRes.json();
          const names = ((json.models ?? []) as { name: string }[]).map(
            (m) => m.name,
          );
          setModels(names);
          setStatus("ok");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
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
        Ollama Server Status
      </summary>

      <div className="mt-3 space-y-2 p-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-silver-light/50">
        <label className="block text-xs text-gunmetal-light">
          Ollama endpoint
        </label>
        <input
          type="text"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          className="w-full rounded-lg border border-silver px-3 py-1.5 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
        />
        <button
          onClick={check}
          disabled={checking}
          className="w-full rounded-lg bg-sandy px-3 py-1.5 text-sm font-medium text-white hover:bg-sandy-light active:bg-sandy-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          {checking ? "Checking…" : "Check"}
        </button>

        {status === "ok" && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-700">
            <span className="font-semibold">&#x2714; Ollama server is running</span>
            {models.length > 0 && (
              <ul className="mt-1 ml-4 list-disc">
                {models.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {status === "error" && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-700">
            Ollama server not reachable at <code>{endpoint}</code>
          </div>
        )}
      </div>
    </details>
  );
}
