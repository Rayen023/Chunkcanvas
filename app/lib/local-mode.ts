/**
 * Local-mode detection for ChunkCanvas.
 *
 * Determines whether the user is accessing from a local network (self-hosted)
 * or remotely (e.g. via Cloudflare Tunnel). This drives which providers are
 * available in the UI:
 *
 *   • Local mode  → all providers (Ollama, vLLM, Docling, FAISS, ChromaDB local, + cloud)
 *   • Cloud mode  → cloud-only providers (OpenRouter, Voyage, Cohere, Pinecone, MongoDB Atlas, ChromaDB Cloud)
 *
 * Detection:
 *   1. `NEXT_PUBLIC_DEPLOYMENT_MODE` env var: "local" | "cloud" | "auto" (default).
 *   2. When "auto", checks `window.location.hostname` against localhost / private IPs.
 *
 * Usage:
 *   import { useIsLocalMode } from "@/app/lib/local-mode";
 *   const isLocal = useIsLocalMode();
 */

import { useSyncExternalStore } from "react";

// ── Hostname → local check ─────────────────────────────────────────────

const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,                       // 127.0.0.0/8
  /^10\./,                        // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./,  // 172.16.0.0/12
  /^192\.168\./,                  // 192.168.0.0/16
  /^\[::1\]$/,                    // IPv6 loopback
  /^0\.0\.0\.0$/,                 // all interfaces
];

function isPrivateHostname(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some((re) => re.test(hostname));
}

// ── Deployment mode from env ────────────────────────────────────────────

type DeploymentMode = "auto" | "local" | "cloud";

function getDeploymentMode(): DeploymentMode {
  const env = (process.env.NEXT_PUBLIC_DEPLOYMENT_MODE ?? "auto").toLowerCase().trim();
  if (env === "local" || env === "cloud") return env;
  return "auto";
}

// ── Core detection (runs in browser only) ───────────────────────────────

function computeIsLocal(): boolean {
  const mode = getDeploymentMode();
  if (mode === "local") return true;
  if (mode === "cloud") return false;

  // "auto" — detect from hostname
  if (typeof window === "undefined") return true; // SSR fallback: assume local
  return isPrivateHostname(window.location.hostname);
}

// Cache the result — hostname doesn't change during a session.
let _cachedIsLocal: boolean | null = null;

function getIsLocal(): boolean {
  if (_cachedIsLocal === null) {
    _cachedIsLocal = computeIsLocal();
  }
  return _cachedIsLocal;
}

// Stub for useSyncExternalStore — value never changes after mount.
function subscribe(): () => void {
  return () => {};
}

// ── React hook ──────────────────────────────────────────────────────────

/**
 * Returns `true` when the app is accessed from a local/private network,
 * `false` when accessed remotely (e.g. via a tunnel or public domain).
 *
 * Safe for SSR — returns `true` on the server to avoid hydration mismatch
 * (local is the "more capable" default).
 */
export function useIsLocalMode(): boolean {
  return useSyncExternalStore(subscribe, getIsLocal, () => true);
}

/**
 * Non-hook version for use outside React components.
 */
export { getIsLocal as isLocalMode };

// ── Provider classification helpers ─────────────────────────────────────

/** Parsing pipeline IDs that require local services */
export const LOCAL_PIPELINE_IDS = new Set([
  "Ollama — PDF Parsing (Local Vision LLM)",
  "Ollama — Image Parsing (Local Vision LLM)",
  "vLLM — PDF Parsing (Local Vision LLM)",
  "vLLM — Image Parsing (Local Vision LLM)",
  "vLLM — Audio Transcription (OpenAI-compatible)",
  "vLLM — Video Understanding (Local Video LLM)",
  "Docling — PDF Parsing (IBM Granite Docling)",
]);

/** Embedding provider IDs that require local services */
export const LOCAL_EMBEDDING_PROVIDER_IDS = new Set(["ollama", "vllm"]);

/** Vector DB provider IDs that require local services */
export const LOCAL_VECTOR_DB_IDS = new Set(["faiss"]);

/**
 * ChromaDB is hybrid — "local" mode needs a local server,
 * "cloud" mode works remotely. We handle this separately.
 */
export const CHROMA_DB_ID = "chroma";
