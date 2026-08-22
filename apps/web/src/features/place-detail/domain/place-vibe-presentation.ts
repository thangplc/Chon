import type { VibeSnapshotApiItem } from "@chon/contracts/backend";
import {
  calculateMatchScore,
  explainPurposeMatch,
  type ExploreExplanation,
} from "@chon/domain/explore";
import type {
  ExploreDayType,
  PurposeId,
  TimeBucket,
  VibeDimension,
  VibeScores,
} from "@chon/domain/explore-contract";

export type PlaceDetailIntent = Readonly<{
  dayType: ExploreDayType;
  purpose: PurposeId;
  purposeLabel: string;
  timeBucket: TimeBucket;
  timeLabel: string;
}>;

export type PlaceVibePresentation = Readonly<{
  availableScores: Partial<VibeScores>;
  coverage: number;
  explanation: ExploreExplanation;
  matchScore: number | null;
  snapshot: VibeSnapshotApiItem | null;
  scores: Partial<VibeScores> | null;
}>;

const dimensions: readonly VibeDimension[] = [
  "noise",
  "crowd",
  "lighting",
  "privacy",
  "workability",
  "socialEnergy",
];

function completeScores(
  scores: VibeSnapshotApiItem["scores"],
): VibeScores | null {
  if (dimensions.some((dimension) => scores[dimension] === null)) return null;

  return Object.fromEntries(
    dimensions.map((dimension) => [dimension, scores[dimension]]),
  ) as VibeScores;
}

function availableScores(
  scores: VibeSnapshotApiItem["scores"],
): Partial<VibeScores> {
  return Object.fromEntries(
    dimensions.flatMap((dimension) => {
      const value = scores[dimension];
      return typeof value === "number" ? [[dimension, value]] : [];
    }),
  );
}

function selectSnapshot(
  snapshots: readonly VibeSnapshotApiItem[],
  intent: PlaceDetailIntent,
): VibeSnapshotApiItem | null {
  const candidates = snapshots.filter(
    ({ placeAreaId, timeBucket }) =>
      placeAreaId === null && timeBucket === intent.timeBucket,
  );

  return (
    candidates.find(({ dayType }) => dayType === intent.dayType) ??
    candidates.find(({ dayType }) => dayType === "weekday") ??
    candidates[0] ??
    snapshots.find(({ placeAreaId }) => placeAreaId === null) ??
    null
  );
}

export function buildPlaceVibePresentation(
  snapshots: readonly VibeSnapshotApiItem[],
  intent: PlaceDetailIntent,
): PlaceVibePresentation {
  const snapshot = selectSnapshot(snapshots, intent);
  const complete = snapshot ? completeScores(snapshot.scores) : null;
  const available = snapshot ? availableScores(snapshot.scores) : {};
  const scores = Object.keys(available).length > 0 ? available : null;

  return {
    availableScores: available,
    coverage: Object.keys(available).length,
    explanation: explainPurposeMatch(scores, intent.purpose),
    matchScore: scores ? calculateMatchScore(scores, intent.purpose) : null,
    scores: complete ?? scores,
    snapshot,
  };
}
