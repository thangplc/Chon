import { NextResponse } from "next/server";

import { readBackendConfig } from "@/config/backend";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const config = readBackendConfig();
    const response = await fetch(
      new URL("/v1/analytics/events", config.baseUrl),
      {
        body: await request.text(),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type":
            request.headers.get("content-type") ?? "application/json",
        },
        method: "POST",
        signal: AbortSignal.timeout(config.timeoutMs),
      },
    );
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
    console.error("Backend analytics proxy failed", error);
    return NextResponse.json(
      {
        code: "backend_api_unavailable",
        detail: "The backend analytics API is temporarily unavailable",
        status: 503,
        title: "Backend API unavailable",
        type: "about:blank",
      },
      { status: 503 },
    );
  }
}
