import { describe, expect, it } from "vitest";

import { VIETMAP_POI_FIXTURE_PAYLOADS } from "./fixtures";
import {
  normalizeVietmapSearchResponse,
  type VietmapNormalizationContext,
} from "./normalizer";

const context: VietmapNormalizationContext = {
  retrievedAt: new Date("2026-08-15T00:00:00.000Z"),
  sourceKind: "synthetic_fixture",
  sourceUrl: "https://maps.vietmap.vn/api/search/v4",
};

describe("VIETMAP POI normalizer", () => {
  it("normalizes identity, coordinates and both address variants", () => {
    const [place] = normalizeVietmapSearchResponse(
      VIETMAP_POI_FIXTURE_PAYLOADS.searchCafes,
      context,
    );

    expect(place).toMatchObject({
      addressCurrent:
        "12 Đường Nguyễn Đình Chiểu, Phường Võ Thị Sáu, Thành Phố Hồ Chí Minh",
      addressLegacy:
        "12 Đường Nguyễn Đình Chiểu, Phường 6, Quận 3, Thành Phố Hồ Chí Minh",
      isSimulated: true,
      name: "Fixture Cafe 01",
      provider: "vietmap_maps",
      providerPlaceId: "fixture:POI:cafe-01",
      providerProduct: "maps_search_v4",
    });
    expect(place?.latitude).toBe(10.7842);
    expect(place?.boundaries[0]).toMatchObject({
      fullName: "Phường Võ Thị Sáu",
      id: "1001",
    });
  });
});
