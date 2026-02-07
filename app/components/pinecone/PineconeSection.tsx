"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/app/lib/store";
import { PINECONE_ENVIRONMENTS } from "@/app/lib/constants";
import DownloadScriptButton from "../downloads/DownloadScriptButton";

export default function PineconeSection() {
  const editedChunks = useAppStore((s) => s.editedChunks);
  const parsedFilename = useAppStore((s) => s.parsedFilename);
  const embeddingsData = useAppStore((s) => s.embeddingsData);

  const pineconeApiKey = useAppStore((s) => s.pineconeApiKey);
  const voyageApiKey = useAppStore((s) => s.voyageApiKey);
  const voyageModel = useAppStore((s) => s.voyageModel);
  const pineconeEnvKey = useAppStore((s) => s.pineconeEnvKey);
  const pineconeIndexName = useAppStore((s) => s.pineconeIndexName);
  const pineconeIndexes = useAppStore((s) => s.pineconeIndexes);
  const pineconeNamespace = useAppStore((s) => s.pineconeNamespace);
  const pineconeNamespaces = useAppStore((s) => s.pineconeNamespaces);
  const isUploading = useAppStore((s) => s.isUploadingPinecone);
  const pineconeError = useAppStore((s) => s.pineconeError);
  const pineconeSuccess = useAppStore((s) => s.pineconeSuccess);
  const envPineconeKey = useAppStore((s) => s.envKeys.pinecone);

  const setPineconeApiKey = useAppStore((s) => s.setPineconeApiKey);
  const setPineconeEnvKey = useAppStore((s) => s.setPineconeEnvKey);
  const setPineconeIndexName = useAppStore((s) => s.setPineconeIndexName);
  const setPineconeIndexes = useAppStore((s) => s.setPineconeIndexes);
  const setPineconeNamespace = useAppStore((s) => s.setPineconeNamespace);
  const setPineconeNamespaces = useAppStore((s) => s.setPineconeNamespaces);
  const setIsUploading = useAppStore((s) => s.setIsUploadingPinecone);
  const setPineconeError = useAppStore((s) => s.setPineconeError);
  const setPineconeSuccess = useAppStore((s) => s.setPineconeSuccess);
  const resetDownstream = useAppStore((s) => s.resetDownstream);

  // Create index form state
  const [showCreate, setShowCreate] = useState(false);
  const [newIdxName, setNewIdxName] = useState("");
  const [newIdxDim, setNewIdxDim] = useState(1024);
  const [newIdxMetric, setNewIdxMetric] = useState<"cosine" | "euclidean" | "dotproduct">("cosine");
  const [creating, setCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Namespace creation state
  const [isCreatingNamespace, setIsCreatingNamespace] = useState(false);

  // Auto-fill env key
  useEffect(() => {
    if (!pineconeApiKey && envPineconeKey) setPineconeApiKey(envPineconeKey);
  }, [pineconeApiKey, envPineconeKey, setPineconeApiKey]);

  // Check if we have valid pre-generated embeddings
  const hasEmbeddings = embeddingsData && embeddingsData.length === editedChunks.length;

  // Fetch indexes when API key is set
  const fetchIndexes = useCallback(async () => {
    if (!pineconeApiKey) {
      setPineconeIndexes([]);
      return;
    }
    try {
      const { listIndexes } = await import("@/app/lib/pinecone-client");
      const indexes = await listIndexes(pineconeApiKey);
      setPineconeIndexes(indexes);
      if (indexes.length > 0 && !pineconeIndexName) {
        setPineconeIndexName(indexes[0]);
      }
    } catch {
      setPineconeIndexes([]);
    }
  }, [pineconeApiKey, pineconeIndexName, setPineconeIndexes, setPineconeIndexName]);

  useEffect(() => {
    fetchIndexes();
  }, [fetchIndexes]);

  // Fetch namespaces when index is set
  useEffect(() => {
    if (!pineconeApiKey || !pineconeIndexName) {
      setPineconeNamespaces([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const { listNamespaces } = await import("@/app/lib/pinecone-client");
        const namespaces = await listNamespaces(pineconeApiKey, pineconeIndexName);
        if (!active) return;
        setPineconeNamespaces(namespaces);
        // Default logic: if we have namespaces, pick first one (often just "")
        // Otherwise prompt to create.
        if (namespaces.length > 0 && !pineconeNamespace && !isCreatingNamespace) {
           // If we have an empty string namespace (default), pick it
           if (namespaces.includes("")) setPineconeNamespace("");
           else setPineconeNamespace(namespaces[0]);
           setIsCreatingNamespace(false);
        } else if (namespaces.length === 0) {
           setIsCreatingNamespace(true);
           setPineconeNamespace("");
        }
      } catch (err) {
        console.error("Failed to list namespaces:", err);
      }
    })();
    return () => { active = false; };
  }, [pineconeApiKey, pineconeIndexName, setPineconeNamespaces, setPineconeNamespace, isCreatingNamespace, pineconeNamespace]);

  // Create new index
  const handleCreateIndex = useCallback(async () => {
    if (!newIdxName.trim() || !pineconeApiKey) return;
    setCreating(true);
    setPineconeError(null);
    try {
      const { createIndex } = await import("@/app/lib/pinecone-client");
      const env = PINECONE_ENVIRONMENTS.find((e) => e.key === pineconeEnvKey)!;
      await createIndex(pineconeApiKey, newIdxName.trim(), newIdxDim, newIdxMetric, env);
      // Refresh list
      await fetchIndexes();
      setPineconeIndexName(newIdxName.trim());
      setShowCreate(false);
      setNewIdxName("");
    } catch (err) {
      setPineconeError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }, [
    newIdxName, newIdxDim, newIdxMetric, pineconeApiKey, pineconeEnvKey,
    fetchIndexes, setPineconeError, setPineconeIndexName,
  ]);

  // Upload chunks
  const handleUpload = useCallback(async () => {
    // If we have embeddings, we don't need voyageApiKey. If not, we do.
    const needsVoyageKey = !hasEmbeddings;
    if (!pineconeApiKey || !pineconeIndexName || editedChunks.length === 0) return;
    if (needsVoyageKey && !voyageApiKey) return;

    setIsUploading(true);
    setPineconeError(null);
    setPineconeSuccess(null);
    setUploadProgress(0);

    try {
      const { uploadChunks } = await import("@/app/lib/pinecone-client");
      await uploadChunks(
        pineconeApiKey,
        voyageApiKey,
        voyageModel,
        pineconeIndexName,
        editedChunks,
        parsedFilename,
        (pct) => setUploadProgress(pct),
        hasEmbeddings ? embeddingsData : null, // Pass existing embeddings if available
        pineconeNamespace // Pass namespace
      );
      setPineconeSuccess(
        `Chunks successfully uploaded to index "${pineconeIndexName}" (namespace: "${pineconeNamespace || "default"}").`,
      );
      // Clear state after successful upload
      setTimeout(() => resetDownstream(1), 2000);
    } catch (err) {
      setPineconeError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUploading(false);
    }
  }, [
    pineconeApiKey, voyageApiKey, voyageModel, pineconeIndexName,
    editedChunks, parsedFilename, setIsUploading, setPineconeError,
    setPineconeSuccess, resetDownstream, hasEmbeddings, embeddingsData
  ]);

  if (editedChunks.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-silver-light p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gunmetal">
        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-sandy text-white text-xs font-bold mr-2">
          6
        </span>
        Pinecone Upload
      </h2>

      {/* API Keys */}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-gunmetal mb-1">
            Pinecone API Key
          </label>
          <input
            type="password"
            value={pineconeApiKey}
            onChange={(e) => setPineconeApiKey(e.target.value)}
            placeholder="pcsk_..."
            className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
          />
        </div>
      </div>

      {!pineconeApiKey && (
        <p className="text-xs text-silver-dark">
          Enter a Pinecone API key to see available environments and indexes.
        </p>
      )}

      {pineconeApiKey && (
        <>
          {/* Environment */}
          <div>
            <label className="block text-sm font-medium text-gunmetal mb-2">
              Pinecone Environment
            </label>
            <div className="space-y-1.5">
              {PINECONE_ENVIRONMENTS.map((env) => {
                const isSelected = pineconeEnvKey === env.key;
                return (
                  <button
                    key={env.key}
                    type="button"
                    onClick={() => setPineconeEnvKey(env.key)}
                    className={`
                      w-full text-left rounded-lg border px-3.5 py-2 transition-all duration-150 cursor-pointer flex items-center gap-2
                      ${isSelected
                        ? "border-sandy bg-sandy/8 ring-2 ring-sandy/30"
                        : "border-silver-light bg-white hover:border-sandy/50 hover:bg-sandy/4"
                      }
                    `}
                  >
                    <span
                      className={`
                        flex-shrink-0 h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center transition-colors
                        ${isSelected ? "border-sandy" : "border-silver"}
                      `}
                    >
                      {isSelected && (
                        <span className="h-1.5 w-1.5 rounded-full bg-sandy" />
                      )}
                    </span>
                    <span className={`text-xs ${isSelected ? "text-gunmetal font-medium" : "text-gunmetal-light"}`}>
                      {env.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 pt-2">
             {/* Index Selection & Creation */}
             <div className="space-y-4">
                {/* Select Index */}
                <div>
                  <label className="block text-sm font-medium text-gunmetal mb-2">
                    Select Index
                  </label>
                  {pineconeIndexes.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-silver p-4 text-center">
                      <p className="text-xs text-silver-dark">
                        No indexes found — create one below.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {pineconeIndexes.map((idx) => {
                        const isSelected = pineconeIndexName === idx;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setPineconeIndexName(idx)}
                            className={`
                              w-full text-left rounded-lg border px-3.5 py-2.5 transition-all duration-150 cursor-pointer flex items-center gap-2
                              ${isSelected
                                ? "border-sandy bg-sandy/8 ring-2 ring-sandy/30"
                                : "border-silver-light bg-white hover:border-sandy/50 hover:bg-sandy/4"
                              }
                            `}
                          >
                            <span
                              className={`
                                flex-shrink-0 h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors
                                ${isSelected ? "border-sandy" : "border-silver"}
                              `}
                            >
                              {isSelected && (
                                <span className="h-2 w-2 rounded-full bg-sandy" />
                              )}
                            </span>
                            <span className={`text-sm font-medium font-mono ${isSelected ? "text-gunmetal" : "text-gunmetal-light"}`}>
                              {idx}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Create Index — collapsible */}
                <details
                  open={showCreate}
                  onToggle={(e) => setShowCreate((e.target as HTMLDetailsElement).open)}
                  className="group rounded-lg border border-silver-light overflow-hidden"
                >
                  <summary className="cursor-pointer select-none list-none flex items-center gap-2 bg-white px-4 py-3 hover:bg-sandy/4 transition-colors">
                    <svg className="h-4 w-4 text-sandy flex-shrink-0 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm font-medium text-gunmetal">Create New Index</span>
                    <svg className="h-4 w-4 text-sandy ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </summary>
                  <div className="border-t border-silver-light bg-gray-50/50 px-4 py-4 space-y-3">
                    <input
                      type="text"
                      value={newIdxName}
                      onChange={(e) => setNewIdxName(e.target.value)}
                      placeholder="Index name"
                      className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gunmetal-light mb-1">
                          Dimensions
                        </label>
                        <input
                          type="number"
                          value={newIdxDim}
                          onChange={(e) => setNewIdxDim(Number(e.target.value))}
                          className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gunmetal-light mb-1">
                          Metric
                        </label>
                        <div className="flex gap-1.5">
                          {(["cosine", "euclidean", "dotproduct"] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setNewIdxMetric(m)}
                              className={`
                                flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-all cursor-pointer
                                ${newIdxMetric === m
                                  ? "border-sandy bg-sandy/10 text-sandy-dark"
                                  : "border-silver-light bg-white text-gunmetal-light hover:border-sandy/50"
                                }
                              `}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleCreateIndex}
                      disabled={!newIdxName.trim() || creating}
                      className="w-full rounded-lg bg-sandy px-3 py-2.5 text-sm font-medium text-white hover:bg-sandy-light active:bg-sandy-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center justify-center gap-2"
                    >
                      {creating ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Creating…
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Create Index
                        </>
                      )}
                    </button>
                  </div>
                </details>
             </div>
          </div>

          {/* Namespace Selection */}
          {pineconeIndexName && (
            <div>
              <label className="block text-sm font-medium text-gunmetal mb-2">
                Select Namespace
              </label>
              <div className="space-y-1.5">
                {pineconeNamespaces.map((ns) => {
                  const isSelected = !isCreatingNamespace && pineconeNamespace === ns;
                  const displayNs = ns === "" ? "(Default)" : ns;
                  return (
                    <button
                      key={ns}
                      type="button"
                      onClick={() => {
                        setPineconeNamespace(ns);
                        setIsCreatingNamespace(false);
                      }}
                      className={`
                        w-full text-left rounded-lg border px-3.5 py-2 transition-all duration-150 cursor-pointer flex items-center gap-2
                        ${isSelected
                          ? "border-sandy bg-sandy/8 ring-2 ring-sandy/30"
                          : "border-silver-light bg-white hover:border-sandy/50 hover:bg-sandy/4"
                        }
                      `}
                    >
                      <span
                        className={`
                          flex-shrink-0 h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors
                          ${isSelected ? "border-sandy" : "border-silver"}
                        `}
                      >
                        {isSelected && (
                          <span className="h-2 w-2 rounded-full bg-sandy" />
                        )}
                      </span>
                      <span className={`text-sm font-medium font-mono ${isSelected ? "text-gunmetal" : "text-gunmetal-light"}`}>
                        {displayNs}
                      </span>
                    </button>
                  );
                })}
                
                {/* Create New Namespace Option */}
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNamespace(true);
                    setPineconeNamespace(""); // Reset to empty for typing
                  }}
                  className={`
                    w-full text-left rounded-lg border px-3.5 py-2 transition-all duration-150 cursor-pointer flex items-center gap-2
                    ${isCreatingNamespace
                      ? "border-sandy bg-sandy/8 ring-2 ring-sandy/30"
                      : "border-silver-light bg-white hover:border-sandy/50 hover:bg-sandy/4"
                    }
                  `}
                >
                  <span
                    className={`
                      flex-shrink-0 h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors
                      ${isCreatingNamespace ? "border-sandy" : "border-silver"}
                    `}
                  >
                    {isCreatingNamespace && (
                      <span className="h-2 w-2 rounded-full bg-sandy" />
                    )}
                  </span>
                  <span className={`text-sm font-medium ${isCreatingNamespace ? "text-gunmetal" : "text-gunmetal-light"}`}>
                    Create / Enter New Namespace
                  </span>
                </button>

                {/* Input for new namespace */}
                {isCreatingNamespace && (
                  <div className="pt-1 pl-8">
                     <input
                      type="text"
                      value={pineconeNamespace}
                      onChange={(e) => setPineconeNamespace(e.target.value)}
                      placeholder="Namespace name (e.g., project-x)"
                      className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none font-mono"
                    />
                    <p className="text-[10px] text-silver-dark mt-1">
                      Data will be uploaded to this namespace. If it doesn't exist, it will be created implicitly.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Embeddings Requirement Check */}
          {!hasEmbeddings && (
             <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
               <strong>Note:</strong> You must generate embeddings in the Voyage AI step above before uploading.
             </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={
                !pineconeIndexName || !hasEmbeddings || isUploading
              }
              className="flex items-center justify-center gap-2 rounded-lg bg-sandy px-4 py-3 text-sm font-medium text-white hover:bg-sandy-light active:bg-sandy-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {isUploading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Uploading… {uploadProgress}%
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload Chunks to Pinecone
                </>
              )}
            </button>

            {/* Script download */}
            <DownloadScriptButton
              stage="pinecone"
              label="Download Pinecone Script (.zip)"
            />
          </div>
        </>
      )}

      {/* Status messages */}
      {pineconeError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
          {pineconeError}
        </div>
      )}
      {pineconeSuccess && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
          {pineconeSuccess}
        </div>
      )}
    </div>
  );
}