import { NextResponse, type NextRequest } from "next/server";

import { readBackendConfig } from "@/config/backend";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const config = readBackendConfig();
    const backendUrl = new URL("/v1/explore/simulated", config.baseUrl);
    backendUrl.search = request.nextUrl.search;
    const response = await fetch(backendUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    const body = await response.text();

    return new NextResponse(body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type":
          response.headers.get("Content-Type") ?? "application/json",
      },
      status: response.status,
    });
  } catch (error) {
    console.error("Backend Explore dataset proxy failed", error);
    return NextResponse.json(
      {
        code: "backend_api_unavailable",
        detail: "The Explore dataset is temporarily unavailable",
        status: 503,
        title: "Backend API unavailable",
        type: "about:blank",
      },
      { status: 503 },
    );
  }
}
