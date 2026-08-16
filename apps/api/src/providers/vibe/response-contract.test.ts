import { describe, expect, it } from "vitest";

import { createYelpAdapter } from "./adapters/yelp";
import {
  PROVIDER_VIBE_RESPONSE_CONTRACT_VERSION,
  parseProviderVibeResponse,
} from "./response-contract";

describe("provider response contracts", () => {
  it("exposes a versioned contract for validated payloads", () => {
    expect(PROVIDER_VIBE_RESPONSE_CONTRACT_VERSION).toBe("v1");
    expect(
      parseProviderVibeResponse("google_places", {
        rating: 4.2,
        userRatingCount: 10,
      }),
    ).toMatchObject({ rating: 4.2, userRatingCount: 10 });
  });

  it("keeps unknown fields out of the normalized adapter output", () => {
    const payload = parseProviderVibeResponse("yelp", {
      rating: 4.2,
      unknown_provider_field: "ignored by adapter",
    });
    expect(Object.keys(payload).includes("unknown_provider_field")).toBe(true);
    const [signal] = createYelpAdapter().normalize(payload, {
      placeId: "place-1",
      placeSourceId: "source-1",
      providerPlaceId: "yelp-place-1",
      retrievedAt: new Date("2026-08-14T10:00:00Z"),
    });
    expect(signal).not.toHaveProperty("unknown_provider_field");
  });

  it("rejects non-object payloads and invalid known fields", () => {
    expect(() => parseProviderVibeResponse("tripadvisor", [])).toThrow(
      "payload must be a JSON object",
    );
    expect(() =>
      parseProviderVibeResponse("foursquare_places", { rating: 8 }),
    ).toThrow("rating");
  });
});
