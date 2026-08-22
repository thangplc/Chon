import type {
  ExploreSourcePlace,
  ExplorePriceLevel,
  ExploreSizeCategory,
} from "../../../../packages/domain/src/explore/explore-contract";

export type ExploreDatasetQuery = Readonly<{
  amenities: readonly string[];
  priceLevels: readonly ExplorePriceLevel[];
  priceMax: number | null;
  priceMin: number | null;
  sizeCategories: readonly ExploreSizeCategory[];
}>;

const sizeIds = new Set<ExploreSizeCategory>([
  "small",
  "medium",
  "large",
  "unknown",
]);
const priceLevelIds = new Set<ExplorePriceLevel>([1, 2, 3, 4]);

const priceRanges: Readonly<
  Record<string, Readonly<{ max: number | null; min: number | null }>>
> = {
  "100-200": { max: 200_000, min: 100_000 },
  "50-100": { max: 100_000, min: 50_000 },
  "over-200": { max: null, min: 200_000 },
  "under-50": { max: 50_000, min: null },
};

function parseList(value: string | null): readonly string[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].slice(0, 100);
}

export function parseExploreDatasetQuery(
  searchParams: URLSearchParams,
): ExploreDatasetQuery {
  const sizes = parseList(searchParams.get("size")).filter(
    (value): value is ExploreSizeCategory =>
      sizeIds.has(value as ExploreSizeCategory),
  );
  const priceLevels = parseList(searchParams.get("price_levels"))
    .map(Number)
    .filter((value): value is ExplorePriceLevel =>
      priceLevelIds.has(value as ExplorePriceLevel),
    );
  const priceRange = priceRanges[searchParams.get("price_range") ?? ""] ?? {
    max: null,
    min: null,
  };

  return {
    amenities: parseList(searchParams.get("amenities")),
    priceLevels: [...new Set(priceLevels)],
    priceMax: priceRange.max,
    priceMin: priceRange.min,
    sizeCategories: [...new Set(sizes)],
  };
}

export const emptyExploreDatasetQuery: ExploreDatasetQuery = {
  amenities: [],
  priceLevels: [],
  priceMax: null,
  priceMin: null,
  sizeCategories: [],
};

export function matchesExploreMetadataQuery(
  place: ExploreSourcePlace,
  query: ExploreDatasetQuery,
): boolean {
  if (
    query.sizeCategories.length > 0 &&
    !query.sizeCategories.includes(place.sizeCategory)
  ) {
    return false;
  }

  if (
    query.amenities.length > 0 &&
    !query.amenities.every((amenity) => place.amenities.includes(amenity))
  ) {
    return false;
  }

  if (
    query.priceLevels.length > 0 &&
    (place.priceLevel === null || !query.priceLevels.includes(place.priceLevel))
  ) {
    return false;
  }

  const hasPriceRange = query.priceMin !== null || query.priceMax !== null;
  if (!hasPriceRange) return true;

  const placeMinimum = place.typicalSpendMin ?? place.typicalSpendMax;
  const placeMaximum = place.typicalSpendMax ?? place.typicalSpendMin;
  if (placeMinimum === null || placeMaximum === null) return false;

  if (query.priceMin !== null && placeMaximum < query.priceMin) return false;
  if (query.priceMax !== null && placeMinimum > query.priceMax) return false;

  return true;
}
