import { createHash } from "node:crypto";

import type { NormalizedPoi } from "../types";
import { arePotentialDuplicatePlaces } from "../../../data-pipeline/place-identity";

export type VietmapSyncArea = Readonly<{
  code: string;
  displayName: string;
}>;

export type VietmapImportRows = Readonly<{
  places: readonly Record<string, string>[];
  sources: readonly Record<string, string>[];
}>;

const placeHeaders = [
  "internal_id",
  "name",
  "address",
  "latitude",
  "longitude",
  "district",
  "status",
  "is_simulated",
  "currency",
  "size_category",
  "price_level",
  "typical_spend_min",
  "typical_spend_max",
  "estimated_capacity",
  "opening_hours",
] as const;

const sourceHeaders = [
  "place_id",
  "provider",
  "provider_place_id",
  "last_synced_at",
  "source_url",
] as const;

export const VIETMAP_PLACE_CSV_HEADERS = placeHeaders;
export const VIETMAP_SOURCE_CSV_HEADERS = sourceHeaders;

function stableInternalId(providerPlaceId: string): string {
  const digest = createHash("sha256")
    .update(`vietmap_maps:${providerPlaceId}`)
    .digest("hex")
    .slice(0, 24);
  return `vietmap_${digest}`;
}

function districtForPoi(poi: NormalizedPoi, area: VietmapSyncArea): string {
  // The area has already been resolved from the POI coordinate against the
  // active boundary. Provider administrative labels can be legacy or describe
  // a ward/city, so they must not become the canonical Explore district.
  return area.displayName;
}

function addressForPoi(poi: NormalizedPoi): string {
  const address = poi.address ?? poi.addressCurrent ?? poi.addressLegacy;
  const namePrefix = new RegExp(
    `^${poi.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[,|-]?\\s*`,
    "iu",
  );
  const seen = new Set<string>();
  return address
    .replace(namePrefix, "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => {
      const key = part.toLocaleLowerCase("vi");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(", ");
}

function placeRow(
  poi: NormalizedPoi,
  area: VietmapSyncArea,
): Record<string, string> {
  const internalId = stableInternalId(poi.providerPlaceId);

  return {
    address: addressForPoi(poi),
    currency: "VND",
    district: districtForPoi(poi, area),
    estimated_capacity: "",
    opening_hours: "",
    internal_id: internalId,
    is_simulated: "false",
    latitude: String(poi.latitude),
    longitude: String(poi.longitude),
    name: poi.name,
    price_level: "",
    size_category: "unknown",
    status: "published",
    typical_spend_max: "",
    typical_spend_min: "",
  };
}

function sourceRow(poi: NormalizedPoi): Record<string, string> {
  return {
    last_synced_at: poi.retrievedAt.toISOString(),
    place_id: stableInternalId(poi.providerPlaceId),
    provider: poi.provider,
    provider_place_id: poi.providerPlaceId,
    source_url: poi.sourceUrl,
  };
}

/**
 * Convert deduplicated live VIETMAP results into the normalized CSV contract
 * consumed by the guarded importer. Provider payloads never become synthetic
 * records: every generated place is marked is_simulated=false.
 */
export function createVietmapImportRows(
  results: readonly Readonly<{ poi: NormalizedPoi; area: VietmapSyncArea }>[],
): VietmapImportRows {
  const byProviderId = new Map<
    string,
    Readonly<{ poi: NormalizedPoi; area: VietmapSyncArea }>
  >();

  for (const result of results) {
    if (!byProviderId.has(result.poi.providerPlaceId)) {
      byProviderId.set(result.poi.providerPlaceId, result);
    }
  }

  const ordered = [...byProviderId.values()].sort((left, right) =>
    left.poi.providerPlaceId.localeCompare(right.poi.providerPlaceId),
  );
  const deduplicated = ordered.filter((candidate, index) => {
    return !ordered
      .slice(0, index)
      .some(
        (previous) => arePotentialDuplicatePlaces(previous.poi, candidate.poi),
      );
  });

  return {
    places: deduplicated.map(({ poi, area }) => placeRow(poi, area)),
    sources: deduplicated.map(({ poi }) => sourceRow(poi)),
  };
}

function csvValue(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function serializeVietmapCsv(
  headers: readonly string[],
  rows: readonly Record<string, string>[],
): string {
  return [
    headers.map(csvValue).join(","),
    ...rows.map((row) =>
      headers.map((header) => csvValue(row[header] ?? "")).join(","),
    ),
  ].join("\n");
}
