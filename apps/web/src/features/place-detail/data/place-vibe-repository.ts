import "server-only";

import {
  vibeSnapshotsResponseSchema,
  type VibeSnapshotApiItem,
} from "@chon/contracts/backend";
import { BackendApiError, fetchBackendJson } from "@/lib/backend-api";

export async function getPlaceVibeBySlug(
  slug: string,
): Promise<readonly VibeSnapshotApiItem[]> {
  try {
    const response = await fetchBackendJson(
      `/v1/places/${encodeURIComponent(slug)}/vibe`,
      vibeSnapshotsResponseSchema,
    );
    return response.data.snapshots;
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) return [];
    throw error;
  }
}
