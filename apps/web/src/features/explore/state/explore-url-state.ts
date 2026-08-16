import {
  purposes,
  type ExploreDistrict,
  type ExplorePriceLevel,
  type ExploreSizeCategory,
  type PurposeId,
  type TimeBucket,
} from "../domain/explore-contract";

export const exploreDurationOptions = [60, 90, 120, 180, 240] as const;
export const explorePriceRangeIds = [
  "any",
  "under-50",
  "50-100",
  "100-200",
  "over-200",
] as const;
export const exploreTimeBuckets = [
  "morning",
  "midday",
  "afternoon",
  "evening",
  "late",
] as const satisfies readonly TimeBucket[];

export type ExploreUrlState = Readonly<{
  amenities: readonly string[];
  dateValue: string;
  district: "all" | ExploreDistrict;
  durationMinutes: number;
  exactTime: string;
  locationQuery: string;
  priceLevels: readonly ExplorePriceLevel[];
  priceRangeId: (typeof explorePriceRangeIds)[number];
  purpose: PurposeId;
  sizes: readonly ExploreSizeCategory[];
  timeBucket: TimeBucket;
}>;

const purposeIds = new Set<PurposeId>(purposes.map(({ id }) => id));
const timeBucketIds = new Set<TimeBucket>(exploreTimeBuckets);
const districtTokens: Readonly<Record<string, ExploreDistrict>> = {
  binh_thanh: "Bình Thạnh",
  q1: "Quận 1",
  q3: "Quận 3",
};
const districtToToken = new Map(
  Object.entries(districtTokens).map(([token, district]) => [district, token]),
);
const sizeIds = new Set<ExploreSizeCategory>([
  "small",
  "medium",
  "large",
  "unknown",
]);
const priceLevelIds = new Set<ExplorePriceLevel>([1, 2, 3, 4]);
const priceRangeIdSet = new Set<string>(explorePriceRangeIds);
const durationSet = new Set<number>(exploreDurationOptions);

export function createDefaultExploreUrlState(
  dateValue: string,
): ExploreUrlState {
  return {
    amenities: [],
    dateValue,
    district: "all",
    durationMinutes: 120,
    exactTime: "09:00",
    locationQuery: "",
    priceLevels: [],
    priceRangeId: "any",
    purpose: "work",
    sizes: [],
    timeBucket: "morning",
  };
}

function parseList(value: string | null): readonly string[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ]
    .slice(0, 100)
    .sort((left, right) => left.localeCompare(right, "vi"));
}

function parseDate(value: string | null, fallback: string): string {
  return value && /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : fallback;
}

function parseTime(value: string | null, fallback: string): string {
  if (!value || !/^\d{2}:\d{2}$/u.test(value)) return fallback;
  const [hour, minute] = value.split(":").map(Number);
  return hour <= 23 && minute <= 59 ? value : fallback;
}

function parseInteger(
  value: string | null,
  allowed: ReadonlySet<number>,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && allowed.has(parsed) ? parsed : fallback;
}

export function parseExploreUrlState(
  search: string,
  fallback: ExploreUrlState,
): ExploreUrlState {
  const params = new URLSearchParams(search);
  const purposeValue = params.get("purpose");
  const timeBucketValue = params.get("time_bucket");
  const districtToken = params.get("district");
  const priceRangeValue = params.get("price_range");
  const parsedSizes = parseList(params.get("size")).filter(
    (value): value is ExploreSizeCategory =>
      sizeIds.has(value as ExploreSizeCategory),
  );
  const parsedPriceLevels = parseList(params.get("price_levels"))
    .map(Number)
    .filter((value): value is ExplorePriceLevel =>
      priceLevelIds.has(value as ExplorePriceLevel),
    )
    .sort((left, right) => left - right);

  return {
    amenities: parseList(params.get("amenities")),
    dateValue: parseDate(params.get("date"), fallback.dateValue),
    district:
      districtToken === null
        ? fallback.district
        : (districtTokens[districtToken] ?? "all"),
    durationMinutes: parseInteger(
      params.get("duration"),
      durationSet,
      fallback.durationMinutes,
    ),
    exactTime: parseTime(params.get("time"), fallback.exactTime),
    locationQuery: (params.get("q") ?? "").trim().slice(0, 120),
    priceLevels: [...new Set(parsedPriceLevels)],
    priceRangeId:
      priceRangeValue && priceRangeIdSet.has(priceRangeValue)
        ? (priceRangeValue as ExploreUrlState["priceRangeId"])
        : fallback.priceRangeId,
    purpose:
      purposeValue && purposeIds.has(purposeValue as PurposeId)
        ? (purposeValue as PurposeId)
        : fallback.purpose,
    sizes: [...new Set(parsedSizes)],
    timeBucket:
      timeBucketValue && timeBucketIds.has(timeBucketValue as TimeBucket)
        ? (timeBucketValue as TimeBucket)
        : fallback.timeBucket,
  };
}

export function serializeExploreUrlState(state: ExploreUrlState): string {
  const params = new URLSearchParams();
  params.set("purpose", state.purpose);
  params.set("date", state.dateValue);
  params.set("time", state.exactTime);
  params.set("duration", String(state.durationMinutes));
  if (state.district !== "all") {
    params.set("district", districtToToken.get(state.district) ?? "");
  }
  if (state.locationQuery) params.set("q", state.locationQuery);
  if (state.sizes.length > 0)
    params.set("size", [...state.sizes].sort().join(","));
  if (state.amenities.length > 0) {
    params.set(
      "amenities",
      [...state.amenities]
        .sort((left, right) => left.localeCompare(right, "vi"))
        .join(","),
    );
  }
  if (state.priceLevels.length > 0) {
    params.set(
      "price_levels",
      [...state.priceLevels].sort((left, right) => left - right).join(","),
    );
  }
  if (state.priceRangeId !== "any")
    params.set("price_range", state.priceRangeId);
  return `?${params.toString()}`;
}
