import { useSyncExternalStore } from "react";

const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^\[::1\]$/,
  /^0\.0\.0\.0$/,
];

function isPrivateHostname(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some((re) => re.test(hostname));
}

type DeploymentMode = "auto" | "local" | "cloud";

function getDeploymentMode(): DeploymentMode {
  const env = (process.env.NEXT_PUBLIC_DEPLOYMENT_MODE ?? "auto")
    .toLowerCase()
    .trim();
  if (env === "local" || env === "cloud") return env;
  return "auto";
}

function computeIsLocal(): boolean {
  const mode = getDeploymentMode();
  if (mode === "local") return true;
  if (mode === "cloud") return false;

  if (typeof window === "undefined") return true;
  return isPrivateHostname(window.location.hostname);
}

let _cachedIsLocal: boolean | null = null;

function getIsLocal(): boolean {
  if (_cachedIsLocal === null) {
    _cachedIsLocal = computeIsLocal();
  }
  return _cachedIsLocal;
}

function subscribe(): () => void {
  return () => {};
}

export function useIsLocalMode(): boolean {
  return useSyncExternalStore(subscribe, getIsLocal, () => true);
}

export { getIsLocal as isLocalMode };

export const LOCAL_PIPELINE_IDS = new Set([
  "Ollama — PDF Parsing (Local Vision LLM)",
  "Ollama — Image Parsing (Local Vision LLM)",
  "vLLM — PDF Parsing (Local Vision LLM)",
  "vLLM — Image Parsing (Local Vision LLM)",
  "vLLM — Audio Transcription (OpenAI-compatible)",
  "vLLM — Video Understanding (Local Video LLM)",
  "Docling — PDF Parsing (IBM Granite Docling)",
]);

export const LOCAL_EMBEDDING_PROVIDER_IDS = new Set(["ollama", "vllm"]);

export const LOCAL_VECTOR_DB_IDS = new Set(["faiss"]);

export const CHROMA_DB_ID = "chroma";
