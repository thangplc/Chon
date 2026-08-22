import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { createApiAssertion } from "@/auth/api-assertion";
import { readBackendConfig } from "@/config/backend";

export const dynamic = "force-dynamic";

type RouteContext = Readonly<{
  params: Promise<Readonly<{ slug: string }>>;
}>;

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      {
        code: "authentication_required",
        detail: "Sign in is required to submit a vibe report",
        status: 401,
        title: "Authentication required",
        type: "about:blank",
      },
      { status: 401 },
    );
  }

  try {
    const { slug } = await context.params;
    const config = readBackendConfig();
    const assertion = await createApiAssertion(session.user);
    const response = await fetch(
      new URL(
        `/v1/places/${encodeURIComponent(slug)}/vibe-reports`,
        config.baseUrl,
      ),
      {
        body: await request.text(),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${assertion}`,
          "Content-Type": "application/json",
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
    console.error("Backend vibe report proxy failed", error);
    return NextResponse.json(
      {
        code: "backend_api_unavailable",
        detail: "The backend contribution API is temporarily unavailable",
        status: 503,
        title: "Backend API unavailable",
        type: "about:blank",
      },
      { status: 503 },
    );
  }
}
