import { asProviderPayload } from "../../vibe/adapters/common";
import {
  parseVietmapSearchResponse,
  type VietmapSearchResult,
} from "./response-contract";
import {
  POI_PROVIDER,
  POI_PROVIDER_PRODUCT,
  type NormalizedPoi,
  type PoiBoundary,
  type PoiSourceKind,
} from "../types";

export type VietmapNormalizationContext = Readonly<{
  retrievedAt: Date;
  sourceKind: PoiSourceKind;
  sourceUrl: string;
}>;

function textOrNull(value: string | undefined): string | null {
  return value ?? null;
}

function toBoundary(
  value: VietmapSearchResult["boundaries"][number],
): PoiBoundary {
  return {
    fullName: textOrNull(value.full_name),
    id: String(value.id),
    name: textOrNull(value.name),
    prefix: textOrNull(value.prefix),
    type: value.type,
  };
}

function variantAddress(
  variant: VietmapSearchResult["data_old"],
): string | null {
  return variant?.display ?? variant?.address ?? null;
}

function normalizeResult(
  result: VietmapSearchResult,
  context: VietmapNormalizationContext,
): NormalizedPoi {
  const address = result.address ?? result.display;
  if (!address) {
    throw new Error(`VIETMAP POI ${result.ref_id} has no address`);
  }
  if (result.lat === undefined || result.lng === undefined) {
    throw new Error(`VIETMAP POI ${result.ref_id} has no coordinates`);
  }

  return {
    address,
    addressCurrent: variantAddress(result.data_new),
    addressLegacy: variantAddress(result.data_old),
    boundaries: result.boundaries.map(toBoundary),
    categories: result.categories,
    display: result.display ?? null,
    distanceKilometers: result.distance ?? null,
    isSimulated: context.sourceKind === "synthetic_fixture",
    latitude: result.lat,
    longitude: result.lng,
    name: result.name,
    provider: POI_PROVIDER,
    providerPlaceId: result.ref_id,
    providerProduct: POI_PROVIDER_PRODUCT,
    rawData: asProviderPayload(result),
    retrievedAt: context.retrievedAt,
    sourceUrl: context.sourceUrl,
  };
}

export function normalizeVietmapSearchResponse(
  payload: unknown,
  context: VietmapNormalizationContext,
): readonly NormalizedPoi[] {
  return parseVietmapSearchResponse(payload).map((result) =>
    normalizeResult(result, context),
  );
}
