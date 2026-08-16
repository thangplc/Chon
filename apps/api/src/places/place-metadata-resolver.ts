import type { ApiEnvironment } from "../config/api-environment";
import type { PlaceMetadataOverlayAmenities } from "../database/schema/place-metadata-overlays";
import type {
  PlaceMetadata,
  PlaceOpeningHours,
  PriceLevel,
  SizeCategory,
} from "../../../../packages/domain/src/place-detail/place-detail";

export type CanonicalPlaceMetadata = Readonly<{
  currency: string;
  estimatedCapacity: number | null;
  openingHours: PlaceOpeningHours | null;
  priceLevel: PriceLevel | null;
  sizeCategory: SizeCategory;
  typicalSpendMax: number | null;
  typicalSpendMin: number | null;
}>;

export type SyntheticPlaceMetadata = Readonly<{
  amenities: PlaceMetadataOverlayAmenities;
  currency: string;
  estimatedCapacity: number | null;
  openingHours: PlaceOpeningHours | null;
  priceLevel: PriceLevel | null;
  sizeCategory: SizeCategory;
  spaceNote: string | null;
  typicalSpendMax: number | null;
  typicalSpendMin: number | null;
}>;

export type ResolvedPlaceMetadata = Readonly<{
  amenities: readonly string[];
  currency: string;
  estimatedCapacity: number | null;
  metadata: PlaceMetadata;
  openingHours: PlaceOpeningHours | null;
  priceLevel: PriceLevel | null;
  sizeCategory: SizeCategory;
  spaceNote: string | null;
  typicalSpendMax: number | null;
  typicalSpendMin: number | null;
}>;

const CANONICAL_LABEL = "Thông tin canonical đã xác minh";
const SYNTHETIC_LABEL = "Dữ liệu minh họa — chưa xác minh";

function resolveOverlayValue<T>(
  canonical: T | null,
  synthetic: T | null,
  mode: ApiEnvironment["EXPLORE_PLACE_METADATA_MODE"],
): { usedSynthetic: boolean; value: T | null } {
  if (mode === "real") return { usedSynthetic: false, value: canonical };
  if (mode === "synthetic") {
    return {
      usedSynthetic: synthetic !== null,
      value: synthetic ?? canonical,
    };
  }

  return canonical !== null
    ? { usedSynthetic: false, value: canonical }
    : { usedSynthetic: synthetic !== null, value: synthetic };
}

function resolveOverlaySize(
  canonical: SizeCategory,
  synthetic: SizeCategory,
  mode: ApiEnvironment["EXPLORE_PLACE_METADATA_MODE"],
): { usedSynthetic: boolean; value: SizeCategory } {
  if (mode === "real" || canonical !== "unknown") {
    return { usedSynthetic: false, value: canonical };
  }
  if (mode === "mixed" && synthetic === "unknown") {
    return { usedSynthetic: false, value: canonical };
  }
  return {
    usedSynthetic: synthetic !== "unknown",
    value: synthetic === "unknown" ? canonical : synthetic,
  };
}

export function resolvePlaceMetadata(
  canonical: CanonicalPlaceMetadata,
  synthetic: SyntheticPlaceMetadata | null,
  mode: ApiEnvironment["EXPLORE_PLACE_METADATA_MODE"],
): ResolvedPlaceMetadata {
  const fallback: SyntheticPlaceMetadata = {
    amenities: [],
    currency: canonical.currency,
    estimatedCapacity: null,
    openingHours: null,
    priceLevel: null,
    sizeCategory: "unknown",
    spaceNote: null,
    typicalSpendMax: null,
    typicalSpendMin: null,
  };
  const overlay = synthetic ?? fallback;
  const openingHours = resolveOverlayValue(
    canonical.openingHours,
    overlay.openingHours,
    mode,
  );
  const priceLevel = resolveOverlayValue(
    canonical.priceLevel,
    overlay.priceLevel,
    mode,
  );
  const typicalSpendMin = resolveOverlayValue(
    canonical.typicalSpendMin,
    overlay.typicalSpendMin,
    mode,
  );
  const typicalSpendMax = resolveOverlayValue(
    canonical.typicalSpendMax,
    overlay.typicalSpendMax,
    mode,
  );
  const estimatedCapacity = resolveOverlayValue(
    canonical.estimatedCapacity,
    overlay.estimatedCapacity,
    mode,
  );
  const spaceNote = resolveOverlayValue(null, overlay.spaceNote, mode);
  const sizeCategory = resolveOverlaySize(
    canonical.sizeCategory,
    overlay.sizeCategory,
    mode,
  );
  const useSyntheticAmenities = mode !== "real" && overlay.amenities.length > 0;
  const syntheticCurrency = resolveOverlayValue(
    canonical.currency,
    overlay.currency,
    mode,
  );
  const usedSynthetic =
    synthetic !== null &&
    (openingHours.usedSynthetic ||
      priceLevel.usedSynthetic ||
      typicalSpendMin.usedSynthetic ||
      typicalSpendMax.usedSynthetic ||
      estimatedCapacity.usedSynthetic ||
      sizeCategory.usedSynthetic ||
      spaceNote.usedSynthetic ||
      useSyntheticAmenities ||
      syntheticCurrency.usedSynthetic);

  return {
    amenities: useSyntheticAmenities ? overlay.amenities : [],
    currency: syntheticCurrency.value ?? canonical.currency,
    estimatedCapacity: estimatedCapacity.value,
    metadata: {
      isSimulated: usedSynthetic,
      label: usedSynthetic ? SYNTHETIC_LABEL : CANONICAL_LABEL,
      source: usedSynthetic ? "synthetic" : "canonical",
    },
    openingHours: openingHours.value,
    priceLevel: priceLevel.value,
    sizeCategory: sizeCategory.value,
    spaceNote: spaceNote.value,
    typicalSpendMax: typicalSpendMax.value,
    typicalSpendMin: typicalSpendMin.value,
  };
}
