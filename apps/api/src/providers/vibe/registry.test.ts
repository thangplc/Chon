import { describe, expect, it, vi } from "vitest";

import { readProviderVibeConfig } from "./config";
import { createProviderVibeRegistry } from "./registry";

describe("ProviderVibeRegistry", () => {
  it("does not initialize adapters eagerly", () => {
    const googleFactory = vi.fn(() => ({
      provider: "google_places" as const,
    }));
    const config = readProviderVibeConfig({
      GOOGLE_PLACES_API_KEY: "secret-value",
      GOOGLE_VIBE_INGEST_ENABLED: "true",
      NODE_ENV: "development",
      THIRD_PARTY_VIBE_ENABLED: "true",
    });

    createProviderVibeRegistry(config, { google_places: googleFactory });

    expect(googleFactory).not.toHaveBeenCalled();
  });

  it("blocks access to a disabled provider", () => {
    const registry = createProviderVibeRegistry(
      readProviderVibeConfig({ NODE_ENV: "development" }),
    );

    expect(() => registry.getIngestAdapter("yelp")).toThrowError(
      "Provider vibe ingestion is disabled for yelp",
    );
  });

  it("initializes an enabled adapter once and reuses it", () => {
    const googleFactory = vi.fn(() => ({
      provider: "google_places" as const,
    }));
    const config = readProviderVibeConfig({
      GOOGLE_PLACES_API_KEY: "secret-value",
      GOOGLE_VIBE_INGEST_ENABLED: "true",
      NODE_ENV: "development",
      THIRD_PARTY_VIBE_ENABLED: "true",
    });
    const registry = createProviderVibeRegistry(config, {
      google_places: googleFactory,
    });

    const firstAdapter = registry.getIngestAdapter("google_places");
    const secondAdapter = registry.getIngestAdapter("google_places");

    expect(firstAdapter).toBe(secondAdapter);
    expect(googleFactory).toHaveBeenCalledOnce();
    expect(googleFactory).toHaveBeenCalledWith({ credential: "secret-value" });
  });

  it("keeps ingestion and ranking selections independent", () => {
    const config = readProviderVibeConfig({
      FOURSQUARE_PLACES_TOKEN: "secret-value",
      FOURSQUARE_VIBE_INGEST_ENABLED: "true",
      NODE_ENV: "development",
      THIRD_PARTY_VIBE_ENABLED: "true",
      YELP_VIBE_RANKING_ENABLED: "true",
    });
    const registry = createProviderVibeRegistry(config);

    expect(registry.listIngestProviders()).toEqual(["foursquare_places"]);
    expect(registry.listRankingProviders()).toEqual(["yelp"]);
  });

  it("reports credential presence without exposing its value", () => {
    const config = readProviderVibeConfig({
      GOOGLE_PLACES_API_KEY: "must-not-leak",
      NODE_ENV: "development",
    });
    const registry = createProviderVibeRegistry(config);

    expect(registry.listStatuses()).toContainEqual(
      expect.objectContaining({
        credential: "configured",
        provider: "google_places",
      }),
    );
    expect(JSON.stringify(registry.listStatuses())).not.toContain(
      "must-not-leak",
    );
  });
});
