import { describe, expect, it } from "vitest";

import { readProviderVibeConfig } from "./config";

describe("readProviderVibeConfig", () => {
  it("keeps every provider disabled by default", () => {
    const config = readProviderVibeConfig({ NODE_ENV: "development" });

    expect(config.enabled).toBe(false);
    expect(
      Object.values(config.providers).every(
        ({ ingestEnabled, rankingEnabled }) =>
          !ingestEnabled && !rankingEnabled,
      ),
    ).toBe(true);
  });

  it("lets the master flag override provider requests without credentials", () => {
    const config = readProviderVibeConfig({
      FOURSQUARE_VIBE_INGEST_ENABLED: "true",
      FOURSQUARE_VIBE_RANKING_ENABLED: "true",
      NODE_ENV: "development",
      THIRD_PARTY_VIBE_ENABLED: "false",
    });

    expect(config.providers.foursquare_places).toMatchObject({
      ingestEnabled: false,
      ingestRequested: true,
      rankingEnabled: false,
      rankingRequested: true,
    });
  });

  it("requires a credential only when ingestion is effectively enabled", () => {
    expect(() =>
      readProviderVibeConfig({
        GOOGLE_VIBE_INGEST_ENABLED: "true",
        NODE_ENV: "development",
        THIRD_PARTY_VIBE_ENABLED: "true",
      }),
    ).toThrowError(
      "GOOGLE_PLACES_API_KEY is required when GOOGLE_VIBE_INGEST_ENABLED is enabled",
    );
  });

  it("allows ranking cached data without a provider credential", () => {
    const config = readProviderVibeConfig({
      NODE_ENV: "development",
      THIRD_PARTY_VIBE_ENABLED: "true",
      YELP_VIBE_RANKING_ENABLED: "true",
    });

    expect(config.providers.yelp).toMatchObject({
      credential: undefined,
      ingestEnabled: false,
      rankingEnabled: true,
    });
  });

  it("blocks a provider that has not passed its production gate", () => {
    expect(() =>
      readProviderVibeConfig({
        NODE_ENV: "production",
        THIRD_PARTY_VIBE_ENABLED: "true",
        TRIPADVISOR_VIBE_RANKING_ENABLED: "true",
      }),
    ).toThrowError(
      "TRIPADVISOR_VIBE_PRODUCTION_READY must be true before enabling tripadvisor in production",
    );
  });

  it("rejects ambiguous boolean values", () => {
    expect(() =>
      readProviderVibeConfig({
        NODE_ENV: "development",
        THIRD_PARTY_VIBE_ENABLED: "yes",
      }),
    ).toThrowError("THIRD_PARTY_VIBE_ENABLED must be either true or false");
  });
});
