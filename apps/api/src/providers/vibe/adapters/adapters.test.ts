import { describe, expect, it } from "vitest";

import { createProviderVibeAdapterFactories } from ".";
import { PROVIDER_VIBE_FIXTURE_PAYLOADS } from "../fixtures";
import type { ProviderVibeNormalizationContext } from "../normalizer";

const context: ProviderVibeNormalizationContext = {
  placeId: "place-1",
  placeSourceId: "source-1",
  providerPlaceId: "provider-place-1",
  retrievedAt: new Date("2026-08-14T10:00:00.000Z"),
};

describe("provider vibe adapters", () => {
  it("normalizes supported fixture fields without provider calls", () => {
    const factories = createProviderVibeAdapterFactories();
    const cases = [
      {
        expectedSignalTypes: [
          "popularity",
          "rating",
          "price",
          "tastes",
          "hours_popular",
          "amenity",
        ],
        payload: PROVIDER_VIBE_FIXTURE_PAYLOADS.foursquare_places,
        provider: "foursquare_places" as const,
      },
      {
        expectedSignalTypes: ["rating", "rating_count", "amenity"],
        payload: PROVIDER_VIBE_FIXTURE_PAYLOADS.google_places,
        provider: "google_places" as const,
      },
      {
        expectedSignalTypes: ["rating", "price", "review_highlight"],
        payload: PROVIDER_VIBE_FIXTURE_PAYLOADS.yelp,
        provider: "yelp" as const,
      },
      {
        expectedSignalTypes: ["rating", "ranking", "trip_type"],
        payload: PROVIDER_VIBE_FIXTURE_PAYLOADS.tripadvisor,
        provider: "tripadvisor" as const,
      },
    ];

    for (const testCase of cases) {
      const adapter = factories[testCase.provider]?.({ credential: "fixture" });
      const result = adapter?.normalize(testCase.payload, context);

      expect(result?.map(({ signalType }) => signalType)).toEqual(
        testCase.expectedSignalTypes,
      );
      expect(
        result?.every(
          ({ placeId, placeSourceId }) =>
            placeId === "place-1" && placeSourceId === "source-1",
        ),
      ).toBe(true);
    }
  });

  it("keeps provider time context absent when the payload has none", () => {
    const adapter = createProviderVibeAdapterFactories().yelp?.({
      credential: "fixture",
    });
    const [signal] = adapter?.normalize({ rating: 4.1 }, context) ?? [];

    expect(signal?.dayType).toBeNull();
    expect(signal?.timeBucket).toBeNull();
  });

  it("rejects malformed provider fields before normalization", () => {
    const adapter = createProviderVibeAdapterFactories().google_places?.({
      credential: "fixture",
    });

    expect(() => adapter?.normalize({ rating: 9 }, context)).toThrow(
      "Invalid google_places response",
    );
  });
});
