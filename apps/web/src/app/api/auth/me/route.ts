import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createApiAssertion } from "@/auth/api-assertion";
import { readBackendConfig } from "@/config/backend";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      {
        code: "authentication_required",
        detail: "Sign in is required",
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
    const response = await fetch(new URL("/v1/auth/me", config.baseUrl), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${assertion}`,
      },
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
    console.error("Backend auth proxy failed", error);
    return NextResponse.json(
      {
        code: "backend_api_unavailable",
        detail: "The backend authentication API is temporarily unavailable",
        status: 503,
        title: "Backend API unavailable",
        type: "about:blank",
      },
      { status: 503 },
    );
  }
}
