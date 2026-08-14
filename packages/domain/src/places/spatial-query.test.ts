import { describe, expect, it } from "vitest";

import {
  parseSpatialPlaceQuery,
  SpatialQueryValidationError,
} from "./spatial-query";

function parse(query: string) {
  return parseSpatialPlaceQuery(new URLSearchParams(query));
}

function expectError(query: string, code: SpatialQueryValidationError["code"]) {
  try {
    parse(query);
    throw new Error("Expected spatial query validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(SpatialQueryValidationError);
    expect((error as SpatialQueryValidationError).code).toBe(code);
  }
}

describe("parseSpatialPlaceQuery", () => {
  it("parses a bounded bbox query with the default limit", () => {
    expect(parse("bbox=106.68,10.75,106.76,10.85")).toEqual({
      east: 106.76,
      kind: "bbox",
      limit: 50,
      north: 10.85,
      south: 10.75,
      west: 106.68,
    });
  });

  it("parses a radius query and an explicit limit", () => {
    expect(parse("lat=10.775&lng=106.7&radius=1500&limit=25")).toEqual({
      kind: "radius",
      latitude: 10.775,
      limit: 25,
      longitude: 106.7,
      radiusMeters: 1500,
    });
  });

  it.each([
    ["", "spatial_query_required"],
    ["bbox=106.68,10.75,106.76,10.85&lat=10.77", "spatial_query_conflict"],
    ["lat=10.77&lng=106.7", "incomplete_radius_query"],
    ["bbox=106.7,10.8,106.6,10.7", "invalid_bbox"],
    ["bbox=105,10,107,11", "invalid_bbox"],
    ["lat=91&lng=106.7&radius=500", "invalid_coordinate"],
    ["lat=10.77&lng=106.7&radius=49", "invalid_radius"],
    ["lat=10.77&lng=106.7&radius=500&limit=101", "invalid_limit"],
    ["bbox=106.68,10.75,106.76,10.85&limit=1&limit=2", "duplicate_parameter"],
    ["bbox=106.68,10.75,106.76,10.85&purpose=work", "unknown_parameter"],
  ])("rejects %s with %s", (query, code) => {
    expectError(query, code as SpatialQueryValidationError["code"]);
  });
});
