const allowedParameters = new Set(["bbox", "lat", "limit", "lng", "radius"]);
const coordinatePattern = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;

export const spatialQueryLimits = {
  defaultLimit: 50,
  maximumBboxSpanDegrees: 1,
  maximumLimit: 100,
  maximumRadiusMeters: 20_000,
  minimumRadiusMeters: 50,
} as const;

type QueryLimit = Readonly<{ limit: number }>;

export type BoundingBoxSpatialQuery = QueryLimit &
  Readonly<{
    east: number;
    kind: "bbox";
    north: number;
    south: number;
    west: number;
  }>;

export type RadiusSpatialQuery = QueryLimit &
  Readonly<{
    kind: "radius";
    latitude: number;
    longitude: number;
    radiusMeters: number;
  }>;

export type SpatialPlaceQuery = BoundingBoxSpatialQuery | RadiusSpatialQuery;

export class SpatialQueryValidationError extends Error {
  constructor(
    readonly code:
      | "duplicate_parameter"
      | "incomplete_radius_query"
      | "invalid_bbox"
      | "invalid_coordinate"
      | "invalid_limit"
      | "invalid_radius"
      | "spatial_query_conflict"
      | "spatial_query_required"
      | "unknown_parameter",
    message: string,
  ) {
    super(message);
    this.name = "SpatialQueryValidationError";
  }
}

function parseFiniteNumber(
  value: string,
  parameter: string,
  code: SpatialQueryValidationError["code"],
): number {
  const normalized = value.trim();
  if (!coordinatePattern.test(normalized)) {
    throw new SpatialQueryValidationError(
      code,
      `${parameter} must be a finite decimal number`,
    );
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new SpatialQueryValidationError(
      code,
      `${parameter} must be a finite decimal number`,
    );
  }

  return parsed;
}

function assertCoordinate(value: number, axis: "latitude" | "longitude"): void {
  const [minimum, maximum] = axis === "latitude" ? [-90, 90] : [-180, 180];
  if (value < minimum || value > maximum) {
    throw new SpatialQueryValidationError(
      "invalid_coordinate",
      `${axis} must be between ${minimum} and ${maximum}`,
    );
  }
}

function parseLimit(searchParams: URLSearchParams): number {
  const rawLimit = searchParams.get("limit");
  if (rawLimit === null) return spatialQueryLimits.defaultLimit;

  const limit = parseFiniteNumber(rawLimit, "limit", "invalid_limit");
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > spatialQueryLimits.maximumLimit
  ) {
    throw new SpatialQueryValidationError(
      "invalid_limit",
      `limit must be an integer between 1 and ${spatialQueryLimits.maximumLimit}`,
    );
  }

  return limit;
}

function parseBoundingBox(
  rawBoundingBox: string,
  limit: number,
): BoundingBoxSpatialQuery {
  const values = rawBoundingBox.split(",");
  if (values.length !== 4) {
    throw new SpatialQueryValidationError(
      "invalid_bbox",
      "bbox must contain west,south,east,north",
    );
  }

  const [west, south, east, north] = values.map((value, index) =>
    parseFiniteNumber(value, `bbox[${index}]`, "invalid_bbox"),
  );
  assertCoordinate(west, "longitude");
  assertCoordinate(east, "longitude");
  assertCoordinate(south, "latitude");
  assertCoordinate(north, "latitude");

  if (west >= east || south >= north) {
    throw new SpatialQueryValidationError(
      "invalid_bbox",
      "bbox requires west < east and south < north",
    );
  }
  if (
    east - west > spatialQueryLimits.maximumBboxSpanDegrees ||
    north - south > spatialQueryLimits.maximumBboxSpanDegrees
  ) {
    throw new SpatialQueryValidationError(
      "invalid_bbox",
      `bbox spans must not exceed ${spatialQueryLimits.maximumBboxSpanDegrees} degree`,
    );
  }

  return { east, kind: "bbox", limit, north, south, west };
}

function parseRadiusQuery(
  searchParams: URLSearchParams,
  limit: number,
): RadiusSpatialQuery {
  const latitudeValue = searchParams.get("lat");
  const longitudeValue = searchParams.get("lng");
  const radiusValue = searchParams.get("radius");
  if (
    latitudeValue === null ||
    longitudeValue === null ||
    radiusValue === null
  ) {
    throw new SpatialQueryValidationError(
      "incomplete_radius_query",
      "lat, lng and radius are all required for a radius query",
    );
  }

  const latitude = parseFiniteNumber(
    latitudeValue,
    "lat",
    "invalid_coordinate",
  );
  const longitude = parseFiniteNumber(
    longitudeValue,
    "lng",
    "invalid_coordinate",
  );
  const radiusMeters = parseFiniteNumber(
    radiusValue,
    "radius",
    "invalid_radius",
  );
  assertCoordinate(latitude, "latitude");
  assertCoordinate(longitude, "longitude");

  if (
    radiusMeters < spatialQueryLimits.minimumRadiusMeters ||
    radiusMeters > spatialQueryLimits.maximumRadiusMeters
  ) {
    throw new SpatialQueryValidationError(
      "invalid_radius",
      `radius must be between ${spatialQueryLimits.minimumRadiusMeters} and ${spatialQueryLimits.maximumRadiusMeters} meters`,
    );
  }

  return { kind: "radius", latitude, limit, longitude, radiusMeters };
}

export function parseSpatialPlaceQuery(
  searchParams: URLSearchParams,
): SpatialPlaceQuery {
  for (const key of searchParams.keys()) {
    if (!allowedParameters.has(key)) {
      throw new SpatialQueryValidationError(
        "unknown_parameter",
        `Unknown query parameter: ${key}`,
      );
    }
    if (searchParams.getAll(key).length > 1) {
      throw new SpatialQueryValidationError(
        "duplicate_parameter",
        `Query parameter must appear once: ${key}`,
      );
    }
  }

  const bbox = searchParams.get("bbox");
  const hasRadiusParameter = ["lat", "lng", "radius"].some((parameter) =>
    searchParams.has(parameter),
  );
  if (bbox !== null && hasRadiusParameter) {
    throw new SpatialQueryValidationError(
      "spatial_query_conflict",
      "Use either bbox or lat/lng/radius, not both",
    );
  }
  if (bbox === null && !hasRadiusParameter) {
    throw new SpatialQueryValidationError(
      "spatial_query_required",
      "A bbox or lat/lng/radius query is required",
    );
  }

  const limit = parseLimit(searchParams);

  return bbox === null
    ? parseRadiusQuery(searchParams, limit)
    : parseBoundingBox(bbox, limit);
}
