import { describe, expect, it } from "vitest";

import { readVietmapPoiConfig } from "./config";
import { PoiProviderRegistry } from "./registry";

describe("POI provider registry", () => {
  it("reports VIETMAP as disabled by default", () => {
    const registry = new PoiProviderRegistry(readVietmapPoiConfig({}));

    expect(registry.listStatuses()).toEqual([
      { credential: "missing", enabled: false, provider: "vietmap_maps" },
    ]);
  });

  it("does not initialize a disabled provider", () => {
    const registry = new PoiProviderRegistry(readVietmapPoiConfig({}));

    expect(() => registry.getAdapter("vietmap_maps")).toThrowError(
      "POI provider is disabled for vietmap_maps",
    );
  });
});
