// Pure deterministic ranking logic shared independently from React and NestJS.
import type {
  ExploreCommunityReport,
  ExploreDataset,
  ExploreDayType,
  ExploreDistrict,
  ExplorePriceLevel,
  ExploreSizeCategory,
  ExploreSourcePlace,
  ExploreVibeSnapshot,
  PurposeId,
  TimeBucket,
  VibeDimension,
  VibeScores,
} from "./explore-contract";
import {
  getDayTypeForDate,
  getTimeBucketForLocalTime,
} from "../vibe/vibe-snapshot";
import { purposePreferences } from "./purpose-preferences";
import { explainPurposeMatch, type ExploreExplanation } from "./explanation";

const dimensions: readonly VibeDimension[] = [
  "noise",
  "crowd",
  "lighting",
  "privacy",
  "workability",
  "socialEnergy",
];

export { purposePreferences } from "./purpose-preferences";
export { explainPurposeMatch } from "./explanation";
export type { ExploreExplanation } from "./explanation";

export type ExplorePlace = ExploreSourcePlace &
  Readonly<{
    confidence: "insufficient" | "low" | "medium" | "high";
    explanation: ExploreExplanation;
    matchScore: number | null;
    providerSignalCount: number;
    reportCount: number;
    vibeIsSimulated: boolean;
    vibe: VibeScores | null;
  }>;

export type ExploreFilters = Readonly<{
  dayType?: ExploreDayType;
  district: "all" | ExploreDistrict;
  amenities?: ReadonlySet<string>;
  placeIds?: ReadonlySet<string>;
  priceLevels?: ReadonlySet<ExplorePriceLevel>;
  priceMax?: number | null;
  priceMin?: number | null;
  purpose: PurposeId;
  sizeCategories?: ReadonlySet<ExploreSizeCategory>;
  timeBucket: TimeBucket;
}>;

function matchesMetadataFilters(
  place: ExploreSourcePlace,
  filters: ExploreFilters,
): boolean {
  if (
    filters.sizeCategories &&
    filters.sizeCategories.size > 0 &&
    !filters.sizeCategories.has(place.sizeCategory)
  ) {
    return false;
  }

  if (
    filters.amenities &&
    filters.amenities.size > 0 &&
    ![...filters.amenities].every((amenity) =>
      place.amenities.includes(amenity),
    )
  ) {
    return false;
  }

  if (filters.priceLevels && filters.priceLevels.size > 0) {
    if (
      place.priceLevel === null ||
      !filters.priceLevels.has(place.priceLevel)
    ) {
      return false;
    }
  }

  const hasPriceRange =
    (filters.priceMin !== null && filters.priceMin !== undefined) ||
    (filters.priceMax !== null && filters.priceMax !== undefined);
  if (hasPriceRange) {
    const placeMinimum = place.typicalSpendMin ?? place.typicalSpendMax;
    const placeMaximum = place.typicalSpendMax ?? place.typicalSpendMin;
    if (placeMinimum === null || placeMaximum === null) return false;

    if (
      filters.priceMin !== null &&
      filters.priceMin !== undefined &&
      placeMaximum < filters.priceMin
    ) {
      return false;
    }
    if (
      filters.priceMax !== null &&
      filters.priceMax !== undefined &&
      placeMinimum > filters.priceMax
    ) {
      return false;
    }
  }

  return true;
}

function averageScores(
  reports: readonly ExploreCommunityReport[],
): VibeScores | null {
  if (reports.length === 0) return null;

  return Object.fromEntries(
    dimensions.map((dimension) => [
      dimension,
      reports.reduce((total, item) => total + item.scores[dimension], 0) /
        reports.length,
    ]),
  ) as unknown as VibeScores;
}

function completeScores(
  scores: ExploreVibeSnapshot["scores"],
): VibeScores | null {
  const values = dimensions.map((dimension) => scores[dimension]);
  return values.every((value): value is number => typeof value === "number")
    ? (Object.fromEntries(
        dimensions.map((dimension) => [dimension, scores[dimension]]),
      ) as VibeScores)
    : null;
}

