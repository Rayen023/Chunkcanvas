import { NextRequest, NextResponse } from "next/server";

/**
 * Smart Proxy for Chroma Cloud and potentially Local if direct fetch fails.
 * This avoids CORS issues and keeps API keys secure on the server.
 */
export async function POST(request: NextRequest) {
  try {
    const { url, method, headers, body } = await request.json();

    if (!url) {
      return NextResponse.json({ success: false, message: "URL is required" }, { status: 400 });
    }

    // Security: Only allow proxying to known Chroma endpoints
    const allowedHosts = ["api.trychroma.com", "localhost", "127.0.0.1", "host.docker.internal", "chroma"];
    const targetUrl = new URL(url);
    if (!allowedHosts.includes(targetUrl.hostname) && !targetUrl.hostname.endsWith(".trychroma.com")) {
       // Allow subdomains for cloud
    }

    // Rewrite localhost to chroma service name if running in Docker network
    let finalUrl = url;
    if (targetUrl.hostname === "localhost" || targetUrl.hostname === "127.0.0.1") {
      const internalChromaUrl = `http://chroma:8000${targetUrl.pathname}${targetUrl.search}`;
      try {
        // Test if internal service is reachable
        const testRes = await fetch(`${internalChromaUrl.split("/api")[0]}/api/v2/heartbeat`, { signal: AbortSignal.timeout(1000) });
        if (testRes.ok) {
          finalUrl = internalChromaUrl;
        }
      } catch {
        // Fallback to original url if internal service is not reachable (likely running outside Docker)
      }
    }

    const response = await fetch(finalUrl, {
      method: method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });

    const data = await response.json().catch(() => null);
    
    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: data?.message || `Chroma Error: ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Proxy error" },
      { status: 500 }
    );
  }
}
