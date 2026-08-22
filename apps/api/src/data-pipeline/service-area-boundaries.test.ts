import { describe, expect, it } from "vitest";

import {
  createNominatimBoundaryLookupUrl,
  serviceAreaBoundaries,
  serviceAreaBoundarySimplifyToleranceDegrees,
} from "./service-area-boundaries";

describe("service area boundary catalog", () => {
  it("defines unique service areas, OSM relations and immutable storage keys", () => {
    expect(serviceAreaBoundaries).toHaveLength(8);

    for (const key of [
      "code",
      "sourceRelationId",
      "sourceStorageKey",
    ] as const) {
      const values = serviceAreaBoundaries.map((boundary) => boundary[key]);

      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("distinguishes former districts from active wards", () => {
    const historicDistricts = serviceAreaBoundaries.filter(
      ({ areaType }) => areaType === "historic_district",
    );
    const wards = serviceAreaBoundaries.filter(
      ({ areaType }) => areaType === "ward",
    );

    expect(historicDistricts).toHaveLength(3);
    expect(
      serviceAreaBoundaries.every((definition) =>
        definition.areaType === "historic_district"
          ? definition.osmEndDate === "2025-06-30" &&
            definition.osmFeatureType === "historic" &&
            definition.status === "active"
          : true,
      ),
    ).toBe(true);
    expect(wards.map(({ displayName }) => displayName)).toEqual([
      "Phường Quy Nhơn",
      "Phường Quy Nhơn Đông",
      "Phường Quy Nhơn Tây",
      "Phường Quy Nhơn Nam",
      "Phường Quy Nhơn Bắc",
    ]);
    expect(
      serviceAreaBoundaries.every((definition) =>
        definition.areaType === "ward"
          ? definition.osmAdminLevel === "6" &&
            definition.osmFeatureType === "administrative" &&
            definition.status === "active"
          : true,
      ),
    ).toBe(true);
  });

  it("builds one topology-preserving simplified Nominatim lookup", () => {
    const url = createNominatimBoundaryLookupUrl();

    expect(url.origin).toBe("https://nominatim.openstreetmap.org");
    expect(url.searchParams.get("osm_ids")).toBe(
      "R2587287,R3819816,R3797166,R19372380,R19372378,R19372376,R19372377,R19372379",
    );
    expect(url.searchParams.get("polygon_threshold")).toBe(
      String(serviceAreaBoundarySimplifyToleranceDegrees),
    );
  });
});
