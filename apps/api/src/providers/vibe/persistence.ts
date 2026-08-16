import type { InferInsertModel } from "drizzle-orm";

import { providerVibeSignals } from "../../database/schema/provider-vibe-signals";
import type { ProviderVibeSignalInput } from "./normalizer";

export type ProviderVibeSignalInsert = InferInsertModel<
  typeof providerVibeSignals
>;

export function toProviderVibeSignalInsert(
  input: ProviderVibeSignalInput,
): ProviderVibeSignalInsert {
  return {
    attributionText: input.attributionText,
    confidenceScore: input.confidenceScore,
    crowd: input.crowd,
    dayType: input.dayType,
    expiresAt: input.expiresAt,
    lighting: input.lighting,
    mappingVersion: input.mappingVersion,
    noise: input.noise,
    observedAt: input.observedAt,
    placeId: input.placeId,
    placeSourceId: input.placeSourceId,
    privacy: input.privacy,
    providerProduct: input.providerProduct,
    providerSignalId: input.providerSignalId,
    rawData: input.rawData,
    retrievedAt: input.retrievedAt,
    signalType: input.signalType,
    signalValue: input.signalValue,
    socialEnergy: input.socialEnergy,
    sourceUrl: input.sourceUrl,
    storagePolicy: input.storagePolicy,
    timeBucket: input.timeBucket,
    workability: input.workability,
  };
}
