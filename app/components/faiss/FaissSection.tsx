"use client";

import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { useAppStore } from "@/app/lib/store";
import StatusMessage from "@/app/components/shared/StatusMessage";
import type { FaissMetric } from "@/app/lib/types";

type FaissRecord = {
  id: number;
  text: string;
  metadata: Record<string, unknown>;
  embedding_preview: number[];
};

type FaissContentResponse = {
  db_path: string;
  total: number;
  metric: FaissMetric;
  dimension: number;
  items: FaissRecord[];
};

type FaissIndexEntry = {
  name: string;
  db_path: string;
};

const METRIC_OPTIONS: Array<{ value: FaissMetric; label: string; help: string }> = [
  {
    value: "cosine",
    label: "Cosine Similarity",
    help: "Compares vector direction and ignores magnitude. Best default for most embedding models.",
  },
  {
    value: "l2",
    label: "Euclidean Distance (L2)",
    help: "Measures straight-line distance in vector space. Lower distance means more similar.",
  },
  {
    value: "ip",
    label: "Inner Product (Dot Product)",
    help: "Uses vector dot product. Useful when magnitude should influence similarity.",
  },
];

function sanitizeDbName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[._-]+|[._-]+$/g, "");
}

function hashId(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2147483647;
}

export default function FaissSection() {
  const editedChunks = useAppStore((s) => s.editedChunks);
  const chunkSourceFiles = useAppStore((s) => s.chunkSourceFiles);
  const embeddingsData = useAppStore((s) => s.embeddingsData);
  const chunksHash = useAppStore((s) => s.chunksHash);
  const embeddingsForChunksHash = useAppStore((s) => s.embeddingsForChunksHash);
  const parsedFilename = useAppStore((s) => s.parsedFilename);

  const faissApiBase = useAppStore((s) => s.faissApiBase);
  const setFaissApiBase = useAppStore((s) => s.setFaissApiBase);
  const indexesDir = useAppStore((s) => s.faissIndexesDir);
  const setIndexesDir = useAppStore((s) => s.setFaissIndexesDir);
  const newDbName = useAppStore((s) => s.faissNewDbName);
  const setNewDbName = useAppStore((s) => s.setFaissNewDbName);
  const dbPath = useAppStore((s) => s.faissDbPath);
  const setDbPath = useAppStore((s) => s.setFaissDbPath);
  const dbMode = useAppStore((s) => s.faissDbMode);
  const setDbMode = useAppStore((s) => s.setFaissDbMode);
  const dimension = useAppStore((s) => s.faissDimension);
  const setDimension = useAppStore((s) => s.setFaissDimension);
  const metric = useAppStore((s) => s.faissMetric);
  const setMetric = useAppStore((s) => s.setFaissMetric);

  const hasEmbeddings =
    !!embeddingsData &&
    embeddingsData.length === editedChunks.length &&
    !!embeddingsForChunksHash &&
    embeddingsForChunksHash === chunksHash;

  const [isCreating, setIsCreating] = useState(false);
  const [isUpserting, setIsUpserting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isListing, setIsListing] = useState(false);
  const [showLaunchCommand, setShowLaunchCommand] = useState(false);
  const [offset, setOffset] = useState(0);
  const [availableIndexes, setAvailableIndexes] = useState<FaissIndexEntry[]>([]);
  const [content, setContent] = useState<FaissContentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const didAutoListRef = useRef(false);

  const canUpsert = hasEmbeddings && editedChunks.length > 0;

  const normalizedBase = useMemo(() => faissApiBase.trim().replace(/\/$/, ""), [faissApiBase]);
  const metricHelp = useMemo(() => METRIC_OPTIONS.find((item) => item.value === metric)?.help ?? "", [metric]);
  const newDbPathPreview = useMemo(() => {
    const base = indexesDir.trim().replace(/\/+$/, "");
    const safeName = sanitizeDbName(newDbName.trim());
    if (!base || !safeName) return "";
    return `${base}/${safeName}.faiss`;
  }, [indexesDir, newDbName]);

  const canCreate = !!indexesDir.trim() && !!newDbName.trim() && dimension > 0;

  const getPort = (url: string) => {
    try {
      const p = new URL(url).port;
      return p || (url.startsWith("https") ? "443" : "8010");
    } catch {
      return "8010";
    }
  };

  const launchCommand = `cd backend && source .venv/bin/activate && uv run uvicorn app.faiss_server:app --reload --port ${getPort(faissApiBase)}`;

  const handleListIndexes = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!indexesDir.trim()) return;
    setIsListing(true);
    if (!silent) {
      setError(null);
      setSuccess(null);
    }
    try {
      const params = new URLSearchParams({
        base_dir: indexesDir.trim(),
        recursive: "true",
      });
      const response = await fetch(`${normalizedBase}/faiss/indexes/list?${params.toString()}`, {
        signal: AbortSignal.timeout(5000),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.detail || "Failed to list FAISS indexes");
      }
      const indexes = (json.indexes || []) as FaissIndexEntry[];
      setAvailableIndexes(indexes);

      if (indexes.length > 0) {
        const currentPath = dbPath.trim();
        const exists = indexes.some((entry) => entry.db_path === currentPath);
        if (!exists) {
          setDbPath(indexes[0].db_path);
        }
      }

      if (!silent) {
        if (indexes.length === 0) {
          setSuccess("No indexes found in the selected directory.");
        } else {
          setSuccess(`Found ${indexes.length} indexes.`);
        }
      }
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setIsListing(false);
    }
  }, [dbPath, indexesDir, normalizedBase, setDbPath]);

  useEffect(() => {
    if (didAutoListRef.current) return;
    didAutoListRef.current = true;
    handleListIndexes({ silent: true });
  }, [handleListIndexes]);

  const handleCreate = async () => {
    if (!canCreate) return;
    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        base_dir: indexesDir.trim(),
        db_name: newDbName.trim(),
        dimension,
        metric,
      };

      const response = await fetch(`${normalizedBase}/faiss/indexes/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.detail || "Failed to create FAISS index");
      }

      setSuccess(`Created FAISS index at ${json.db_path}`);
      setDbPath(json.db_path);
      setDbMode("existing");
      await handleListIndexes({ silent: true });
      setContent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpsert = async () => {
    if (!canUpsert || !embeddingsData) return;
    setIsUpserting(true);
    setError(null);
    setSuccess(null);

    try {
      const items = editedChunks.map((text, index) => {
        const source = chunkSourceFiles[index] || parsedFilename || "document";
        const stableId = hashId(`${source}::${index}::${text}`);
        return {
          id: stableId,
          text,
          vector: embeddingsData[index],
          metadata: {
            filename: source,
            chunk_index: index,
          },
        };
      });

      const response = await fetch(`${normalizedBase}/faiss/indexes/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db_path: dbPath.trim(),
          items,
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.detail || "Failed to upsert FAISS records");
      }

      setSuccess(`Upserted ${json.upserted} chunk vectors (${json.total} total).`);
      await handleView(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUpserting(false);
    }
  };

  const handleView = async (newOffset: number = offset) => {
    if (!dbPath.trim()) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const params = new URLSearchParams({
        db_path: dbPath.trim(),
        offset: String(newOffset),
        limit: "25",
        preview_dim: "8",
      });
      const response = await fetch(`${normalizedBase}/faiss/indexes/content?${params.toString()}`);
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.detail || "Failed to load FAISS content");
      }
      setOffset(newOffset);
      setContent(json as FaissContentResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleContent = async () => {
    if (content) {
      setContent(null);
      setOffset(0);
      return;
    }
    await handleView(0);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-silver-light bg-card p-4 space-y-4">
        <h3 className="text-gunmetal font-semibold text-sm">FAISS Local Configuration</h3>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gunmetal">FastAPI URL</label>
              <button
                type="button"
                onClick={() => handleListIndexes()}
                disabled={isListing || !faissApiBase.trim()}
                className="text-xs text-sandy hover:text-sandy-dark cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                Refresh
              </button>
            </div>
            <input
              type="text"
              value={faissApiBase}
              onChange={(e) => setFaissApiBase(e.target.value)}
              placeholder="http://localhost:8010"
              className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
            />
            <div className="mt-1">
              <button
                type="button"
                onClick={() => setShowLaunchCommand((value) => !value)}
                className="text-[10px] text-sandy hover:underline cursor-pointer"
              >
                {showLaunchCommand ? "Hide launch command" : "Show launch command"}
              </button>
              {showLaunchCommand && (
                <div className="mt-1 p-2 bg-slate-900 rounded text-[10px] font-mono text-slate-300 break-all select-auto whitespace-pre-wrap">
                  {launchCommand}
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gunmetal">Indexes Directory</label>
              <button
                type="button"
                onClick={() => handleListIndexes()}
                disabled={isListing || !indexesDir.trim()}
                className="text-xs text-sandy hover:text-sandy-dark cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                Refresh
              </button>
            </div>
            <input
              type="text"
              value={indexesDir}
              onChange={(e) => setIndexesDir(e.target.value)}
              placeholder="/tmp/chunkcanvas"
              className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
            />
            <p className="mt-1 text-[11px] text-silver-dark">Use this folder when creating a new index and for automatic discovery of existing indexes.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {([
            { key: "existing", label: "Use Existing Index" },
            { key: "create", label: "Create New Index" },
          ] as const).map((mode) => {
            const selected = dbMode === mode.key;
            return (
              <button
                key={mode.key}
                type="button"
                onClick={() => setDbMode(mode.key)}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${selected
                  ? "border-sandy bg-sandy/10 text-gunmetal"
                  : "border-silver-light bg-card text-gunmetal-light hover:border-sandy/50"
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>

        {dbMode === "existing" && (
          <div className="space-y-3 rounded-lg border border-silver-light p-3">
            <label className="block text-xs font-medium text-gunmetal">Existing FAISS DB Path</label>
            <input
              type="text"
              value={dbPath}
              onChange={(e) => setDbPath(e.target.value)}
              placeholder="/tmp/chunkcanvas/index.faiss"
              className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
            />
            <p className="text-[11px] text-silver-dark">Paste an existing path directly, or pick one discovered in the selected directory.</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-gunmetal">Discovered Indexes</span>
              <button
                type="button"
                onClick={() => handleListIndexes()}
                disabled={isListing || !indexesDir.trim()}
                className="text-xs text-sandy hover:text-sandy-dark cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                Refresh
              </button>
            </div>
            {availableIndexes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-silver p-3 text-xs text-silver-dark text-center">
                No discovered indexes yet. Click refresh to list indexes from this directory.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableIndexes.map((entry) => {
                  const isSelected = dbPath === entry.db_path;
                  return (
                    <button
                      key={entry.db_path}
                      type="button"
                      onClick={() => setDbPath(entry.db_path)}
                      className={`w-auto text-left rounded-lg border px-3 py-1.5 transition-all duration-150 cursor-pointer flex items-center gap-2 ${isSelected
                        ? "border-sandy bg-sandy/8 ring-2 ring-sandy/30"
                        : "border-silver-light bg-card hover:border-sandy/50 hover:bg-sandy/4"
                      }`}
                      title={entry.db_path}
                    >
                      <span className={`flex-shrink-0 h-3 w-3 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? "border-sandy" : "border-silver"}`}>
                        {isSelected && <span className="h-1 w-1 rounded-full bg-sandy" />}
                      </span>
                      <span className={`text-[11px] font-medium font-mono ${isSelected ? "text-gunmetal" : "text-gunmetal-light"}`}>
                        {entry.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="rounded-lg border border-dashed border-silver px-3 py-2 text-[11px] text-silver-dark break-all bg-config-bg">
              Selected path: {dbPath || "None"}
            </div>
          </div>
        )}

        {dbMode === "create" && (
          <div className="space-y-3 rounded-lg border border-silver-light p-3">
            <div>
              <label className="block text-xs font-medium text-gunmetal mb-1">New Index Name</label>
              <input
                type="text"
                value={newDbName}
                onChange={(e) => setNewDbName(e.target.value)}
                placeholder="index"
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
              />
              <p className="mt-1 text-[11px] text-silver-dark">The final file path is built as directory + name + .faiss.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gunmetal mb-1">Resulting FAISS Path</label>
              <div className="w-full rounded-lg border border-dashed border-silver px-3 py-2 text-xs text-silver-dark bg-config-bg break-all">
                {newDbPathPreview || "Provide both directory and index name to preview the final path."}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gunmetal mb-1">Dimension</label>
                <input
                  type="number"
                  min={1}
                  value={dimension}
                  onChange={(e) => setDimension(Number(e.target.value))}
                  className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gunmetal mb-1">Metric</label>
                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as FaissMetric)}
                  className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none bg-card"
                >
                  {METRIC_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-[11px] text-silver-dark">{metricHelp}</p>

            <button
              type="button"
              onClick={handleCreate}
              disabled={isCreating || !canCreate}
              className="rounded-lg bg-sandy px-4 py-2.5 text-sm font-medium text-white hover:bg-sandy-light active:bg-sandy-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {isCreating ? "Creating…" : "Create Index"}
            </button>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleUpsert}
            disabled={!canUpsert || isUpserting || !dbPath.trim()}
            className="rounded-lg bg-sandy px-4 py-2.5 text-sm font-medium text-white hover:bg-sandy-light active:bg-sandy-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            {isUpserting ? "Updating…" : "Upsert Chunks"}
          </button>

          <button
            type="button"
            onClick={handleToggleContent}
            disabled={isLoading || !dbPath.trim()}
            className="rounded-lg border border-silver-light bg-card px-4 py-2.5 text-sm font-medium text-gunmetal hover:border-sandy/50 hover:bg-sandy/5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            {isLoading ? "Loading…" : content ? "Hide Records" : "Show Records"}
          </button>
        </div>

        {!hasEmbeddings && (
          <StatusMessage type="warning" label="Note:">
            Generate embeddings in the Embeddings step above before upserting to FAISS.
          </StatusMessage>
        )}

        {error && (
          <StatusMessage type="error" label="Error:">
            {error}
          </StatusMessage>
        )}
        {success && (
          <StatusMessage type="success" label="Success:">
            {success}
          </StatusMessage>
        )}
      </div>

      {content && (
        <div className="rounded-xl border border-silver-light bg-card p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-silver-dark">
              <span className="font-medium text-gunmetal">{content.total}</span> records • dim {content.dimension} • metric {content.metric}
            </div>
            <div className="flex items-center gap-2">
              {offset > 0 && (
                <button
                  type="button"
                  onClick={() => handleView(Math.max(offset - 25, 0))}
                  disabled={isLoading}
                  className="rounded-lg border border-silver-light px-3 py-1.5 text-xs font-medium text-gunmetal hover:border-sandy/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Prev
                </button>
              )}
              {offset + 25 < content.total && (
                <button
                  type="button"
                  onClick={() => handleView(offset + 25)}
                  disabled={isLoading}
                  className="rounded-lg border border-silver-light px-3 py-1.5 text-xs font-medium text-gunmetal hover:border-sandy/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                </button>
              )}
            </div>
          </div>

          {content.items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-silver p-4 text-sm text-silver-dark text-center">
              No records in this range.
            </div>
          ) : (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {content.items.map((item) => (
                <div key={item.id} className="rounded-lg border border-silver-light p-3 space-y-2 bg-card">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-mono text-gunmetal">id: {item.id}</span>
                    <span className="text-[11px] text-silver-dark">{String(item.metadata?.filename ?? "")}</span>
                  </div>
                  <p className="text-sm text-gunmetal whitespace-pre-wrap break-words line-clamp-4">{item.text}</p>
                  <p className="text-xs text-silver-dark font-mono break-all">
                    embedding preview: [{item.embedding_preview.map((value) => String(value)).join(", ")}
                    {content.dimension > item.embedding_preview.length ? ", ..." : ""}]
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
