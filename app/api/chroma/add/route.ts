import { NextRequest, NextResponse } from "next/server";

type ChromaMode = "local" | "cloud";
type Metadata = Record<string, unknown>;

const DEFAULT_LOCAL_URL = process.env.CHROMA_LOCAL_URL || "http://localhost:8000";
const DEFAULT_TENANT = "default_tenant";
const DEFAULT_DATABASE = "default_database";
const DEFAULT_CLOUD_HOST = "https://api.trychroma.com";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function resolveCloudAuth(opts: {
  apiKey?: string;
  tenant?: string;
  database?: string;
}): { apiKey: string; tenant: string; database: string } {
  const apiKey = opts.apiKey || process.env.CHROMA_API_KEY || process.env.NEXT_PUBLIC_CHROMA_API_KEY;
  const tenant = opts.tenant || process.env.CHROMA_TENANT || process.env.NEXT_PUBLIC_CHROMA_TENANT;
  const database = opts.database || process.env.CHROMA_DATABASE || process.env.NEXT_PUBLIC_CHROMA_DATABASE;

  if (!apiKey || !tenant || !database) {
    throw new Error(
      "Missing Chroma Cloud credentials. Provide apiKey/tenant/database (or set CHROMA_API_KEY, CHROMA_TENANT, CHROMA_DATABASE).",
    );
  }

  return { apiKey, tenant, database };
}

function resolveConnection(args: {
  mode: ChromaMode;
  localUrl?: string;
  cloudApiKey?: string;
  cloudTenant?: string;
  cloudDatabase?: string;
}): { baseUrl: string; apiKey?: string; tenant: string; database: string } {
  if (args.mode === "cloud") {
    const cloud = resolveCloudAuth({
      apiKey: args.cloudApiKey,
      tenant: args.cloudTenant,
      database: args.cloudDatabase,
    });
    return {
      baseUrl: DEFAULT_CLOUD_HOST,
      apiKey: cloud.apiKey,
      tenant: cloud.tenant,
      database: cloud.database,
    };
  }

  return {
    baseUrl: normalizeBaseUrl(args.localUrl?.trim() || DEFAULT_LOCAL_URL),
    tenant: DEFAULT_TENANT,
    database: args.cloudDatabase?.trim() || DEFAULT_DATABASE,
  };
}

async function chromaFetchJson<T>(
  input: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const messageFromJson = (value: unknown): string | null => {
    if (!value || typeof value !== "object") return null;
    if (!("message" in value)) return null;
    const msg = (value as Record<string, unknown>).message;
    return typeof msg === "string" ? msg : null;
  };

  const controller = new AbortController();
  const timeoutMs = init.timeoutMs ?? 30_000;
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });

    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) throw new Error(messageFromJson(json) || `HTTP ${res.status}`);
    return json as T;
  } finally {
    clearTimeout(id);
  }
}

interface AddDataRequest {
  mode: ChromaMode;
  localUrl?: string;
  cloudApiKey?: string;
  cloudTenant?: string;
  cloudDatabase?: string;
  collectionName: string;
  createIfMissing?: boolean;
  ids: string[];
  documents?: string[];
  metadatas?: Metadata[];
  embeddings?: number[][];
}

export async function POST(request: NextRequest) {
  try {
    const data: AddDataRequest = await request.json();

    if (!data.collectionName?.trim()) {
      return NextResponse.json({ success: false, message: "collectionName is required" }, { status: 400 });
    }
    if (!Array.isArray(data.ids) || data.ids.length === 0) {
      return NextResponse.json({ success: false, message: "ids are required" }, { status: 400 });
    }
    if (!Array.isArray(data.embeddings) || data.embeddings.length !== data.ids.length) {
      return NextResponse.json(
        { success: false, message: "embeddings are required (one per id)" },
        { status: 400 },
      );
    }

    const mode: ChromaMode = data.mode === "cloud" ? "cloud" : "local";

    const conn = resolveConnection({
      mode,
      localUrl: data.localUrl,
      cloudApiKey: data.cloudApiKey,
      cloudTenant: data.cloudTenant,
      cloudDatabase: data.cloudDatabase,
    });

    const collectionName = data.collectionName.trim();
    const createIfMissing = data.createIfMissing ?? true;

    const baseCollectionsUrl = `${normalizeBaseUrl(conn.baseUrl)}/api/v2/tenants/${encodeURIComponent(conn.tenant)}/databases/${encodeURIComponent(conn.database)}/collections`;

    let collectionId: string | null = null;
    if (createIfMissing) {
      const created = await chromaFetchJson<{ id: string; name: string }>(baseCollectionsUrl, {
        method: "POST",
        headers: conn.apiKey ? { "x-chroma-token": conn.apiKey } : undefined,
        body: JSON.stringify({
          name: collectionName,
          configuration: {},
          get_or_create: true,
        }),
      });
      collectionId = created.id;
    } else {
      const listUrl = new URL(baseCollectionsUrl);
      listUrl.searchParams.set("limit", "500");
      listUrl.searchParams.set("offset", "0");
      const listed = await chromaFetchJson<Array<{ id: string; name: string }>>(listUrl.toString(), {
        method: "GET",
        headers: conn.apiKey ? { "x-chroma-token": conn.apiKey } : undefined,
      });
      const match = listed.find((c) => c.name === collectionName);
      collectionId = match?.id ?? null;
      if (!collectionId) {
        return NextResponse.json(
          { success: false, message: `Collection "${collectionName}" not found` },
          { status: 404 },
        );
      }
    }

    const upsertUrl = `${baseCollectionsUrl}/${encodeURIComponent(collectionId)}/upsert`;
    await chromaFetchJson<unknown>(upsertUrl, {
      method: "POST",
      headers: conn.apiKey ? { "x-chroma-token": conn.apiKey } : undefined,
      body: JSON.stringify({
        ids: data.ids,
        embeddings: data.embeddings,
        documents: data.documents,
        metadatas: data.metadatas,
      }),
    });

    return NextResponse.json({
      success: true,
      message: "Data added successfully",
      count: data.ids.length,
      collectionName: data.collectionName.trim(),
      mode,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to add data",
      },
      { status: 500 },
    );
  }
}
