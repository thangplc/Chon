import {
  collectionDetailResponseSchema,
  collectionListResponseSchema,
  collectionMutationSchema,
  type CollectionMutation,
} from "@chon/contracts/collections";

import { SavedPlaceError } from "./saved-places-repository";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    ...init,
  });
  const body = await response.json();
  if (!response.ok) throw new SavedPlaceError(body.detail ?? "Không thể cập nhật bộ sưu tập", response.status);
  return body;
}

export async function loadCollections() {
  return collectionListResponseSchema.parse(await request("/api/me/collections")).data;
}

export async function loadOwnedCollection(slug: string) {
  return collectionDetailResponseSchema.parse(await request(`/api/me/collections/${encodeURIComponent(slug)}`)).data;
}

export async function loadPublicCollection(id: string) {
  return collectionDetailResponseSchema.parse(await request(`/api/collections/${encodeURIComponent(id)}`)).data;
}

export async function createCollection(input: CollectionMutation) {
  return collectionMutationSchema.parse(input) && collectionDetailResponseSchema.parse(await request("/api/me/collections", { method: "POST", body: JSON.stringify(input) })).data;
}

export async function updateCollection(slug: string, input: CollectionMutation) {
  return collectionDetailResponseSchema.parse(await request(`/api/me/collections/${encodeURIComponent(slug)}`, { method: "PATCH", body: JSON.stringify(input) })).data;
}

export async function deleteCollection(slug: string) {
  await request(`/api/me/collections/${encodeURIComponent(slug)}`, { method: "DELETE" });
}

export async function setPlaceInCollection(collectionSlug: string, placeSlug: string, saved: boolean) {
  await request(`/api/me/collections/${encodeURIComponent(collectionSlug)}/places/${encodeURIComponent(placeSlug)}`, { method: saved ? "PUT" : "DELETE" });
}
