"use client";

import { useState, useCallback } from "react";
import { useAppStore } from "@/app/lib/store";
import StatusMessage from "@/app/components/shared/StatusMessage";
import { VLLM_RECOMMENDED_MODELS } from "@/app/lib/constants";

type EndpointStatus = {
  status: "idle" | "ok" | "error";
  models: { id: string; max_model_len?: number }[];
};

export default function VllmStatus() {
  const endpoint = useAppStore((s) => s.vllmEndpoint);
  const setEndpoint = useAppStore((s) => s.setVllmEndpoint);
  const additionalEndpoints = useAppStore((s) => s.vllmAdditionalEndpoints);
  const setAdditionalEndpoints = useAppStore((s) => s.setVllmAdditionalEndpoints);

  const [statuses, setStatuses] = useState<Record<string, EndpointStatus>>({});
  const [checking, setChecking] = useState(false);

  const getLaunchCommands = () => {
    return Object.values(VLLM_RECOMMENDED_MODELS).map((rec: { model: string; port: number; extraFlags?: string; description: string }) => {
      const flags = rec.extraFlags ? ` ${rec.extraFlags}` : "";
      return {
        label: rec.description,
        cmd: `vllm serve ${rec.model} --port ${rec.port}${flags}`
      };
    });
  };

  const launchCommands = getLaunchCommands();

  const checkOne = async (url: string): Promise<EndpointStatus> => {
    if (!url) return { status: "idle", models: [] };
    
    // Normalize URL
    const cleanUrl = url.replace(/\/+$/, "");
    
    try {
      // Try /health first
      const healthRes = await fetch(`${cleanUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      
      if (healthRes.ok) {
        // Try to list models
        try {
          const modelsRes = await fetch(`${cleanUrl}/v1/models`, {
            signal: AbortSignal.timeout(5000),
          });
          if (modelsRes.ok) {
            const json = await modelsRes.json();
            return {
              status: "ok",
              models: (json.data ?? []).map(
                (m: { id: string; max_model_len?: number }) => ({
                  id: m.id,
                  max_model_len: m.max_model_len,
                }),
              ),
            };
          }
        } catch {
          /* Models fetch optional */
        }
        return { status: "ok", models: [] };
      }
    } catch {
      /* health endpoint failed, try models directly */
    }

    try {
      const modelsRes = await fetch(`${cleanUrl}/v1/models`, {
        signal: AbortSignal.timeout(5000),
      });
      if (modelsRes.ok) {
        const json = await modelsRes.json();
        return {
          status: "ok",
          models: (json.data ?? []).map(
            (m: { id: string; max_model_len?: number }) => ({
              id: m.id,
              max_model_len: m.max_model_len,
            }),
          ),
        };
      }
    } catch {
      // both failed
    }

    return { status: "error", models: [] };
  };

  const checkAll = useCallback(async () => {
    setChecking(true);
    setStatuses({});

    const allUrls = [endpoint, ...additionalEndpoints].filter((url) => url.trim().length > 0);
    // Deduplicate logic if needed, but keeping separate is fine for explicit checks

    const results: Record<string, EndpointStatus> = {};
    
    await Promise.all(
      allUrls.map(async (url) => {
        results[url] = await checkOne(url);
      })
    );

    setStatuses(results);
    setChecking(false);
  }, [endpoint, additionalEndpoints]);

  const addEndpoint = () => {
    // 1. Determine the "reference" endpoint (last one added or the primary one)
    const lastEndpoint =
      additionalEndpoints.length > 0
        ? additionalEndpoints[additionalEndpoints.length - 1]
        : endpoint;

    let nextEndpoint = "";

    try {
      // 2. Parse the reference endpoint
      const url = new URL(lastEndpoint);
      // 3. Extract and increment the port
      const currentPort = parseInt(url.port || (url.protocol === "https:" ? "443" : "80"), 10);
      
      if (!isNaN(currentPort)) {
        url.port = (currentPort + 1).toString();
        nextEndpoint = url.toString().replace(/\/$/, "");
      } else {
        // Fallback if port parsing fails but URL is valid-ish
        nextEndpoint = lastEndpoint;
      }
    } catch {
      // Fallback for invalid URLs or simple strings
      nextEndpoint = lastEndpoint; 
    }
    
    // Remove trailing slash if the URL constructor added it and the original didn't have it, 
    // or just leave it standard. new URL() usually adds a trailing slash.
    // Let's strip it to be cleaner if the user input didn't have it, but standard is fine.
    // For simplicity, we just use the string.
    
    setAdditionalEndpoints([...additionalEndpoints, nextEndpoint]);
  };

  const removeEndpoint = (index: number) => {
    const next = [...additionalEndpoints];
    next.splice(index, 1);
    setAdditionalEndpoints(next);
  };

  const updateAdditionalEndpoint = (index: number, val: string) => {
    const next = [...additionalEndpoints];
    next[index] = val;
    setAdditionalEndpoints(next);
  };

  const [showCommands, setShowCommands] = useState(false);

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
        vLLM Server Status
      </summary>

      <div className="mt-3 space-y-2 p-3 rounded-lg bg-config-bg border border-config-border">
        <div className="flex items-center justify-between">
          <label className="block text-xs text-gunmetal-light">
            vLLM endpoints
          </label>
          <button
            onClick={checkAll}
            disabled={checking}
            className="text-xs text-sandy hover:text-sandy-dark cursor-pointer disabled:opacity-50 flex items-center gap-1"
          >
            {checking ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        
        {/* Main Endpoint */}
        <div className="flex gap-2">
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="Primary endpoint (e.g. http://localhost:8000)"
            className="flex-1 rounded-lg border border-silver bg-card text-gunmetal px-3 py-1.5 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none min-w-0"
          />
          <button
            onClick={addEndpoint}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-sandy text-white hover:bg-sandy-light active:bg-sandy-dark transition-colors"
            title="Add another vLLM server"
          >
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Additional Endpoints */}
        {additionalEndpoints.map((ep, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={ep}
              onChange={(e) => updateAdditionalEndpoint(i, e.target.value)}
              placeholder="Additional endpoint"
              className="flex-1 rounded-lg border border-silver bg-card text-gunmetal px-3 py-1.5 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none min-w-0"
            />
            <button
              onClick={() => removeEndpoint(i)}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
              title="Remove endpoint"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        <div className="mt-3">
          <button
            onClick={() => setShowCommands(!showCommands)}
            className="text-[10px] text-sandy hover:underline cursor-pointer"
          >
            {showCommands ? "Hide recommended commands" : "Show recommended commands"}
          </button>
          {showCommands && (
            <div className="mt-2 space-y-2">
              {launchCommands.map((item, i) => (
                <div key={i}>
                  <p className="text-[9px] font-medium text-gunmetal-light mb-0.5 uppercase tracking-tighter">{item.label}</p>
                  <div className="p-2 bg-slate-900 rounded text-[10px] font-mono text-slate-300 break-all select-auto whitespace-pre-wrap">
                    {item.cmd}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={checkAll}
          disabled={checking}
          className="w-full rounded-lg bg-sandy px-3 py-1.5 text-sm font-medium text-white hover:bg-sandy-light active:bg-sandy-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          {checking ? "Checking All..." : "Check Connections"}
        </button>

        {/* Status Display */}
        <div className="space-y-2 pt-2">
          {[endpoint, ...additionalEndpoints].map((url, idx) => {
             if (!url) return null;
             const st = statuses[url];
             if (!st || st.status === "idle") return null;

             if (st.status === "ok") {
               return (
                 <StatusMessage key={`${url}-${idx}`} type="success" label="Success:" className="break-all">
                   <div className="font-bold mb-1">{url}</div>
                   {st.models.length > 0 && (
                     <ul className="ml-4 list-disc opacity-90">
                       {st.models.map((m) => (
                         <li key={m.id}>
                           {m.id} {m.max_model_len ? `(ctx: ${m.max_model_len})` : ""}
                         </li>
                       ))}
                     </ul>
                   )}
                 </StatusMessage>
               );
             } else {
               return (
                 <StatusMessage key={`${url}-${idx}`} type="error" label="Error:" className="break-all">
                   <div className="font-bold mb-1">{url}</div>
                   <div className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>Not reachable</span>
                   </div>
                 </StatusMessage>
               );
             }
          })}
        </div>

      </div>
    </details>
  );
}
