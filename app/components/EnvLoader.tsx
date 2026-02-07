"use client";

import { useEffect } from "react";
import { useAppStore } from "@/app/lib/store";

/**
 * Reads NEXT_PUBLIC_* env vars and injects them into the Zustand store.
 * Must be rendered once in the app tree (layout or page).
 */
export default function EnvLoader() {
  const setEnvKeys = useAppStore((s) => s.setEnvKeys);
  const setOpenrouterApiKey = useAppStore((s) => s.setOpenrouterApiKey);
  const setVoyageApiKey = useAppStore((s) => s.setVoyageApiKey);
  const setPineconeApiKey = useAppStore((s) => s.setPineconeApiKey);

  useEffect(() => {
    const or = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ?? "";
    const va = process.env.NEXT_PUBLIC_VOYAGEAI_API_KEY ?? "";
    const pc = process.env.NEXT_PUBLIC_PINECONE_API_KEY ?? "";

    setEnvKeys({ openrouter: or, voyage: va, pinecone: pc });

    // Pre-fill if not already set
    if (or) setOpenrouterApiKey(or);
    if (va) setVoyageApiKey(va);
    if (pc) setPineconeApiKey(pc);
  }, [setEnvKeys, setOpenrouterApiKey, setVoyageApiKey, setPineconeApiKey]);

  return null;
}
