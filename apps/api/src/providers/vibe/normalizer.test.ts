import { describe, expect, it } from "vitest";

import { ProviderVibeNormalizationError } from "./allowlist";
import {
  normalizeProviderVibeSignal,
  type ProviderVibeNormalizationContext,
} from "./normalizer";

const context: ProviderVibeNormalizationContext = {
  attributionText: "Provider attribution",
  placeId: "place-1",
  placeSourceId: "source-1",
  providerPlaceId: "provider-place-1",
  retrievedAt: new Date("2026-08-14T10:00:00.000Z"),
  sourceUrl: "https://provider.example/places/provider-place-1",
};

describe("provider vibe normalizer", () => {
  it("strips content and dimensions for reference-only signals", () => {
    const result = normalizeProviderVibeSignal(
      "google_places",
      {
        confidenceScore: 0.4,
        providerProduct: "places_api_new",
        providerSignalId: "provider-place-1:rating",
        signalType: "rating",
      },
      context,
    );

    expect(result).toMatchObject({
      confidenceScore: 0.4,
      providerProduct: "places_api_new",
      providerSignalId: "provider-place-1:rating",
      signalType: "rating",
      signalValue: null,
      storagePolicy: "reference_only",
    });
    expect(result.noise).toBeNull();
    expect(result.mappingVersion).toBeNull();
    expect(result.expiresAt).toBeNull();
  });

  it("adds the allowlisted 24-hour TTL for Yelp cache signals", () => {
    const result = normalizeProviderVibeSignal(
      "yelp",
      {
        confidenceScore: 0.35,
        providerProduct: "places",
        providerSignalId: "provider-place-1:rating",
        signalType: "rating",
        signalValue: { rating: 4.2 },
        storagePolicy: "ttl_cache",
      },
      context,
    );

    expect(result.storagePolicy).toBe("ttl_cache");
    expect(result.signalValue).toEqual({ rating: 4.2 });
    expect(result.expiresAt?.toISOString()).toBe("2026-08-15T10:00:00.000Z");
  });

  it("rejects unsupported fields and time inference", () => {
    expect(() =>
      normalizeProviderVibeSignal(
        "google_places",
        {
          confidenceScore: 0.4,
          dimensionScores: { noise: 1 },
          mappingVersion: "v1",
          providerProduct: "places_api_new",
          providerSignalId: "provider-place-1:rating",
          signalType: "rating",
        },
        context,
      ),
    ).toThrow(ProviderVibeNormalizationError);

    expect(() =>
      normalizeProviderVibeSignal(
        "google_places",
        {
          confidenceScore: 0.4,
          providerProduct: "places_api_new",
          providerSignalId: "provider-place-1:rating",
          signalType: "rating",
          timeBucket: "morning",
        },
        context,
      ),
    ).toThrow("day_type and time_bucket must be provided together");
  });

  it("rejects raw payload persistence when terms disallow it", () => {
    expect(() =>
      normalizeProviderVibeSignal(
        "google_places",
        {
          confidenceScore: 0.4,
          providerProduct: "places_api_new",
          providerSignalId: "provider-place-1:rating",
          rawData: { review: "private content" },
          signalType: "rating",
        },
        context,
      ),
    ).toThrow("raw_data is not allowed");
  });
});
