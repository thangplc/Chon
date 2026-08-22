import {
  savedPlaceListResponseSchema,
  savedPlaceStatusResponseSchema,
} from "@chon/contracts/collections";

export class SavedPlaceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SavedPlaceError";
  }
}

async function request(path: string, method = "GET") {
  const response = await fetch(path, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    method,
  });
  const body = (await response.json()) as { detail?: string; title?: string };
  if (!response.ok) {
    throw new SavedPlaceError(
      body.detail ?? body.title ?? "Không thể cập nhật địa điểm đã lưu",
      response.status,
    );
  }
  return body;
}

export async function loadSavedPlaces() {
  return savedPlaceListResponseSchema.parse(
    await request("/api/me/saved-places"),
  ).data;
}

export async function loadSavedPlaceStatus(slug: string) {
  return savedPlaceStatusResponseSchema.parse(
    await request(`/api/me/saved-places/${encodeURIComponent(slug)}`),
  ).data;
}

export async function setSavedPlace(slug: string, saved: boolean) {
  return savedPlaceStatusResponseSchema.parse(
    await request(
      `/api/me/saved-places/${encodeURIComponent(slug)}`,
      saved ? "PUT" : "DELETE",
    ),
  ).data;
}
