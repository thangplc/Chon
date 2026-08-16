import type {
  DayType,
  TimeBucket,
  VibeDimension,
} from "../../../../../packages/domain/src/vibe/vibe-snapshot";
import type { ProviderVibeProvider } from "./config";
import {
  getProviderVibeAllowlist,
  ProviderVibeNormalizationError,
  type ProviderVibeStoragePolicy,
} from "./allowlist";

export type ProviderVibeJsonObject = Readonly<Record<string, unknown>>;

export type ProviderVibeNormalizationContext = Readonly<{
  placeId: string;
  placeSourceId: string;
  providerPlaceId: string;
  retrievedAt: Date;
  sourceUrl?: string;
  attributionText?: string;
}>;

export type ProviderVibeSignalDraft = Readonly<{
  confidenceScore: number;
  dayType?: DayType;
  dimensionScores?: Partial<Record<VibeDimension, number>>;
  expiresAt?: Date;
  mappingVersion?: string;
  observedAt?: Date;
  providerProduct: string;
  providerSignalId: string;
  rawData?: ProviderVibeJsonObject;
  signalType: string;
  signalValue?: ProviderVibeJsonObject;
  sourceUrl?: string;
  storagePolicy?: ProviderVibeStoragePolicy;
  timeBucket?: TimeBucket;
  attributionText?: string;
}>;

export type ProviderVibeSignalInput = Readonly<{
  attributionText: string | null;
  confidenceScore: number;
  dayType: DayType | null;
  expiresAt: Date | null;
  mappingVersion: string | null;
  observedAt: Date | null;
  placeId: string;
  placeSourceId: string;
  privacy: number | null;
  providerProduct: string;
  providerSignalId: string;
  rawData: ProviderVibeJsonObject | null;
  retrievedAt: Date;
  signalType: string;
  signalValue: ProviderVibeJsonObject | null;
  sourceUrl: string | null;
  storagePolicy: ProviderVibeStoragePolicy;
  timeBucket: TimeBucket | null;
  lighting: number | null;
  noise: number | null;
  crowd: number | null;
  workability: number | null;
  socialEnergy: number | null;
}>;

const dimensions: readonly VibeDimension[] = [
  "noise",
  "crowd",
  "lighting",
  "privacy",
  "workability",
  "socialEnergy",
];

function assertDate(value: Date | undefined, field: string): Date | null {
  if (value === undefined) return null;
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new ProviderVibeNormalizationError(`${field} must be a valid date`);
  }
  return value;
}

function assertText(value: string | undefined, field: string, maximum: number) {
  if (value === undefined) return null;
  const normalized = value.trim();
  if (!normalized) {
    throw new ProviderVibeNormalizationError(`${field} must not be blank`);
  }
  if (normalized.length > maximum) {
    throw new ProviderVibeNormalizationError(
      `${field} must be at most ${maximum} characters`,
    );
  }
  return normalized;
}

function assertUrl(value: string | undefined, field: string): string | null {
  const normalized = assertText(value, field, 2_048);
  if (normalized === null) return null;
  try {
    new URL(normalized);
  } catch {
    throw new ProviderVibeNormalizationError(`${field} must be a valid URL`);
  }
  return normalized;
}

function assertDimensionScores(
  scores: ProviderVibeSignalDraft["dimensionScores"],
  allowlisted: boolean,
): Partial<Record<VibeDimension, number>> {
  if (!scores) return {};
  if (!allowlisted) {
    throw new ProviderVibeNormalizationError(
      "Provider dimension mapping is not allowed by the current terms allowlist",
    );
  }

  for (const dimension of dimensions) {
    const value = scores[dimension];
    if (
      value !== undefined &&
      (!Number.isFinite(value) || value < 1 || value > 5)
    ) {
      throw new ProviderVibeNormalizationError(
        `${dimension} must be between 1 and 5`,
      );
    }
  }
  return scores;
}

function assertSignalValue(
  value: ProviderVibeJsonObject | undefined,
  required: boolean,
): ProviderVibeJsonObject | null {
  if (!value) {
    if (required) {
      throw new ProviderVibeNormalizationError(
        "signal_value is required by storage policy",
      );
    }
    return null;
  }
  return value;
}

