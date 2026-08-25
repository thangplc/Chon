import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createApiAssertion } from "@/auth/api-assertion";
import { readBackendConfig } from "@/config/backend";

export async function proxyCollections(
  request: Request,
  segments: readonly string[] = [],
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json(
      { detail: "Authentication required" },
      { status: 401 },
    );
  try {
    const config = readBackendConfig();
    const assertion = await createApiAssertion(session.user);
    const response = await fetch(
      new URL(
        `/v1/me/collections${segments.length ? `/${segments.map(encodeURIComponent).join("/")}` : ""}`,
        config.baseUrl,
      ),
      {
        body:
          request.method === "POST" || request.method === "PATCH"
            ? await request.text()
            : undefined,
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${assertion}`,
          "Content-Type": "application/json",
        },
        method: request.method,
        signal: AbortSignal.timeout(config.timeoutMs),
      },
    );
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Backend collections proxy failed", error);
    return NextResponse.json(
      { detail: "Collections API unavailable" },
      { status: 503 },
    );
  }
}
