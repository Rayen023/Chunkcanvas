"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/app/lib/store";
import { PINECONE_ENVIRONMENTS, PIPELINE } from "@/app/lib/constants";
import ActionRow from "@/app/components/downloads/ActionRow";
import { ProviderSelector, ConfigContainer, ConfigHeader, ProviderOption } from "@/app/components/shared/ConfigSection";
import StatusMessage from "@/app/components/shared/StatusMessage";
import Tooltip from "@/app/components/shared/Tooltip";
import FaissSection from "@/app/components/faiss/FaissSection";
import type { ScriptConfig } from "@/app/lib/script-generator";
import type { VectorDbProvider } from "@/app/lib/types";

const DB_OPTIONS: ProviderOption[] = [
  { id: "pinecone", label: "Pinecone", icon: "/tech-icons/Pinecone-Icon--Streamline-Svg-Logos.svg", badge: "Cloud", requiresApiKey: true },
  { id: "chroma", label: "Chroma", icon: "/tech-icons/Chroma--Streamline-Svg-Logos.svg", badge: "Hybrid", requiresApiKey: false },
  { id: "mongodb", label: "MongoDB", icon: "/tech-icons/MongoDB.svg", badge: "Cloud", requiresApiKey: true },
  { id: "faiss", label: "FAISS", icon: "/tech-icons/meta-color.svg", badge: "Local", requiresApiKey: false },
];

