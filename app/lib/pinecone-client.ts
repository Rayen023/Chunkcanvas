import type { PineconeEnvironment, PineconeFieldMapping } from "./types";

const PINECONE_CONTROL_URL = "https://api.pinecone.io";

export async function listIndexes(apiKey: string): Promise<string[]> {
  const res = await fetch(`${PINECONE_CONTROL_URL}/indexes`, {
    headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Pinecone ${res.status}: ${res.statusText}`);
  const json = await res.json();
  return (json.indexes ?? []).map((idx: { name: string }) => idx.name);
}

export async function getIndexHost(
  apiKey: string,
  indexName: string,
): Promise<string> {
  const res = await fetch(`${PINECONE_CONTROL_URL}/indexes/${indexName}`, {
    headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Pinecone ${res.status}: ${res.statusText}`);
  const json = await res.json();
  return json.host;
}

export async function listNamespaces(
  apiKey: string,
  indexName: string,
): Promise<string[]> {
  const host = await getIndexHost(apiKey, indexName);
  const res = await fetch(`https://${host}/describe_index_stats`, {
    method: "POST",
    headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok)
    throw new Error(`Pinecone stats ${res.status}: ${res.statusText}`);
  const json = await res.json();
  return Object.keys(json.namespaces || {});
}

export async function createIndex(
  apiKey: string,
  name: string,
  dimension: number,
  metric: "cosine" | "euclidean" | "dotproduct",
  env: PineconeEnvironment,
): Promise<void> {
  const res = await fetch(`${PINECONE_CONTROL_URL}/indexes`, {
    method: "POST",
    headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      dimension,
      metric,
      spec: {
        serverless: { cloud: env.cloud, region: env.region },
      },
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Pinecone create index ${res.status}: ${errText}`);
  }
}

export async function uploadChunks(
  pineconeKey: string,
  voyageKey: string,
  voyageModel: string,
  indexName: string,
  chunks: string[],
  filename: string,
  onProgress?: (pct: number) => void,
  existingEmbeddings?: number[][] | null,
  namespace?: string,
  chunkSourceFiles?: string[],
  fieldMapping?: PineconeFieldMapping,
): Promise<void> {
  const host = await getIndexHost(pineconeKey, indexName);
  const dataUrl = `https://${host}`;

  let allEmbeddings: number[][] = [];

  if (existingEmbeddings && existingEmbeddings.length === chunks.length) {
    allEmbeddings = existingEmbeddings;
    onProgress?.(50);
  } else {
    if (!voyageKey) {
      throw new Error("Voyage API key is required to generate embeddings.");
    }
    const { generateEmbeddings } = await import("./voyage");
    const BATCH_SIZE = 128;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embeddings = await generateEmbeddings(
        voyageKey,
        voyageModel,
        batch,
      );
      allEmbeddings.push(...embeddings);
      onProgress?.(
        Math.round(
          (Math.min(i + BATCH_SIZE, chunks.length) / chunks.length) * 50,
        ),
      );
    }
  }

  const UPSERT_BATCH = 100;
  const textKey = fieldMapping?.textField || "text";
  const fnKey = fieldMapping?.filenameField || "filename";

  for (let i = 0; i < chunks.length; i += UPSERT_BATCH) {
    const vectors = chunks.slice(i, i + UPSERT_BATCH).map((text, j) => {
      const idx = i + j;
      const sourceFile = chunkSourceFiles?.[idx] || filename;
      const idPrefix = fieldMapping?.idPrefix || sourceFile;
      return {
        id: `${idPrefix}_chunk_${idx}`,
        values: allEmbeddings[idx],
        metadata: { [fnKey]: sourceFile, [textKey]: text },
      };
    });

    const res = await fetch(`${dataUrl}/vectors/upsert`, {
      method: "POST",
      headers: {
        "Api-Key": pineconeKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ vectors, namespace: namespace || "" }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Pinecone upsert ${res.status}: ${errText}`);
    }

    onProgress?.(
      50 +
        Math.round(
          (Math.min(i + UPSERT_BATCH, chunks.length) / chunks.length) * 50,
        ),
    );
  }
}
