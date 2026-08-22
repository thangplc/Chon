import { NextResponse } from "next/server";

import { readBackendConfig } from "@/config/backend";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const config = readBackendConfig();
    const { id } = await context.params;
    const response = await fetch(
      new URL(`/v1/collections/${encodeURIComponent(id)}`, config.baseUrl),
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(config.timeoutMs),
      },
    );
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "Cache-Control": response.ok ? "public, max-age=60" : "no-store",
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Public collection proxy failed", error);
    return NextResponse.json(
      { detail: "Collection API unavailable" },
      { status: 503 },
    );
  }
}
