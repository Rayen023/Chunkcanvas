import {
  ChromaClient,
  CloudClient,
  type Collection,
  type Metadata,
} from "chromadb";

export type ChromaMode = "local" | "cloud";

export interface ChromaConnectionOptions {
  mode: ChromaMode;
  localUrl?: string;
  cloudApiKey?: string;
  cloudTenant?: string;
  cloudDatabase?: string;
}

const DEFAULT_LOCAL_URL =
  process.env.CHROMA_LOCAL_URL || "http://localhost:8000";

function getCloudConfigFromEnv() {
  const apiKey =
    process.env.CHROMA_API_KEY || process.env.NEXT_PUBLIC_CHROMA_API_KEY;
  const tenant =
    process.env.CHROMA_TENANT || process.env.NEXT_PUBLIC_CHROMA_TENANT;
  const database =
    process.env.CHROMA_DATABASE || process.env.NEXT_PUBLIC_CHROMA_DATABASE;

  if (!apiKey || !tenant || !database) {
    throw new Error(
      "Missing CHROMA cloud environment variables. Set CHROMA_API_KEY, CHROMA_TENANT, and CHROMA_DATABASE.",
    );
  }

  return { apiKey, tenant, database };
}

export function getChromaClient(options: ChromaConnectionOptions) {
  if (options.mode === "cloud") {
    const cloud = {
      apiKey:
        options.cloudApiKey ||
        process.env.CHROMA_API_KEY ||
        process.env.NEXT_PUBLIC_CHROMA_API_KEY,
      tenant:
        options.cloudTenant ||
        process.env.CHROMA_TENANT ||
        process.env.NEXT_PUBLIC_CHROMA_TENANT,
      database:
        options.cloudDatabase ||
        process.env.CHROMA_DATABASE ||
        process.env.NEXT_PUBLIC_CHROMA_DATABASE,
    };

    if (!cloud.apiKey || !cloud.tenant || !cloud.database) {
      getCloudConfigFromEnv();
    }

    return new CloudClient({
      apiKey: cloud.apiKey,
      tenant: cloud.tenant,
      database: cloud.database,
    });
  }

  return new ChromaClient({
    path: options.localUrl?.trim() || DEFAULT_LOCAL_URL,
  });
}

export async function listCollectionNames(
  options: ChromaConnectionOptions,
): Promise<string[]> {
  const client = getChromaClient(options);
  const collections = await client.listCollections({ limit: 500, offset: 0 });
  return collections.map((collection) => collection.name);
}

export async function createCollection(
  options: ChromaConnectionOptions & { name: string; metadata?: Metadata },
) {
  const client = getChromaClient(options);
  return client.createCollection({
    name: options.name,
    metadata: options.metadata,
    embeddingFunction: null,
  });
}

export async function getOrCreateCollection(
  options: ChromaConnectionOptions & { name: string; metadata?: Metadata },
) {
  const client = getChromaClient(options);
  return client.getOrCreateCollection({
    name: options.name,
    metadata: options.metadata,
    embeddingFunction: null,
  });
}

export interface ChromaUpsertPayload {
  ids: string[];
  documents?: string[];
  metadatas?: Metadata[];
  embeddings?: number[][];
}

export async function upsertCollectionData(
  options: ChromaConnectionOptions & {
    name: string;
    payload: ChromaUpsertPayload;
    createIfMissing?: boolean;
  },
): Promise<Collection> {
  const collection = options.createIfMissing
    ? await getOrCreateCollection({
        mode: options.mode,
        localUrl: options.localUrl,
        name: options.name,
      })
    : await getChromaClient(options).getCollection({ name: options.name });

  await collection.upsert(options.payload);
  return collection;
}
