import { describe, expect, it } from "vitest";

import {
  createNominatimBoundaryLookupUrl,
  serviceAreaBoundaries,
  serviceAreaBoundarySimplifyToleranceDegrees,
} from "./service-area-boundaries";

describe("service area boundary catalog", () => {
  it("defines unique service areas, OSM relations and immutable storage keys", () => {
    expect(serviceAreaBoundaries).toHaveLength(3);

    for (const key of [
      "code",
      "sourceRelationId",
      "sourceStorageKey",
    ] as const) {
      const values = serviceAreaBoundaries.map((boundary) => boundary[key]);

      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("records the former districts honestly as active product service areas", () => {
    expect(
      serviceAreaBoundaries.every(
        ({ areaType, osmEndDate, status }) =>
          areaType === "historic_district" &&
          osmEndDate === "2025-06-30" &&
          status === "active",
      ),
    ).toBe(true);
  });

  it("builds one topology-preserving simplified Nominatim lookup", () => {
    const url = createNominatimBoundaryLookupUrl();

    expect(url.origin).toBe("https://nominatim.openstreetmap.org");
    expect(url.searchParams.get("osm_ids")).toBe("R2587287,R3819816,R3797166");
    expect(url.searchParams.get("polygon_threshold")).toBe(
      String(serviceAreaBoundarySimplifyToleranceDegrees),
    );
  });
});
