import { NextRequest, NextResponse } from "next/server";

type ChromaMode = "local" | "cloud";

const DEFAULT_LOCAL_URL = process.env.CHROMA_LOCAL_URL || "http://localhost:8000";
const DEFAULT_TENANT = "default_tenant";
const DEFAULT_CLOUD_HOST = "https://api.trychroma.com";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function resolveCloudAuth(opts: {
  apiKey?: string;
  tenant?: string;
}): { apiKey: string; tenant: string } {
  const apiKey = opts.apiKey || process.env.CHROMA_API_KEY || process.env.NEXT_PUBLIC_CHROMA_API_KEY;
  const tenant = opts.tenant || process.env.CHROMA_TENANT || process.env.NEXT_PUBLIC_CHROMA_TENANT;

  if (!apiKey || !tenant) {
    throw new Error(
      "Missing Chroma Cloud credentials. Provide apiKey and tenant (or set CHROMA_API_KEY, CHROMA_TENANT).",
    );
  }

  return { apiKey, tenant };
}

function parseMode(value: string | null): ChromaMode {
  return value === "cloud" ? "cloud" : "local";
}

function resolveConnection(args: {
  mode: ChromaMode;
  localUrl?: string;
  cloudApiKey?: string;
  cloudTenant?: string;
}): { baseUrl: string; apiKey?: string; tenant: string } {
  if (args.mode === "cloud") {
    const cloud = resolveCloudAuth({
      apiKey: args.cloudApiKey,
      tenant: args.cloudTenant,
    });
    return {
      baseUrl: DEFAULT_CLOUD_HOST,
      apiKey: cloud.apiKey,
      tenant: cloud.tenant,
    };
  }

  return {
    baseUrl: normalizeBaseUrl(args.localUrl?.trim() || DEFAULT_LOCAL_URL),
    tenant: DEFAULT_TENANT,
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
  const timeoutMs = init.timeoutMs ?? 15_000;
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

type ChromaDatabaseListItem = {
  id?: string;
  name: string;
  tenant?: string;
};

/**
 * GET /api/chroma/databases
 * Lists all databases for a given tenant
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = parseMode(searchParams.get("mode"));
    const localUrl = searchParams.get("localUrl") ?? undefined;

    const cloudApiKey = request.headers.get("x-chroma-api-key") ?? undefined;
    const cloudTenant = request.headers.get("x-chroma-tenant") ?? undefined;

    const conn = resolveConnection({
      mode,
      localUrl,
      cloudApiKey,
      cloudTenant,
    });

    const url = new URL(
      `${normalizeBaseUrl(conn.baseUrl)}/api/v2/tenants/${encodeURIComponent(conn.tenant)}/databases`,
    );
    url.searchParams.set("limit", "500");
    url.searchParams.set("offset", "0");

    const data = await chromaFetchJson<ChromaDatabaseListItem[]>(url.toString(), {
      method: "GET",
      headers: conn.apiKey ? { "x-chroma-token": conn.apiKey } : undefined,
    });

    const databases = Array.isArray(data) ? data.map((d) => d.name) : [];

    return NextResponse.json({
      success: true,
      mode,
      databases,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to list databases",
      },
      { status: 500 },
    );
  }
}

interface CreateDatabaseRequest {
  mode: ChromaMode;
  localUrl?: string;
  cloudApiKey?: string;
  cloudTenant?: string;
  name: string;
}

/**
 * POST /api/chroma/databases
 * Creates a new database for a given tenant
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateDatabaseRequest = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, message: "Database name is required" },
        { status: 400 },
      );
    }

    const name = body.name.trim();
    const mode: ChromaMode = body.mode === "cloud" ? "cloud" : "local";

    const conn = resolveConnection({
      mode,
      localUrl: body.localUrl,
      cloudApiKey: body.cloudApiKey,
      cloudTenant: body.cloudTenant,
    });

    const url = `${normalizeBaseUrl(conn.baseUrl)}/api/v2/tenants/${encodeURIComponent(conn.tenant)}/databases`;
    const data = await chromaFetchJson<{ name: string }>(url, {
      method: "POST",
      headers: conn.apiKey ? { "x-chroma-token": conn.apiKey } : undefined,
      body: JSON.stringify({ name }),
    });

    return NextResponse.json({
      success: true,
      mode,
      database: {
        name: data.name || name,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to create database",
      },
      { status: 500 },
    );
  }
}
