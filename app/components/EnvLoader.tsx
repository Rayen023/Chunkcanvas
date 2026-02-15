"use client";

import { useEffect } from "react";
import { useAppStore } from "@/app/lib/store";

export default function EnvLoader() {
  const setEnvKeys = useAppStore((s) => s.setEnvKeys);
  const setOpenrouterApiKey = useAppStore((s) => s.setOpenrouterApiKey);
  const setVoyageApiKey = useAppStore((s) => s.setVoyageApiKey);
  const setCohereApiKey = useAppStore((s) => s.setCohereApiKey);
  const setPineconeApiKey = useAppStore((s) => s.setPineconeApiKey);
  const setChromaApiKey = useAppStore((s) => s.setChromaApiKey);
  const setChromaTenant = useAppStore((s) => s.setChromaTenant);
  const setChromaDatabase = useAppStore((s) => s.setChromaDatabase);
  const setMongodbUri = useAppStore((s) => s.setMongodbUri);

  const setOllamaEndpoint = useAppStore((s) => s.setOllamaEndpoint);
  const setVllmEndpoint = useAppStore((s) => s.setVllmEndpoint);
  const setDoclingEndpoint = useAppStore((s) => s.setDoclingEndpoint);
  const setChromaLocalUrl = useAppStore((s) => s.setChromaLocalUrl);
  const setFaissApiBase = useAppStore((s) => s.setFaissApiBase);

  useEffect(() => {
    const or = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ?? "";
    const va = process.env.NEXT_PUBLIC_VOYAGEAI_API_KEY ?? "";
    const co = process.env.NEXT_PUBLIC_COHERE_API_KEY ?? "";
    const pc = process.env.NEXT_PUBLIC_PINECONE_API_KEY ?? "";
    const ck = process.env.NEXT_PUBLIC_CHROMA_API_KEY ?? "";
    const ct = process.env.NEXT_PUBLIC_CHROMA_TENANT ?? "";
    const cd = process.env.NEXT_PUBLIC_CHROMA_DATABASE ?? "";
    const mu = process.env.NEXT_PUBLIC_MONGODB_URI ?? "";

    setEnvKeys({ openrouter: or, voyage: va, cohere: co, pinecone: pc, mongodb: mu });

    if (or) setOpenrouterApiKey(or);
    if (va) setVoyageApiKey(va);
    if (co) setCohereApiKey(co);
    if (pc) setPineconeApiKey(pc);
    if (ck) setChromaApiKey(ck);
    if (ct) setChromaTenant(ct);
    if (cd) setChromaDatabase(cd);
    if (mu) setMongodbUri(mu);

    const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_URL ?? "";
    const vllmUrl = process.env.NEXT_PUBLIC_VLLM_URL ?? "";
    const doclingUrl = process.env.NEXT_PUBLIC_DOCLING_URL ?? "";
    const chromaUrl = process.env.NEXT_PUBLIC_CHROMA_URL ?? "";
    const faissUrl = process.env.NEXT_PUBLIC_FAISS_URL ?? "";

    if (ollamaUrl) setOllamaEndpoint(ollamaUrl);
    if (vllmUrl) setVllmEndpoint(vllmUrl);
    if (doclingUrl) setDoclingEndpoint(doclingUrl);
    if (chromaUrl) setChromaLocalUrl(chromaUrl);
    if (faissUrl) setFaissApiBase(faissUrl);
  }, [
    setEnvKeys,
    setOpenrouterApiKey,
    setVoyageApiKey,
    setCohereApiKey,
    setPineconeApiKey,
    setChromaApiKey,
    setChromaTenant,
    setChromaDatabase,
    setMongodbUri,
    setOllamaEndpoint,
    setVllmEndpoint,
    setDoclingEndpoint,
    setChromaLocalUrl,
    setFaissApiBase,
  ]);

  return null;
}