export default function PineconeSection() {
  const editedChunks = useAppStore((s) => s.editedChunks);
  const chunkSourceFiles = useAppStore((s) => s.chunkSourceFiles);
  const parsedFilename = useAppStore((s) => s.parsedFilename);
  const embeddingsData = useAppStore((s) => s.embeddingsData);
  const chunksHash = useAppStore((s) => s.chunksHash);
  const embeddingsForChunksHash = useAppStore((s) => s.embeddingsForChunksHash);
  const pipeline = useAppStore((s) => s.pipeline);
  
  // Script dependencies
  const chunkingParams = useAppStore((s) => s.chunkingParams);
  const openrouterModel = useAppStore((s) => s.openrouterModel);
  const openrouterPrompt = useAppStore((s) => s.openrouterPrompt);
  const pdfEngine = useAppStore((s) => s.pdfEngine);
  const excelColumn = useAppStore((s) => s.excelColumn);
  const excelSheet = useAppStore((s) => s.excelSheet);
  const embeddingProvider = useAppStore((s) => s.embeddingProvider);
  const voyageModel = useAppStore((s) => s.voyageModel);
  const cohereModel = useAppStore((s) => s.cohereModel);
  const openrouterEmbeddingModel = useAppStore((s) => s.openrouterEmbeddingModel);
  const embeddingDimensions = useAppStore((s) => s.embeddingDimensions);

  const pineconeApiKey = useAppStore((s) => s.pineconeApiKey);
  const voyageApiKey = useAppStore((s) => s.voyageApiKey);
  const pineconeEnvKey = useAppStore((s) => s.pineconeEnvKey);
  const pineconeIndexName = useAppStore((s) => s.pineconeIndexName);
  const pineconeIndexes = useAppStore((s) => s.pineconeIndexes);
  const pineconeNamespace = useAppStore((s) => s.pineconeNamespace);
  const pineconeNamespaces = useAppStore((s) => s.pineconeNamespaces);
  const isUploading = useAppStore((s) => s.isUploadingPinecone);
  const pineconeError = useAppStore((s) => s.pineconeError);
  const pineconeSuccess = useAppStore((s) => s.pineconeSuccess);
  const envPineconeKey = useAppStore((s) => s.envKeys.pinecone);
  const pineconeFieldMapping = useAppStore((s) => s.pineconeFieldMapping);
  const setPineconeFieldMapping = useAppStore((s) => s.setPineconeFieldMapping);

  const chromaMode = useAppStore((s) => s.chromaMode);
  const chromaLocalUrl = useAppStore((s) => s.chromaLocalUrl);
  const chromaApiKey = useAppStore((s) => s.chromaApiKey);
  const chromaTenant = useAppStore((s) => s.chromaTenant);
  const chromaDatabase = useAppStore((s) => s.chromaDatabase);
  const chromaDatabases = useAppStore((s) => s.chromaDatabases);
  const chromaCollectionName = useAppStore((s) => s.chromaCollectionName);
  const chromaCollections = useAppStore((s) => s.chromaCollections);
  const isUploadingChroma = useAppStore((s) => s.isUploadingChroma);
  const chromaError = useAppStore((s) => s.chromaError);
  const chromaSuccess = useAppStore((s) => s.chromaSuccess);

  const setPineconeApiKey = useAppStore((s) => s.setPineconeApiKey);
  const setPineconeEnvKey = useAppStore((s) => s.setPineconeEnvKey);
  const setPineconeIndexName = useAppStore((s) => s.setPineconeIndexName);
  const setPineconeIndexes = useAppStore((s) => s.setPineconeIndexes);
  const setPineconeNamespace = useAppStore((s) => s.setPineconeNamespace);
  const setPineconeNamespaces = useAppStore((s) => s.setPineconeNamespaces);
  const setIsUploading = useAppStore((s) => s.setIsUploadingPinecone);
  const setPineconeError = useAppStore((s) => s.setPineconeError);
  const setPineconeSuccess = useAppStore((s) => s.setPineconeSuccess);

  const setChromaMode = useAppStore((s) => s.setChromaMode);
  const setChromaLocalUrl = useAppStore((s) => s.setChromaLocalUrl);
  const setChromaApiKey = useAppStore((s) => s.setChromaApiKey);
  const setChromaTenant = useAppStore((s) => s.setChromaTenant);
  const setChromaDatabase = useAppStore((s) => s.setChromaDatabase);
  const setChromaDatabases = useAppStore((s) => s.setChromaDatabases);
  const setChromaCollectionName = useAppStore((s) => s.setChromaCollectionName);
  const setChromaCollections = useAppStore((s) => s.setChromaCollections);
  const setIsUploadingChroma = useAppStore((s) => s.setIsUploadingChroma);
  const setChromaError = useAppStore((s) => s.setChromaError);
  const setChromaSuccess = useAppStore((s) => s.setChromaSuccess);
  const selectedDb = useAppStore((s) => s.selectedVectorDb);
  const setSelectedDb = useAppStore((s) => s.setSelectedVectorDb);

  // Create index form state
  const [showCreate, setShowCreate] = useState(false);
  const [newIdxName, setNewIdxName] = useState("");
  const [newIdxDim, setNewIdxDim] = useState(1024);
  const [newIdxMetric, setNewIdxMetric] = useState<"cosine" | "euclidean" | "dotproduct">("cosine");
  const [creating, setCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Namespace creation state
  const [isCreatingNamespace, setIsCreatingNamespace] = useState(false);
  const [showCreateChromaCollection, setShowCreateChromaCollection] = useState(false);
  const [creatingChromaCollection, setCreatingChromaCollection] = useState(false);
  const [newChromaCollection, setNewChromaCollection] = useState("");
  const [showCreateChromaDatabase, setShowCreateChromaDatabase] = useState(false);
  const [creatingChromaDatabase, setCreatingChromaDatabase] = useState(false);
  const [newChromaDatabase, setNewChromaDatabase] = useState("");

  // Auto-fill env key
  useEffect(() => {
    if (!pineconeApiKey && envPineconeKey) setPineconeApiKey(envPineconeKey);
  }, [pineconeApiKey, envPineconeKey, setPineconeApiKey]);

  // Check if we have valid pre-generated embeddings
  const hasEmbeddings =
    !!embeddingsData &&
    embeddingsData.length === editedChunks.length &&
    !!embeddingsForChunksHash &&
    embeddingsForChunksHash === chunksHash;

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

  const buildChromaHeaders = useCallback(() => {
    if (chromaMode !== "cloud") return undefined;
    const headers: Record<string, string> = {};
    if (chromaApiKey) headers["x-chroma-api-key"] = chromaApiKey;
    if (chromaTenant) headers["x-chroma-tenant"] = chromaTenant;
    return Object.keys(headers).length > 0 ? headers : undefined;
  }, [chromaMode, chromaApiKey, chromaTenant]);

  const fetchChromaDatabases = useCallback(async () => {
    try {
      const query = new URLSearchParams({ mode: chromaMode });
      if (chromaMode === "local" && chromaLocalUrl.trim()) {
        query.set("localUrl", chromaLocalUrl.trim());
      }
      const response = await fetch(`/api/chroma/databases?${query.toString()}`, {
        headers: buildChromaHeaders(),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.message || "Failed to list databases");
      }
      const databases: string[] = json.databases || [];
      setChromaDatabases(databases);
      if (databases.length > 0 && !chromaDatabase) {
        setChromaDatabase(databases.includes("default_database") ? "default_database" : databases[0]);
      }
    } catch (err) {
      setChromaDatabases([]);
      setChromaError(err instanceof Error ? err.message : String(err));
    }
  }, [
    chromaMode,
    chromaLocalUrl,
    buildChromaHeaders,
    chromaDatabase,
    setChromaDatabase,
    setChromaDatabases,
    setChromaError,
  ]);

  const fetchChromaCollections = useCallback(async () => {
    if (!chromaDatabase) return;
    try {
      setChromaError(null);
      const query = new URLSearchParams({ mode: chromaMode, database: chromaDatabase });
      if (chromaMode === "local" && chromaLocalUrl.trim()) {
        query.set("localUrl", chromaLocalUrl.trim());
      }
      const headers: Record<string, string> = {};
      if (chromaMode === "cloud") {
        if (chromaApiKey) headers["x-chroma-api-key"] = chromaApiKey;
        if (chromaTenant) headers["x-chroma-tenant"] = chromaTenant;
        headers["x-chroma-database"] = chromaDatabase;
      }
      const response = await fetch(`/api/chroma/collections?${query.toString()}`, {
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.message || "Failed to list collections");
      }
      const collections: string[] = json.collections || [];
      setChromaCollections(collections);
      if (collections.length > 0 && !chromaCollectionName) {
        setChromaCollectionName(collections[0]);
      }
    } catch (err) {
      setChromaCollections([]);
      setChromaError(err instanceof Error ? err.message : String(err));
    }
  }, [
    chromaMode,
    chromaLocalUrl,
    chromaApiKey,
    chromaTenant,
    chromaDatabase,
    chromaCollectionName,
    setChromaCollectionName,
    setChromaCollections,
    setChromaError,
  ]);

  useEffect(() => {
    if (selectedDb !== "chroma") return;
    fetchChromaDatabases();
  }, [selectedDb, chromaMode, chromaLocalUrl, chromaApiKey, chromaTenant, fetchChromaDatabases]);

  useEffect(() => {
    if (selectedDb !== "chroma" || !chromaDatabase) return;
    fetchChromaCollections();
  }, [selectedDb, chromaDatabase, fetchChromaCollections]);

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
        pineconeNamespace, // Pass namespace
        chunkSourceFiles.length > 0 ? chunkSourceFiles : undefined,
        pineconeFieldMapping,
      );
      setPineconeSuccess(
        `Chunks successfully uploaded to index "${pineconeIndexName}" (namespace: "${pineconeNamespace || "default"}").`,
      );
    } catch (err) {
      setPineconeError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUploading(false);
    }
  }, [
    pineconeApiKey, voyageApiKey, voyageModel, pineconeIndexName,
    editedChunks, parsedFilename, setIsUploading, setPineconeError,
    setPineconeSuccess, hasEmbeddings, embeddingsData,
    pineconeNamespace, chunkSourceFiles, pineconeFieldMapping
  ]);

  const [generatingScript, setGeneratingScript] = useState(false);

  const handleCreateChromaCollection = useCallback(async () => {
    if (!newChromaCollection.trim()) return;
    setCreatingChromaCollection(true);
    setChromaError(null);
    setChromaSuccess(null);
    try {
      const response = await fetch("/api/chroma/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: chromaMode,
          localUrl: chromaMode === "local" ? chromaLocalUrl : undefined,
          cloudApiKey: chromaMode === "cloud" ? chromaApiKey : undefined,
          cloudTenant: chromaMode === "cloud" ? chromaTenant : undefined,
          cloudDatabase: chromaDatabase,
          name: newChromaCollection.trim(),
          getOrCreate: true,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.message || "Failed to create collection");
      }

      setChromaCollectionName(newChromaCollection.trim());
      setNewChromaCollection("");
      setChromaSuccess(`Collection "${json.collection.name}" is ready.`);
      await fetchChromaCollections();
    } catch (err) {
      setChromaError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingChromaCollection(false);
    }
  }, [
    newChromaCollection,
    chromaMode,
    chromaLocalUrl,
    chromaApiKey,
    chromaTenant,
    chromaDatabase,
    setChromaCollectionName,
    setChromaError,
    setChromaSuccess,
    fetchChromaCollections,
  ]);

  const handleUploadToChroma = useCallback(async () => {
    if (!chromaCollectionName || editedChunks.length === 0) return;
    if (!hasEmbeddings || !embeddingsData) return;
    setIsUploadingChroma(true);
    setChromaError(null);
    setChromaSuccess(null);
    try {
      const ids = editedChunks.map((_, index) => {
        const sourceFile = chunkSourceFiles[index] || parsedFilename || "chunk";
        return `${sourceFile}_chunk_${index}`;
      });
      const metadatas = editedChunks.map((_, index) => ({
        filename: chunkSourceFiles[index] || parsedFilename || "",
        chunk_index: index,
      }));

      const response = await fetch("/api/chroma/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: chromaMode,
          localUrl: chromaMode === "local" ? chromaLocalUrl : undefined,
          cloudApiKey: chromaMode === "cloud" ? chromaApiKey : undefined,
          cloudTenant: chromaMode === "cloud" ? chromaTenant : undefined,
          cloudDatabase: chromaDatabase,
          collectionName: chromaCollectionName,
          createIfMissing: true,
          ids,
          documents: editedChunks,
          metadatas,
          embeddings: embeddingsData,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.message || "Failed to upload chunks to Chroma");
      }

      setChromaSuccess(
        `Chunks successfully uploaded to Chroma collection "${chromaCollectionName}" (${chromaMode}).`,
      );
    } catch (err) {
      setChromaError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUploadingChroma(false);
    }
  }, [
    chromaCollectionName,
    editedChunks,
    chunkSourceFiles,
    parsedFilename,
    chromaMode,
    chromaLocalUrl,
    chromaApiKey,
    chromaTenant,
    chromaDatabase,
    hasEmbeddings,
    embeddingsData,
    setIsUploadingChroma,
    setChromaError,
    setChromaSuccess,
  ]);

  const handleGenerateScript = useCallback(async () => {
    setGeneratingScript(true);
    try {
      const { generatePipelineScript } = await import("@/app/lib/script-generator");
      const { downloadZip } = await import("@/app/lib/downloads");
      const { PINECONE_ENVIRONMENTS } = await import("@/app/lib/constants");

      const env = PINECONE_ENVIRONMENTS.find((e) => e.key === pineconeEnvKey);
      const isSpreadsheet = pipeline === PIPELINE.EXCEL_SPREADSHEET || pipeline === PIPELINE.CSV_SPREADSHEET;

      const config: ScriptConfig = {
        pipeline,
        chunkingParams,
        filename: parsedFilename,
        openrouterModel,
        openrouterPrompt,
        pdfEngine,
        excelColumn: isSpreadsheet ? excelColumn : undefined,
        excelSheet: isSpreadsheet ? excelSheet : undefined,
        embeddingProvider,
        voyageModel,
        cohereModel,
        openrouterEmbeddingModel,
        embeddingDimensions,
        pineconeIndexName,
        pineconeCloud: env?.cloud,
        pineconeRegion: env?.region,
      };

      const files = generatePipelineScript("pinecone", config);
      const stem = parsedFilename.replace(/\.[^.]+$/, "") || "document";
      await downloadZip(files as unknown as Record<string, string>, `${stem}_pinecone_pipeline.zip`);
    } finally {
      setGeneratingScript(false);
    }
  }, [
    pipeline, chunkingParams, parsedFilename, openrouterModel, openrouterPrompt,
    pdfEngine, excelColumn, excelSheet, embeddingProvider, voyageModel, cohereModel,
    openrouterEmbeddingModel, embeddingDimensions, pineconeIndexName, pineconeEnvKey,
  ]);

  if (editedChunks.length === 0) return null;

  const activeDbOption = DB_OPTIONS.find((option) => option.id === selectedDb);

  return (
    <div className="bg-card rounded-xl shadow-sm border border-silver-light p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gunmetal">
        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-sandy text-white text-xs font-bold mr-2">
          6
        </span>
        Vector Databases
      </h2>

      {/* DB Selector */}
      <div>
        <label className="block text-sm font-medium text-gunmetal mb-2">
          Vector Database Provider
        </label>
        <ProviderSelector
          options={DB_OPTIONS}
          selectedId={selectedDb}
          onSelect={(id) => setSelectedDb(id as VectorDbProvider)}
        />
      </div>

      <ConfigContainer active>
        <ConfigHeader
          title={`${activeDbOption?.label || "Provider"} Configuration`}
          icon={activeDbOption?.icon}
          description={
            activeDbOption?.badge === "Cloud"
              ? "Cloud provider selected. API key is required."
              : activeDbOption?.badge === "Hybrid"
                ? "Hybrid provider selected. Cloud mode requires API key."
                : ""
          }
        />

      {selectedDb === "pinecone" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
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
                <div className="flex flex-wrap gap-2">
                  {PINECONE_ENVIRONMENTS.map((env) => {
                    const isSelected = pineconeEnvKey === env.key;
                    return (
                      <Tooltip key={env.key} content={env.label}>
                        <button
                          type="button"
                          onClick={() => setPineconeEnvKey(env.key)}
                          className={`
                            w-auto text-left rounded-lg border px-3 py-1.5 transition-all duration-150 cursor-pointer flex items-center gap-2
                            ${isSelected
                              ? "border-sandy bg-sandy/8 ring-2 ring-sandy/30"
                              : "border-silver-light bg-card hover:border-sandy/50 hover:bg-sandy/4"
                            }
                          `}
                        >
                          <span
                            className={`
                              flex-shrink-0 h-3 w-3 rounded-full border-2 flex items-center justify-center transition-colors
                              ${isSelected ? "border-sandy" : "border-silver"}
                            `}
                          >
                            {isSelected && (
                              <span className="h-1 w-1 rounded-full bg-sandy" />
                            )}
                          </span>
                          <span className={`text-[11px] truncate max-w-[100px] ${isSelected ? "text-gunmetal font-medium" : "text-gunmetal-light"}`}>
                            {env.label}
                          </span>
                        </button>
                      </Tooltip>
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

                      {/* Create Index — collapsible */}
                      <details
                        open={showCreate}
                        onToggle={(e) => setShowCreate((e.target as HTMLDetailsElement).open)}
                        className="group rounded-lg border border-silver-light overflow-hidden mb-4"
                      >
                        <summary className="cursor-pointer  list-none flex items-center gap-2 bg-card px-4 py-3 hover:bg-sandy/4 transition-colors">
                          <svg className="h-4 w-4 text-sandy flex-shrink-0 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-sm font-medium text-gunmetal">Create New Index</span>
                          <svg className="h-4 w-4 text-sandy ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                        </summary>
                        <div className="border-t border-silver-light bg-gray-50 dark:bg-white/5 px-4 py-4 space-y-3">
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
                                        : "border-silver-light bg-card text-gunmetal-light hover:border-sandy/50"
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

                      {/* Index List */}
                      {pineconeIndexes.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-silver p-4 text-center">
                          <p className="text-xs text-silver-dark">
                            No indexes found — create one below.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {pineconeIndexes.map((idx) => {
                            const isSelected = pineconeIndexName === idx;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setPineconeIndexName(idx)}
                                className={`
                                  w-auto text-left rounded-lg border px-3 py-1.5 transition-all duration-150 cursor-pointer flex items-center gap-2
                                  ${isSelected
                                    ? "border-sandy bg-sandy/8 ring-2 ring-sandy/30"
                                    : "border-silver-light bg-card hover:border-sandy/50 hover:bg-sandy/4"
                                  }
                                `}
                              >
                                <span
                                  className={`
                                    flex-shrink-0 h-3 w-3 rounded-full border-2 flex items-center justify-center transition-colors
                                    ${isSelected ? "border-sandy" : "border-silver"}
                                  `}
                                >
                                  {isSelected && (
                                    <span className="h-1 w-1 rounded-full bg-sandy" />
                                  )}
                                </span>
                                <span className={`text-[11px] font-medium font-mono ${isSelected ? "text-gunmetal" : "text-gunmetal-light"}`}>
                                  {idx}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                 </div>
              </div>

              {/* Namespace Selection */}
              {pineconeIndexName && (
                <div>
                  <label className="block text-sm font-medium text-gunmetal mb-2">
                    Select Namespace
                  </label>

                  {/* Create Namespace — collapsible */}
                  <div className="mb-4">
                    <details
                      open={isCreatingNamespace}
                      onToggle={(e) => setIsCreatingNamespace((e.target as HTMLDetailsElement).open)}
                      className="group rounded-lg border border-silver-light overflow-hidden"
                    >
                      <summary className="cursor-pointer  list-none flex items-center gap-2 bg-card px-4 py-3 hover:bg-sandy/4 transition-colors">
                        <svg className="h-4 w-4 text-sandy flex-shrink-0 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-sm font-medium text-gunmetal">Create / Enter New Namespace</span>
                        <svg className="h-4 w-4 text-sandy ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      </summary>
                      <div className="border-t border-silver-light bg-gray-50 dark:bg-white/5 px-4 py-4 space-y-3">
                        <input
                          type="text"
                          value={pineconeNamespace}
                          onChange={(e) => setPineconeNamespace(e.target.value)}
                          placeholder="Namespace name (e.g., project-x)"
                          className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none font-mono"
                        />
                        <p className="text-[10px] text-silver-dark mt-1">
                          Data will be uploaded to this namespace. If it doesn&apos;t exist, it will be created implicitly.
                        </p>
                      </div>
                    </details>
                  </div>

                  <div className="flex flex-wrap gap-2">
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
                            w-auto text-left rounded-lg border px-3 py-1.5 transition-all duration-150 cursor-pointer flex items-center gap-2
                            ${isSelected
                              ? "border-sandy bg-sandy/8 ring-2 ring-sandy/30"
                              : "border-silver-light bg-card hover:border-sandy/50 hover:bg-sandy/4"
                            }
                          `}
                        >
                          <span
                            className={`
                              flex-shrink-0 h-3 w-3 rounded-full border-2 flex items-center justify-center transition-colors
                              ${isSelected ? "border-sandy" : "border-silver"}
                            `}
                          >
                            {isSelected && (
                              <span className="h-1 w-1 rounded-full bg-sandy" />
                            )}
                          </span>
                          <span className={`text-[11px] font-medium font-mono ${isSelected ? "text-gunmetal" : "text-gunmetal-light"}`}>
                            {displayNs}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Field Name Editor ── */}
              <div>
                <label className="block text-sm font-medium text-gunmetal mb-2">
                  Upload Field Names
                </label>
                <details className="group rounded-lg border border-silver-light overflow-hidden">
                  <summary className="cursor-pointer  list-none flex items-center gap-2 bg-card px-4 py-3 hover:bg-sandy/4 transition-colors">
                    <svg className="h-4 w-4 text-sandy flex-shrink-0 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm font-medium text-gunmetal">Configure Field Names</span>
                    <span className="ml-auto text-[10px] text-silver-dark">Customize vector field names</span>
                  </summary>
                  <div className="border-t border-silver-light bg-gray-50 dark:bg-white/5 px-4 py-4 space-y-3">
                    <p className="text-[10px] text-silver-dark mb-2">
                      Edit the field names used when uploading vectors to Pinecone.
                    </p>

                    {/* ID Prefix */}
                    <div>
                      <label className="block text-xs font-medium text-gunmetal-light mb-1">
                        Vector ID Prefix
                      </label>
                      <input
                        type="text"
                        value={pineconeFieldMapping.idPrefix}
                        onChange={(e) => setPineconeFieldMapping({ idPrefix: e.target.value })}
                        placeholder={parsedFilename || "filename"}
                        className="w-full rounded-lg border border-silver px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
                      />
                      <p className="text-[10px] text-silver-dark mt-0.5">
                        ID format: <code className="font-mono text-gunmetal-light">{`{prefix}_chunk_{index}`}</code>
                        {" — "}leave empty to use source filename
                      </p>
                    </div>

                    {/* Text Field */}
                    <div>
                      <label className="block text-xs font-medium text-gunmetal-light mb-1">
                        Metadata: Text Field Name
                      </label>
                      <input
                        type="text"
                        value={pineconeFieldMapping.textField}
                        onChange={(e) => setPineconeFieldMapping({ textField: e.target.value })}
                        placeholder="text"
                        className="w-full rounded-lg border border-silver px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
                      />
                    </div>

                    {/* Filename Field */}
                    <div>
                      <label className="block text-xs font-medium text-gunmetal-light mb-1">
                        Metadata: Filename Field Name
                      </label>
                      <input
                        type="text"
                        value={pineconeFieldMapping.filenameField}
                        onChange={(e) => setPineconeFieldMapping({ filenameField: e.target.value })}
                        placeholder="filename"
                        className="w-full rounded-lg border border-silver px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
                      />
                    </div>

                    {/* Preview */}
                    <div className="rounded-lg bg-slate-900 p-3 text-[10px] font-mono text-slate-300 space-y-1">
                      <p className="text-slate-500">{"// Upload preview per vector:"}</p>
                      <p>{`{`}</p>
                      <p className="pl-3">{`id: "${pineconeFieldMapping.idPrefix || parsedFilename || "file"}_chunk_0",`}</p>
                      <p className="pl-3">{`values: [0.123, -0.456, ...],`}</p>
                      <p className="pl-3">{`metadata: {`}</p>
                      <p className="pl-6">{`${pineconeFieldMapping.filenameField || "filename"}: "example.pdf",`}</p>
                      <p className="pl-6">{`${pineconeFieldMapping.textField || "text"}: "chunk content..."`}</p>
                      <p className="pl-3">{`}`}</p>
                      <p>{`}`}</p>
                      <p className="text-slate-500">{`// namespace: "${pineconeNamespace || "(default)"}"`}</p>
                    </div>
                  </div>
                </details>
              </div>

              {/* Embeddings Requirement Check */}
              {!hasEmbeddings && (
                 <StatusMessage type="warning" label="Note:">
                   You must generate embeddings in the Embeddings step above before uploading.
                 </StatusMessage>
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
                      Upload Chunks to Vector DB
                    </>
                  )}
                </button>

                {/* Script download */}
                <ActionRow
                  onGenerateScript={handleGenerateScript}
                  scriptLabel="Generate Script"
                  isGeneratingScript={generatingScript}
                  scriptOnly={true}
                />
              </div>
            </>
          )}

          {/* Status messages */}
          {pineconeError && (
            <StatusMessage type="error" label="Error:">
              {pineconeError}
            </StatusMessage>
          )}
          {pineconeSuccess && (
            <StatusMessage type="success" label="Success:">
              {pineconeSuccess}
            </StatusMessage>
          )}
        </div>
      )}

      {selectedDb === "chroma" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {([
              { key: "local", label: "Local Chroma" },
              { key: "cloud", label: "Chroma Cloud" },
            ] as const).map((mode) => {
              const selected = chromaMode === mode.key;
              return (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setChromaMode(mode.key)}
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

          {chromaMode === "local" && (
            <div>
              <label className="block text-sm font-medium text-gunmetal mb-1">
                Local Chroma URL
              </label>
              <input
                type="text"
                value={chromaLocalUrl}
                onChange={(e) => setChromaLocalUrl(e.target.value)}
                placeholder="http://localhost:8000"
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
              />
            </div>
          )}

          {chromaMode === "cloud" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gunmetal mb-1">Chroma API Key</label>
                  <input
                    type="password"
                    value={chromaApiKey}
                    onChange={(e) => setChromaApiKey(e.target.value)}
                    placeholder="ck_..."
                    className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gunmetal mb-1">Tenant ID</label>
                  <input
                    type="text"
                    value={chromaTenant}
                    onChange={(e) => setChromaTenant(e.target.value)}
                    placeholder="tenant-id"
                    className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
                  />
                  <p className="text-[10px] text-silver-dark mt-0.5">
                    Required by Chroma Cloud to scope your data. Found in your Chroma Cloud dashboard.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Database Selection & Creation */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gunmetal">
              Select Database
            </label>

            {/* Create Database — collapsible (local only; Chroma Cloud manages databases via dashboard) */}
            {chromaMode === "local" ? (
            <details
              open={showCreateChromaDatabase}
              onToggle={(e) => setShowCreateChromaDatabase((e.target as HTMLDetailsElement).open)}
              className="group rounded-lg border border-silver-light overflow-hidden mb-4"
            >
              <summary className="cursor-pointer list-none flex items-center gap-2 bg-card px-4 py-3 hover:bg-sandy/4 transition-colors">
                <svg className="h-4 w-4 text-sandy flex-shrink-0 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-sm font-medium text-gunmetal">Create New Database</span>
                <svg className="h-4 w-4 text-sandy ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </summary>
              <div className="border-t border-silver-light bg-gray-50 dark:bg-white/5 px-4 py-4 space-y-3">
                <input
                  type="text"
                  value={newChromaDatabase}
                  onChange={(e) => setNewChromaDatabase(e.target.value)}
                  placeholder="my_database"
                  className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!newChromaDatabase.trim()) return;
                    setCreatingChromaDatabase(true);
                    setChromaError(null);
                    setChromaSuccess(null);
                    try {
                      const response = await fetch("/api/chroma/databases", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          mode: chromaMode,
                          localUrl: chromaLocalUrl || undefined,
                          name: newChromaDatabase.trim(),
                        }),
                      });
                      const json = await response.json();
                      if (!response.ok || !json.success) {
                        throw new Error(json.message || "Failed to create database");
                      }
                      setChromaDatabase(newChromaDatabase.trim());
                      setNewChromaDatabase("");
                      setShowCreateChromaDatabase(false);
                      setChromaSuccess(`Database "${json.database.name}" created.`);
                      await fetchChromaDatabases();
                    } catch (err) {
                      setChromaError(err instanceof Error ? err.message : String(err));
                    } finally {
                      setCreatingChromaDatabase(false);
                    }
                  }}
                  disabled={!newChromaDatabase.trim() || creatingChromaDatabase}
                  className="w-full rounded-lg bg-sandy px-3 py-2.5 text-sm font-medium text-white hover:bg-sandy-light active:bg-sandy-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  {creatingChromaDatabase ? "Creating…" : "Create Database"}
                </button>
              </div>
            </details>
            ) : (
              <p className="text-[10px] text-silver-dark mb-4">
                Chroma Cloud databases are managed via the{" "}
                <a href="https://www.trychroma.com/login" target="_blank" rel="noopener noreferrer" className="text-sandy hover:underline">
                  Chroma Cloud dashboard
                </a>
                . The API key does not have permission to create databases.
              </p>
            )}

            {chromaDatabases.length === 0 ? (
              <div className="rounded-lg border border-dashed border-silver p-4 text-center">
                <p className="text-xs text-silver-dark">
                  No databases found{chromaMode === "local" ? " — create one below." : "."}
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {chromaDatabases.map((dbName) => {
                  const isSelected = chromaDatabase === dbName;
                  return (
                    <button
                      key={dbName}
                      type="button"
                      onClick={() => {
                        setChromaDatabase(dbName);
                        // Reset collection when database changes
                        setChromaCollectionName("");
                        setChromaCollections([]);
                      }}
                      className={`
                        w-auto text-left rounded-lg border px-3 py-1.5 transition-all duration-150 cursor-pointer flex items-center gap-2
                        ${isSelected
                          ? "border-sandy bg-sandy/8 ring-2 ring-sandy/30"
                          : "border-silver-light bg-card hover:border-sandy/50 hover:bg-sandy/4"
                        }
                      `}
                    >
                      <span
                        className={`
                          flex-shrink-0 h-3 w-3 rounded-full border-2 flex items-center justify-center transition-colors
                          ${isSelected ? "border-sandy" : "border-silver"}
                        `}
                      >
                        {isSelected && <span className="h-1 w-1 rounded-full bg-sandy" />}
                      </span>
                      <span className={`text-[11px] font-medium font-mono ${isSelected ? "text-gunmetal" : "text-gunmetal-light"}`}>
                        {dbName}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Collection Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gunmetal">
              Select Collection
            </label>

            <details
              open={showCreateChromaCollection}
              onToggle={(e) => setShowCreateChromaCollection((e.target as HTMLDetailsElement).open)}
              className="group rounded-lg border border-silver-light overflow-hidden mb-4"
            >
              <summary className="cursor-pointer list-none flex items-center gap-2 bg-card px-4 py-3 hover:bg-sandy/4 transition-colors">
                <svg className="h-4 w-4 text-sandy flex-shrink-0 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-sm font-medium text-gunmetal">Create New Collection</span>
                <svg className="h-4 w-4 text-sandy ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </summary>
              <div className="border-t border-silver-light bg-gray-50 dark:bg-white/5 px-4 py-4 space-y-3">
                <input
                  type="text"
                  value={newChromaCollection}
                  onChange={(e) => setNewChromaCollection(e.target.value)}
                  placeholder="my_collection"
                  className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none"
                />
                <p className="text-[11px] text-silver-dark">
                  Name must be 3-512 chars, lowercase alphanumeric with dots, dashes, or underscores.
                </p>
                <button
                  type="button"
                  onClick={handleCreateChromaCollection}
                  disabled={!newChromaCollection.trim() || creatingChromaCollection}
                  className="w-full rounded-lg bg-sandy px-3 py-2.5 text-sm font-medium text-white hover:bg-sandy-light active:bg-sandy-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  {creatingChromaCollection ? "Creating…" : "Create Collection"}
                </button>
              </div>
            </details>

            {chromaCollections.length === 0 ? (
              <div className="rounded-lg border border-dashed border-silver p-4 text-center">
                <p className="text-xs text-silver-dark">
                  No collections found — create one below.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {chromaCollections.map((name) => {
                  const isSelected = chromaCollectionName === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setChromaCollectionName(name)}
                      className={`
                        w-auto text-left rounded-lg border px-3 py-1.5 transition-all duration-150 cursor-pointer flex items-center gap-2
                        ${isSelected
                          ? "border-sandy bg-sandy/8 ring-2 ring-sandy/30"
                          : "border-silver-light bg-card hover:border-sandy/50 hover:bg-sandy/4"
                        }
                      `}
                    >
                      <span
                        className={`
                          flex-shrink-0 h-3 w-3 rounded-full border-2 flex items-center justify-center transition-colors
                          ${isSelected ? "border-sandy" : "border-silver"}
                        `}
                      >
                        {isSelected && <span className="h-1 w-1 rounded-full bg-sandy" />}
                      </span>
                      <span className={`text-[11px] font-medium font-mono ${isSelected ? "text-gunmetal" : "text-gunmetal-light"}`}>
                        {name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {!hasEmbeddings && (
            <StatusMessage type="warning" label="Note:">
              You must generate embeddings in the Embeddings step above before uploading.
            </StatusMessage>
          )}

          <button
            onClick={handleUploadToChroma}
            disabled={!chromaCollectionName || !hasEmbeddings || isUploadingChroma || editedChunks.length === 0}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-sandy px-4 py-3 text-sm font-medium text-white hover:bg-sandy-light active:bg-sandy-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            {isUploadingChroma ? "Uploading…" : "Upload Chunks to Chroma"}
          </button>

          {chromaError && (
            <StatusMessage type="error" label="Error:">
              {chromaError}
            </StatusMessage>
          )}
          {chromaSuccess && (
            <StatusMessage type="success" label="Success:">
              {chromaSuccess}
            </StatusMessage>
          )}

          <p className="text-[11px] text-silver-dark">
            Upload uses upsert and will reuse existing chunk IDs when they already exist.
          </p>
          </div>
      )}

      {selectedDb === "mongodb" && (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
          <div className="h-16 w-16 bg-sandy/10 rounded-2xl flex items-center justify-center">
            <Image src="/tech-icons/MongoDB.svg" alt="MongoDB" width={40} height={40} className="h-10 w-10 opacity-50 grayscale" />
          </div>
          <div className="space-y-2 max-w-sm">
            <h3 className="text-gunmetal font-semibold text-lg">MongoDB Atlas Vector Search</h3>
            <p className="text-silver-dark text-sm">
              Native support for MongoDB Atlas Vector Search is on our roadmap. Stay tuned for updates!
            </p>
          </div>
        </div>
      )}

      {selectedDb === "faiss" && (
        <FaissSection />
      )}
      </ConfigContainer>
    </div>
  );
}