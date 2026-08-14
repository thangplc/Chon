import type { QueryResultRow } from "pg";

import type { SpatialPlaceQuery } from "../domain/spatial-query";

export type SpatialPlace = Readonly<{
  address: string;
  currency: string;
  distanceMeters: number | null;
  district: string;
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  serviceArea: Readonly<{
    code: string;
    name: string;
  }>;
  slug: string;
  typicalSpendMax: number | null;
  typicalSpendMin: number | null;
}>;

export type SpatialPlacePage = Readonly<{
  hasMore: boolean;
  places: readonly SpatialPlace[];
}>;

export type SpatialQueryExecutor = Readonly<{
  query<Row extends QueryResultRow>(
    text: string,
    values: readonly unknown[],
  ): Promise<Readonly<{ rows: Row[] }>>;
}>;

type SpatialPlaceRow = QueryResultRow &
  Readonly<{
    address: string;
    currency: string;
    distance_meters: number | null;
    district: string;
    id: string;
    latitude: number;
    longitude: number;
    name: string;
    service_area_code: string;
    service_area_name: string;
    slug: string;
    typical_spend_max: number | null;
    typical_spend_min: number | null;
  }>;

export type BuiltSpatialPlaceQuery = Readonly<{
  text: string;
  values: readonly number[];
}>;

const activeServiceAreaJoin = `
  JOIN LATERAL (
    SELECT service_area.code, service_area.display_name
      FROM place_service_areas AS membership
      JOIN service_areas AS service_area
        ON service_area.id = membership.service_area_id
       AND service_area.status = 'active'
      JOIN service_area_boundaries AS boundary
        ON boundary.service_area_id = membership.service_area_id
       AND boundary.version = membership.boundary_version
       AND boundary.is_current = true
     WHERE membership.place_id = place.id
     ORDER BY membership.is_primary DESC,
              service_area.priority DESC,
              service_area.code
     LIMIT 1
  ) AS active_area ON true`;

const placeColumns = `
  place.id,
  place.slug,
  place.name,
  place.address,
  place.district,
  place.typical_spend_min,
  place.typical_spend_max,
  place.currency,
  ST_Y(place.location) AS latitude,
  ST_X(place.location) AS longitude,
  active_area.code AS service_area_code,
  active_area.display_name AS service_area_name`;

export function buildSpatialPlaceQuery(
  query: SpatialPlaceQuery,
): BuiltSpatialPlaceQuery {
  if (query.kind === "bbox") {
    return {
      text: `
        WITH spatial_input AS (
          SELECT ST_MakeEnvelope($1, $2, $3, $4, 4326) AS bounds
        )
        SELECT ${placeColumns},
               NULL::integer AS distance_meters
          FROM places AS place
          CROSS JOIN spatial_input
          ${activeServiceAreaJoin}
         WHERE place.status = 'published'
           AND place.location && spatial_input.bounds
           AND ST_Covers(spatial_input.bounds, place.location)
         ORDER BY place.name, place.id
         LIMIT $5`,
      values: [
        query.west,
        query.south,
        query.east,
        query.north,
        query.limit + 1,
      ],
    };
  }

  return {
    text: `
      WITH spatial_input AS (
        SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS center
      )
      SELECT ${placeColumns},
             round(
               ST_Distance(place.location::geography, spatial_input.center)
             )::integer AS distance_meters
        FROM places AS place
        CROSS JOIN spatial_input
        ${activeServiceAreaJoin}
       WHERE place.status = 'published'
         AND ST_DWithin(
           place.location::geography,
           spatial_input.center,
           $3
         )
       ORDER BY distance_meters, place.name, place.id
       LIMIT $4`,
    values: [
      query.longitude,
      query.latitude,
      query.radiusMeters,
      query.limit + 1,
    ],
  };
}

export async function executeSpatialPlaceQuery(
  query: SpatialPlaceQuery,
  executor: SpatialQueryExecutor,
): Promise<SpatialPlacePage> {
  const builtQuery = buildSpatialPlaceQuery(query);
  const result = await executor.query<SpatialPlaceRow>(
    builtQuery.text,
    builtQuery.values,
  );
  const hasMore = result.rows.length > query.limit;
  const rows = hasMore ? result.rows.slice(0, query.limit) : result.rows;

  return {
    hasMore,
    places: rows.map((row) => ({
      address: row.address,
      currency: row.currency,
      distanceMeters: row.distance_meters,
      district: row.district,
      id: row.id,
      latitude: row.latitude,
      longitude: row.longitude,
      name: row.name,
      serviceArea: {
        code: row.service_area_code,
        name: row.service_area_name,
      },
      slug: row.slug,
      typicalSpendMax: row.typical_spend_max,
      typicalSpendMin: row.typical_spend_min,
    })),
  };
}
