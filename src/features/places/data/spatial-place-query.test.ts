import { describe, expect, it, vi } from "vitest";

import type { SpatialPlaceQuery } from "../domain/spatial-query";
import {
  buildSpatialPlaceQuery,
  executeSpatialPlaceQuery,
  type SpatialQueryExecutor,
} from "./spatial-place-query";

const bboxQuery: SpatialPlaceQuery = {
  east: 106.76,
  kind: "bbox",
  limit: 2,
  north: 10.85,
  south: 10.75,
  west: 106.68,
};

describe("buildSpatialPlaceQuery", () => {
  it("uses an indexed geometry prefilter and an inclusive bbox predicate", () => {
    const query = buildSpatialPlaceQuery(bboxQuery);

    expect(query.text).toContain("place.location && spatial_input.bounds");
    expect(query.text).toContain(
      "ST_Covers(spatial_input.bounds, place.location)",
    );
    expect(query.text).toContain("boundary.is_current = true");
    expect(query.values).toEqual([106.68, 10.75, 106.76, 10.85, 3]);
  });

  it("uses geography for meter-accurate radius and distance queries", () => {
    const query = buildSpatialPlaceQuery({
      kind: "radius",
      latitude: 10.775,
      limit: 25,
      longitude: 106.7,
      radiusMeters: 1500,
    });

    expect(query.text).toContain("ST_DWithin");
    expect(query.text).toContain("place.location::geography");
    expect(query.text).toContain("ORDER BY distance_meters");
    expect(query.values).toEqual([106.7, 10.775, 1500, 26]);
  });
});

describe("executeSpatialPlaceQuery", () => {
  it("maps rows and exposes hasMore without returning the lookahead row", async () => {
    const rows = ["one", "two", "lookahead"].map((id, index) => ({
      address: `${index} Test Street`,
      currency: "VND",
      distance_meters: null,
      district: "Quận 1",
      id,
      latitude: 10.77 + index / 100,
      longitude: 106.7,
      name: id,
      service_area_code: "hcm-q1",
      service_area_name: "Quận 1",
      slug: id,
      typical_spend_max: null,
      typical_spend_min: null,
    }));
    const query = vi.fn().mockResolvedValue({ rows });
    const executor = { query } as unknown as SpatialQueryExecutor;

    const result = await executeSpatialPlaceQuery(bboxQuery, executor);

    expect(query).toHaveBeenCalledOnce();
    expect(result.hasMore).toBe(true);
    expect(result.places).toHaveLength(2);
    expect(result.places[0]).toMatchObject({
      id: "one",
      serviceArea: { code: "hcm-q1", name: "Quận 1" },
    });
  });
});
