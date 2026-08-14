// Pure deterministic ranking logic shared independently from React and NestJS.
import type {
  ExploreCommunityReport,
  ExploreDataset,
  ExploreDistrict,
  ExploreSourcePlace,
  PurposeId,
  TimeBucket,
  VibeDimension,
  VibeScores,
} from "./explore-contract";

const dimensions: readonly VibeDimension[] = [
  "noise",
  "crowd",
  "lighting",
  "privacy",
  "workability",
  "socialEnergy",
];

const purposeTargets: Readonly<Record<PurposeId, VibeScores>> = {
  business_meeting: {
    crowd: 2,
    lighting: 2,
    noise: 1,
    privacy: 5,
    socialEnergy: 2,
    workability: 5,
  },
  date: {
    crowd: 3,
    lighting: 5,
    noise: 2,
    privacy: 5,
    socialEnergy: 3,
    workability: 1,
  },
  friends: {
    crowd: 4,
    lighting: 4,
    noise: 4,
    privacy: 2,
    socialEnergy: 5,
    workability: 1,
  },
  late_night: {
    crowd: 3,
    lighting: 4,
    noise: 3,
    privacy: 3,
    socialEnergy: 4,
    workability: 1,
  },
  relax: {
    crowd: 2,
    lighting: 3,
    noise: 1,
    privacy: 4,
    socialEnergy: 1,
    workability: 2,
  },
  solo: {
    crowd: 2,
    lighting: 3,
    noise: 2,
    privacy: 4,
    socialEnergy: 2,
    workability: 3,
  },
  study: {
    crowd: 2,
    lighting: 1,
    noise: 1,
    privacy: 4,
    socialEnergy: 1,
    workability: 5,
  },
  work: {
    crowd: 2,
    lighting: 2,
    noise: 1,
    privacy: 4,
    socialEnergy: 1,
    workability: 5,
  },
};

export type ExplorePlace = ExploreSourcePlace &
  Readonly<{
    confidence: "insufficient" | "low" | "medium";
    matchScore: number | null;
    reportCount: number;
    vibe: VibeScores | null;
  }>;

type ExploreFilters = Readonly<{
  district: "all" | ExploreDistrict;
  purpose: PurposeId;
  timeBucket: TimeBucket;
}>;

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

function calculateMatchScore(vibe: VibeScores, purpose: PurposeId): number {
  const target = purposeTargets[purpose];
  const total = dimensions.reduce(
    (score, dimension) =>
      score +
      Math.max(0, 100 - Math.abs(vibe[dimension] - target[dimension]) * 25),
    0,
  );

  return Math.round(total / dimensions.length);
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
    .map((place): ExplorePlace => {
      const relevantReports = dataset.reports.filter(
        (report) =>
          report.placeId === place.id &&
          report.timeBucket === filters.timeBucket,
      );
      const vibe = averageScores(relevantReports);

      return {
        ...place,
        confidence:
          relevantReports.length === 0
            ? "insufficient"
            : relevantReports.length === 1
              ? "low"
              : "medium",
        matchScore: vibe ? calculateMatchScore(vibe, filters.purpose) : null,
        reportCount: relevantReports.length,
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
