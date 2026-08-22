import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createApiAssertion } from "@/auth/api-assertion";
import { readBackendConfig } from "@/config/backend";

export async function proxySavedPlaces(
  method: "DELETE" | "GET" | "PUT",
  slug?: string,
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      {
        code: "authentication_required",
        detail: "Sign in is required to save places",
        status: 401,
        title: "Authentication required",
        type: "about:blank",
      },
      { status: 401 },
    );
  }

  try {
    const config = readBackendConfig();
    const assertion = await createApiAssertion(session.user);
    const path = slug
      ? `/v1/me/saved-places/${encodeURIComponent(slug)}`
      : "/v1/me/saved-places";
    const response = await fetch(new URL(path, config.baseUrl), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${assertion}`,
      },
      method,
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
    console.error("Backend saved places proxy failed", error);
    return NextResponse.json(
      {
        code: "backend_api_unavailable",
        detail: "The saved places API is temporarily unavailable",
        status: 503,
        title: "Backend API unavailable",
        type: "about:blank",
      },
      { status: 503 },
    );
  }
}
