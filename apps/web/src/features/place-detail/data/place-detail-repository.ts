import "server-only";

import { placeDetailResponseSchema } from "@chon/contracts/backend";
import { BackendApiError, fetchBackendJson } from "@/lib/backend-api";

import type { PlaceDetail } from "../domain/place-detail";

export async function getPlaceDetailBySlug(
  slug: string,
): Promise<PlaceDetail | null> {
  try {
    const response = await fetchBackendJson(
      `/v1/places/${encodeURIComponent(slug)}`,
      placeDetailResponseSchema,
    );
    return response.data;
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) return null;
    throw error;
  }
}
