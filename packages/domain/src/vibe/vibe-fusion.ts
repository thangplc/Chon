import type {
  ConfidenceLevel,
  DayType,
  TimeBucket,
  VibeDimension,
  VibeScoreMap,
  VibeSnapshot,
} from "./vibe-snapshot";
import { vibeDimensions } from "./vibe-snapshot";

export type VibeProviderSignalForFusion = Readonly<{
  confidenceScore: number;
  isSimulated: boolean;
  observedAt: Date | null;
  provider: string;
  providerProduct: string;
  retrievedAt: Date;
  scores: VibeScoreMap;
}>;

export type CanonicalVibeSnapshot = Readonly<{
  aggregationVersion: string;
  component: "canonical";
  confidenceLevel: ConfidenceLevel;
  confidenceScore: number;
  dayType: DayType;
  isSimulated: boolean;
  lastReportAt: Date;
  placeAreaId: string | null;
  placeId: string;
  providerSignalCount: number;
  reportCount: number;
  scores: VibeScoreMap;
  sourceDataTypes: readonly VibeSnapshot["sourceDataTypes"][number][];
  sourceProviders: readonly string[];
  timeBucket: TimeBucket;
}>;

export type VibeFusionContext = Readonly<{
  dayType: DayType;
  placeAreaId: string | null;
  placeId: string;
  timeBucket: TimeBucket;
}>;

export type VibeFusionOptions = Readonly<{
  /** Provider evidence is deliberately kept below first-party contribution evidence. */
  providerWeight?: number;
}>;

const DEFAULT_PROVIDER_WEIGHT = 0.2;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function hasScore(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasAnyScore(scores: VibeScoreMap): boolean {
  return vibeDimensions.some((dimension) => hasScore(scores[dimension]));
}

function latestEvidenceDate(
  contribution: VibeSnapshot | null,
  providerSignals: readonly VibeProviderSignalForFusion[],
): Date {
  const dates = [
    ...(contribution ? [contribution.lastReportAt] : []),
    ...providerSignals.map(
      ({ observedAt, retrievedAt }) => observedAt ?? retrievedAt,
    ),
  ];
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function confidenceLevel(
  contribution: VibeSnapshot | null,
  confidenceScore: number,
): ConfidenceLevel {
  // Provider signals may support a first-party result but cannot make it
  // "high" confidence without enough approved Chốn evidence.
  if (
    contribution &&
    contribution.reportCount >= 8 &&
    confidenceScore >= 0.75
  ) {
    return "high";
  }
  if (
    (contribution && contribution.reportCount >= 2 && confidenceScore >= 0.4) ||
    (!contribution && confidenceScore >= 0.4)
  ) {
    return "medium";
  }
  return "low";
}

function weightedScore(
  dimension: VibeDimension,
  contribution: VibeSnapshot | null,
  providerSignals: readonly VibeProviderSignalForFusion[],
  providerWeight: number,
): number | null {
  let numerator = 0;
  let denominator = 0;

  const contributionScore = contribution?.scores[dimension];
  if (hasScore(contributionScore)) {
    numerator += contributionScore;
    denominator += 1;
  }

  for (const signal of providerSignals) {
    const score = signal.scores[dimension];
    if (!hasScore(score)) continue;
    const weight = contribution
      ? providerWeight * signal.confidenceScore
      : signal.confidenceScore;
    if (weight <= 0) continue;
    numerator += score * weight;
    denominator += weight;
  }

  return denominator > 0 ? round(numerator / denominator) : null;
}

function providerConfidence(
  providerSignals: readonly VibeProviderSignalForFusion[],
): number {
  if (providerSignals.length === 0) return 0;
  return round(
    providerSignals.reduce(
      (total, signal) => total + signal.confidenceScore,
      0,
    ) / providerSignals.length,
  );
}

/**
 * Produce the single user-facing Chốn vibe result.
 *
 * Community/editorial contribution is the canonical base. Provider signals
 * can only add a bounded, provenance-preserving supplement. Synthetic
 * contribution is intentionally isolated from provider evidence so fixtures
 * never become a mixed production score.
 */
export function fuseVibeSnapshots(
  contribution: VibeSnapshot | null,
  providerSignals: readonly VibeProviderSignalForFusion[],
  context: VibeFusionContext,
  options: VibeFusionOptions = {},
): CanonicalVibeSnapshot | null {
  const providerWeight = options.providerWeight ?? DEFAULT_PROVIDER_WEIGHT;
  if (
    !Number.isFinite(providerWeight) ||
    providerWeight < 0 ||
    providerWeight > 1
  ) {
    throw new RangeError("providerWeight must be between 0 and 1");
  }

  const eligibleProviderSignals = contribution?.isSimulated
    ? []
    : providerSignals.filter(
        (signal) =>
          !signal.isSimulated &&
          hasAnyScore(signal.scores) &&
          signal.confidenceScore > 0,
      );
  const hasContributionScores = contribution
    ? hasAnyScore(contribution.scores)
    : false;
  if (!hasContributionScores && eligibleProviderSignals.length === 0) {
    return null;
  }

  const providerScore = providerConfidence(eligibleProviderSignals);
  const confidenceScore = round(
    contribution
      ? clamp(
          contribution.confidenceScore * (1 - providerWeight) +
            providerScore * providerWeight,
        )
      : providerScore,
  );

  return {
    aggregationVersion: "fusion-v1",
    component: "canonical",
    confidenceLevel: confidenceLevel(contribution, confidenceScore),
    confidenceScore,
    dayType: context.dayType,
    isSimulated: contribution?.isSimulated ?? false,
    lastReportAt: latestEvidenceDate(contribution, eligibleProviderSignals),
    placeAreaId: context.placeAreaId,
    placeId: context.placeId,
    providerSignalCount: eligibleProviderSignals.length,
    reportCount: contribution?.reportCount ?? 0,
    scores: Object.fromEntries(
      vibeDimensions.map((dimension) => [
        dimension,
        weightedScore(
          dimension,
          contribution,
          eligibleProviderSignals,
          providerWeight,
        ),
      ]),
    ) as VibeScoreMap,
    sourceDataTypes: contribution?.sourceDataTypes ?? [],
    sourceProviders: [
      ...new Set(eligibleProviderSignals.map(({ provider }) => provider)),
    ].sort(),
    timeBucket: context.timeBucket,
  };
}