export function normalizeProviderVibeSignal(
  provider: ProviderVibeProvider,
  draft: ProviderVibeSignalDraft,
  context: ProviderVibeNormalizationContext,
): ProviderVibeSignalInput {
  const allowlist = getProviderVibeAllowlist(provider, draft.providerProduct);
  if (!allowlist.signalTypes.includes(draft.signalType)) {
    throw new ProviderVibeNormalizationError(
      `Signal type is not allowlisted: ${provider}/${draft.providerProduct}/${draft.signalType}`,
    );
  }

  const providerSignalId = assertText(
    draft.providerSignalId,
    "provider_signal_id",
    255,
  );
  if (!providerSignalId) {
    throw new ProviderVibeNormalizationError("provider_signal_id is required");
  }
  const confidenceScore = draft.confidenceScore;
  if (
    !Number.isFinite(confidenceScore) ||
    confidenceScore < 0 ||
    confidenceScore > 1
  ) {
    throw new ProviderVibeNormalizationError(
      "confidence_score must be between 0 and 1",
    );
  }

  const storagePolicy = draft.storagePolicy ?? allowlist.defaultStoragePolicy;
  if (!allowlist.allowedStoragePolicies.includes(storagePolicy)) {
    throw new ProviderVibeNormalizationError(
      `Storage policy is not allowlisted for ${provider}/${draft.providerProduct}: ${storagePolicy}`,
    );
  }
  if (storagePolicy === "ttl_cache" && !allowlist.ttlSeconds) {
    throw new ProviderVibeNormalizationError(
      `TTL storage is missing a configured TTL for ${provider}/${draft.providerProduct}`,
    );
  }

  const retrievedAt = assertDate(context.retrievedAt, "retrieved_at");
  if (!retrievedAt) {
    throw new ProviderVibeNormalizationError("retrieved_at is required");
  }
  const observedAt = assertDate(draft.observedAt, "observed_at");
  const requestedExpiresAt = assertDate(draft.expiresAt, "expires_at");
  const expiresAt =
    storagePolicy === "ttl_cache"
      ? (requestedExpiresAt ??
        new Date(retrievedAt.getTime() + (allowlist.ttlSeconds ?? 0) * 1_000))
      : requestedExpiresAt;
  if (expiresAt && expiresAt <= retrievedAt) {
    throw new ProviderVibeNormalizationError(
      "expires_at must be after retrieved_at",
    );
  }
  if (storagePolicy === "reference_only" && draft.expiresAt) {
    throw new ProviderVibeNormalizationError(
      "reference_only signals cannot define expires_at",
    );
  }

  if ((draft.dayType === undefined) !== (draft.timeBucket === undefined)) {
    throw new ProviderVibeNormalizationError(
      "day_type and time_bucket must be provided together",
    );
  }
  const dimensionScores = assertDimensionScores(
    draft.dimensionScores,
    allowlist.dimensionMappingAllowed,
  );
  const hasDimensionScores = dimensions.some(
    (dimension) => dimensionScores[dimension] !== undefined,
  );
  const mappingVersion = assertText(
    draft.mappingVersion,
    "mapping_version",
    64,
  );
  if (hasDimensionScores && !mappingVersion) {
    throw new ProviderVibeNormalizationError(
      "mapping_version is required when dimension scores are present",
    );
  }
  if (!hasDimensionScores && mappingVersion) {
    throw new ProviderVibeNormalizationError(
      "mapping_version requires at least one dimension score",
    );
  }

  const signalValue = assertSignalValue(
    draft.signalValue,
    storagePolicy !== "reference_only",
  );
  if (storagePolicy === "reference_only" && signalValue) {
    throw new ProviderVibeNormalizationError(
      "reference_only signals cannot persist signal_value",
    );
  }
  const rawData = draft.rawData ?? null;
  if (rawData && !allowlist.rawDataAllowed) {
    throw new ProviderVibeNormalizationError(
      "raw_data is not allowed by the current terms allowlist",
    );
  }

  const sourceUrl = assertUrl(
    draft.sourceUrl ?? context.sourceUrl,
    "source_url",
  );
  const attributionText = assertText(
    draft.attributionText ?? context.attributionText,
    "attribution_text",
    512,
  );
  const placeId = assertText(context.placeId, "place_id", 128);
  const placeSourceId = assertText(
    context.placeSourceId,
    "place_source_id",
    128,
  );
  const providerPlaceId = assertText(
    context.providerPlaceId,
    "provider_place_id",
    255,
  );
  if (!placeId || !placeSourceId || !providerPlaceId) {
    throw new ProviderVibeNormalizationError(
      "place_id, place_source_id and provider_place_id are required",
    );
  }

  if (storagePolicy === "reference_only") {
    return {
      attributionText,
      confidenceScore,
      crowd: null,
      dayType: draft.dayType ?? null,
      expiresAt: null,
      lighting: null,
      mappingVersion: null,
      noise: null,
      observedAt,
      placeId,
      placeSourceId,
      privacy: null,
      providerProduct: draft.providerProduct,
      providerSignalId,
      rawData: null,
      retrievedAt,
      signalType: draft.signalType,
      signalValue: null,
      socialEnergy: null,
      sourceUrl,
      storagePolicy,
      timeBucket: draft.timeBucket ?? null,
      workability: null,
    };
  }

  return {
    attributionText,
    confidenceScore,
    crowd: dimensionScores.crowd ?? null,
    dayType: draft.dayType ?? null,
    expiresAt,
    lighting: dimensionScores.lighting ?? null,
    mappingVersion: mappingVersion ?? null,
    noise: dimensionScores.noise ?? null,
    observedAt,
    placeId,
    placeSourceId,
    privacy: dimensionScores.privacy ?? null,
    providerProduct: draft.providerProduct,
    providerSignalId,
    rawData,
    retrievedAt,
    signalType: draft.signalType,
    signalValue,
    socialEnergy: dimensionScores.socialEnergy ?? null,
    sourceUrl,
    storagePolicy,
    timeBucket: draft.timeBucket ?? null,
    workability: dimensionScores.workability ?? null,
  };
}