function selectCanonicalVibe(
  dataset: ExploreDataset,
  placeId: string,
  timeBucket: TimeBucket,
  dayType: ExploreDayType = "weekday",
): ExploreVibeSnapshot | null {
  const candidates = dataset.vibes.filter(
    (snapshot) =>
      snapshot.placeId === placeId && snapshot.timeBucket === timeBucket,
  );
  return (
    candidates.find(
      ({ dayType: candidateDayType }) => candidateDayType === dayType,
    ) ??
    candidates.find(({ dayType }) => dayType === "weekday") ??
    candidates[0] ??
    null
  );
}

export function getExploreTimeContext(
  dateValue: string,
  timeValue: string,
): Readonly<{ dayType: ExploreDayType; timeBucket: TimeBucket }> | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;
  if (!/^\d{2}:\d{2}$/.test(timeValue)) return null;

  const [hour, minute] = timeValue.split(":").map(Number);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const date = new Date(`${dateValue}T${timeValue}:00+07:00`);
  if (Number.isNaN(date.getTime())) return null;

  return {
    dayType: getDayTypeForDate(date, "Asia/Ho_Chi_Minh"),
    timeBucket: getTimeBucketForLocalTime(hour, minute),
  };
}

export function calculateMatchScore(
  vibe: VibeScores,
  purpose: PurposeId,
): number {
  const preference = purposePreferences[purpose];
  const totalWeight = dimensions.reduce(
    (total, dimension) => total + preference.weights[dimension],
    0,
  );
  const weightedTotal = dimensions.reduce((score, dimension) => {
    const dimensionScore = Math.max(
      0,
      100 - Math.abs(vibe[dimension] - preference.targets[dimension]) * 25,
    );
    return score + dimensionScore * preference.weights[dimension];
  }, 0);

  return Math.round(weightedTotal / totalWeight);
}

export function getExplorePlaces(
  dataset: ExploreDataset,
  filters: ExploreFilters,
): ExplorePlace[] {
  return dataset.places
    .filter(
      (place) =>
        filters.district === "all" || place.district === filters.district,
    )
    .filter((place) => !filters.placeIds || filters.placeIds.has(place.id))
    .filter((place) => matchesMetadataFilters(place, filters))
    .map((place): ExplorePlace => {
      const canonicalVibe = selectCanonicalVibe(
        dataset,
        place.id,
        filters.timeBucket,
        filters.dayType,
      );
      const relevantReports =
        dataset.source === "database_simulated_csv" &&
        dataset.vibes.length === 0
          ? dataset.reports.filter(
              (report) =>
                report.placeId === place.id &&
                report.timeBucket === filters.timeBucket,
            )
          : [];
      const vibe = canonicalVibe
        ? completeScores(canonicalVibe.scores)
        : averageScores(relevantReports);

      return {
        ...place,
        confidence: canonicalVibe
          ? canonicalVibe.reportCount === 0 && vibe === null
            ? "insufficient"
            : canonicalVibe.confidence.level
          : relevantReports.length === 0
            ? "insufficient"
            : relevantReports.length === 1
              ? "low"
              : "medium",
        explanation: explainPurposeMatch(vibe, filters.purpose),
        matchScore: vibe ? calculateMatchScore(vibe, filters.purpose) : null,
        providerSignalCount: canonicalVibe?.providerSignalCount ?? 0,
        reportCount: canonicalVibe?.reportCount ?? relevantReports.length,
        vibeIsSimulated:
          canonicalVibe?.isSimulated ?? place.metadata.isSimulated,
        vibe,
      };
    })
    .sort((left, right) => {
      if (left.matchScore === null && right.matchScore === null) {
        return left.name.localeCompare(right.name, "vi");
      }
      if (left.matchScore === null) return 1;
      if (right.matchScore === null) return -1;
      return right.matchScore - left.matchScore;
    });
}
