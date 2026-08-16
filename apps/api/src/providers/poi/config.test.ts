import { describe, expect, it } from "vitest";

import { readVietmapPoiConfig } from "./config";

describe("readVietmapPoiConfig", () => {
  it("keeps VIETMAP disabled without credentials by default", () => {
    const config = readVietmapPoiConfig({});

    expect(config).toMatchObject({
      enabled: false,
      maxRequests: 200,
      placeBaseUrl: "https://maps.vietmap.vn/api/place/v4",
      reverseBaseUrl: "https://maps.vietmap.vn/api/reverse/v4",
      productionReady: false,
      queryText: "cafe",
      timeoutMs: 5_000,
    });
  });

  it("requires an API key only when enabled", () => {
    expect(() =>
      readVietmapPoiConfig({ VIETMAP_POI_ENABLED: "true" }),
    ).toThrowError(
      "VIETMAP_API_KEY is required when VIETMAP_POI_ENABLED is enabled",
    );
  });

  it("reads category and bounded request settings", () => {
    const config = readVietmapPoiConfig({
      VIETMAP_API_KEY: "secret",
      VIETMAP_POI_CATEGORY_CAFE: "1001-1",
      VIETMAP_POI_ENABLED: "true",
      VIETMAP_POI_MAX_REQUESTS: "12",
      VIETMAP_POI_PRODUCTION_READY: "true",
      VIETMAP_POI_TIMEOUT_MS: "7000",
    });

    expect(config).toMatchObject({
      categoryCafe: "1001-1",
      enabled: true,
      maxRequests: 12,
      productionReady: true,
      timeoutMs: 7_000,
    });
  });
});
