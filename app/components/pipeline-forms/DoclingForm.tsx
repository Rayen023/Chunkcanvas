"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/app/lib/store";
import { DEFAULT_VLLM_ENDPOINT, DEFAULT_DOCLING_ENDPOINT, GRANITE_DOCLING_MODEL, VLLM_RECOMMENDED_MODELS } from "@/app/lib/constants";

export default function DoclingForm({ ext }: { ext: string }) {
  const config = useAppStore((s) => s.configByExt[ext]);
  const setConfigForExt = useAppStore((s) => s.setConfigForExt);

  const vllmEndpoint = config?.vllmEndpoint ?? DEFAULT_VLLM_ENDPOINT;
  const doclingEndpoint = config?.doclingEndpoint ?? DEFAULT_DOCLING_ENDPOINT;

  const setVllmEndpoint = useCallback((v: string) => setConfigForExt(ext, { vllmEndpoint: v }), [ext, setConfigForExt]);
  const setDoclingEndpoint = useCallback((v: string) => setConfigForExt(ext, { doclingEndpoint: v }), [ext, setConfigForExt]);

  const [vllmStatus, setVllmStatus] = useState<"idle" | "ok" | "model_missing" | "error">("idle");
  const [doclingStatus, setDoclingStatus] = useState<"idle" | "ok" | "error">("idle");
  const [checkingVllm, setCheckingVllm] = useState(false);
  const [checkingDocling, setCheckingDocling] = useState(false);

  const checkVllm = useCallback(async () => {
    setCheckingVllm(true);
    setVllmStatus("idle");
    try {
      const res = await fetch(`${vllmEndpoint}/v1/models`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const models = (json.data ?? []) as { id: string }[];
      
      if (models.some(m => m.id === GRANITE_DOCLING_MODEL)) {
        setVllmStatus("ok");
      } else {
        setVllmStatus("model_missing");
      }
    } catch {
      setVllmStatus("error");
    } finally {
      setCheckingVllm(false);
    }
  }, [vllmEndpoint]);

  const checkDocling = useCallback(async () => {
    setCheckingDocling(true);
    setDoclingStatus("idle");
    try {
      const base = doclingEndpoint.replace(/\/+$/, "");
      const res = await fetch(`${base}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error();
      setDoclingStatus("ok");
    } catch {
      setDoclingStatus("error");
    } finally {
      setCheckingDocling(false);
    }
  }, [doclingEndpoint]);

  useEffect(() => {
    checkVllm();
    checkDocling();
  }, [checkVllm, checkDocling]);

  const [showExample, setShowExample] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-sandy/30 bg-sandy/5 p-3 space-y-3">
        <div className="flex items-start gap-2">
          <svg className="h-4 w-4 flex-shrink-0 mt-0.5 text-sandy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <div className="text-xs text-gunmetal">
            <p className="font-medium text-sandy">IBM Granite Docling Pipeline</p>
            <p className="mt-0.5 text-silver-dark">
              This pipeline uses the IBM Granite Docling 258M model for high-fidelity document parsing.
              It requires both a vLLM server (for inference) and a Docling server (for orchestration).
            </p>
          </div>
        </div>
      </div>

      {/* vLLM Endpoint */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gunmetal">
            vLLM Endpoint
          </label>
          <button
            onClick={checkVllm}
            disabled={checkingVllm}
            className="text-xs text-sandy hover:text-sandy-dark cursor-pointer disabled:opacity-50"
          >
            {checkingVllm ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <input
          type="text"
          value={vllmEndpoint}
          onChange={(e) => setVllmEndpoint(e.target.value)}
          placeholder={DEFAULT_VLLM_ENDPOINT}
          className="w-full rounded-lg border border-silver bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
        />
        {vllmStatus === "ok" && (
          <p className="mt-1 text-[10px] text-green-600 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
            vLLM reachable & model loaded
          </p>
        )}
        {vllmStatus === "model_missing" && (
          <p className="mt-1 text-[10px] text-amber-600 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
            vLLM reachable, but model not found ({GRANITE_DOCLING_MODEL})
          </p>
        )}
        {vllmStatus === "error" && (
          <p className="mt-1 text-[10px] text-red-600 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
            Could not reach vLLM
          </p>
        )}
      </div>

      {/* Docling Endpoint */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gunmetal">
            Docling Server Endpoint
          </label>
          <button
            onClick={checkDocling}
            disabled={checkingDocling}
            className="text-xs text-sandy hover:text-sandy-dark cursor-pointer disabled:opacity-50"
          >
            {checkingDocling ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <input
          type="text"
          value={doclingEndpoint}
          onChange={(e) => setDoclingEndpoint(e.target.value)}
          placeholder={DEFAULT_DOCLING_ENDPOINT}
          className="w-full rounded-lg border border-silver bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
        />
        {doclingStatus === "ok" && (
          <p className="mt-1 text-[10px] text-green-600 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
            Docling server is reachable
          </p>
        )}
        {doclingStatus === "error" && (
          <p className="mt-1 text-[10px] text-red-600 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
            Could not reach Docling server
          </p>
        )}
      </div>

      <div className="mt-4">
        <button
          onClick={() => setShowExample(!showExample)}
          className="text-[10px] text-sandy hover:underline cursor-pointer"
        >
          {showExample ? "Hide launch commands" : "Show launch commands"}
        </button>
        {showExample && (
          <div className="mt-2 space-y-3">
            <div>
              <p className="text-[10px] font-medium text-gunmetal mb-1 uppercase tracking-wider">Docker Compose (Docling server)</p>
              <div className="p-2 bg-slate-900 rounded text-[10px] font-mono text-slate-300 break-all select-auto whitespace-pre-wrap">
                docker compose up docling -d
              </div>
            </div>
            <div>
              <p className="text-[10px] font-medium text-gunmetal mb-1 uppercase tracking-wider">Standalone (requires vLLM running)</p>
              <div className="p-2 bg-slate-900 rounded text-[10px] font-mono text-slate-300 break-all select-auto whitespace-pre-wrap">
                vllm serve {GRANITE_DOCLING_MODEL} --port {VLLM_RECOMMENDED_MODELS.docling.port}
              </div>
              <div className="mt-1 p-2 bg-slate-900 rounded text-[10px] font-mono text-slate-300 break-all select-auto whitespace-pre-wrap">
                cd backend && uv run uvicorn app.docling_server:app --reload --port 8020
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
