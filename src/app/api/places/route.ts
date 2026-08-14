import { NextResponse, type NextRequest } from "next/server";

import { findPlacesBySpatialQuery } from "@/features/places/data/spatial-place-repository";
import {
  parseSpatialPlaceQuery,
  SpatialQueryValidationError,
} from "@/features/places/domain/spatial-query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const query = parseSpatialPlaceQuery(request.nextUrl.searchParams);
    const page = await findPlacesBySpatialQuery(query);

    return NextResponse.json(
      {
        data: page.places,
        meta: {
          count: page.places.length,
          hasMore: page.hasMore,
          query,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof SpatialQueryValidationError) {
      return NextResponse.json(
        {
          code: error.code,
          detail: error.message,
          status: 400,
          title: "Invalid spatial query",
          type: "about:blank",
        },
        { status: 400 },
      );
    }

    console.error("Spatial place query failed", error);
    return NextResponse.json(
      {
        code: "spatial_query_unavailable",
        detail: "The spatial place query is temporarily unavailable",
        status: 503,
        title: "Spatial query unavailable",
        type: "about:blank",
      },
      { status: 503 },
    );
  }
}
