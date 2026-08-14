import "./load-api-env.mjs";

import assert from "node:assert/strict";

import {
  closeDatabaseConnection,
  getDatabaseConnection,
} from "../src/database/client";
import { executeSpatialPlaceQuery } from "../src/database/queries/spatial-place-query";
import { parseSpatialPlaceQuery } from "@chon/domain/spatial-query";

async function main(): Promise<void> {
  const { pool } = getDatabaseConnection();

  try {
    const indexResult = await pool.query<{ indexdef: string }>(
      `SELECT indexdef
         FROM pg_indexes
        WHERE schemaname = current_schema()
          AND tablename = 'places'
          AND indexname = 'places_location_geography_gist_idx'`,
    );
    assert.equal(indexResult.rowCount, 1, "Radius geography index is missing");
    assert.match(indexResult.rows[0].indexdef, /USING gist/);
    assert.match(indexResult.rows[0].indexdef, /location.*geography/i);

    const allPlacesQuery = parseSpatialPlaceQuery(
      new URLSearchParams("bbox=106.66,10.74,106.76,10.85&limit=100"),
    );
    const allPlaces = await executeSpatialPlaceQuery(allPlacesQuery, pool);
    assert.equal(allPlaces.hasMore, false);
    assert.equal(allPlaces.places.length, 10);
    assert.deepEqual(
      [
        ...new Set(allPlaces.places.map(({ serviceArea }) => serviceArea.code)),
      ].sort(),
      ["hcm-binh-thanh", "hcm-q1", "hcm-q3"],
    );
    assert.ok(
      allPlaces.places.every(({ distanceMeters }) => distanceMeters === null),
    );

    const limitedQuery = parseSpatialPlaceQuery(
      new URLSearchParams("bbox=106.66,10.74,106.76,10.85&limit=3"),
    );
    const limited = await executeSpatialPlaceQuery(limitedQuery, pool);
    assert.equal(limited.places.length, 3);
    assert.equal(limited.hasMore, true);

    const radiusQuery = parseSpatialPlaceQuery(
      new URLSearchParams("lat=10.7754&lng=106.6994&radius=100&limit=10"),
    );
    assert.equal(radiusQuery.kind, "radius");
    if (radiusQuery.kind !== "radius") {
      throw new Error("Expected the verifier query to use radius mode");
    }
    const nearby = await executeSpatialPlaceQuery(radiusQuery, pool);
    assert.ok(nearby.places.length > 0, "Radius query returned no places");
    assert.ok(
      nearby.places.every(
        ({ distanceMeters }) =>
          distanceMeters !== null && distanceMeters <= radiusQuery.radiusMeters,
      ),
    );
    assert.deepEqual(
      nearby.places.map(({ distanceMeters }) => distanceMeters),
      nearby.places
        .map(({ distanceMeters }) => distanceMeters)
        .toSorted((left, right) => (left ?? 0) - (right ?? 0)),
    );

    console.table([
      {
        hasMore: allPlaces.hasMore,
        mode: "bbox",
        results: allPlaces.places.length,
      },
      {
        hasMore: limited.hasMore,
        mode: "bbox-limit-3",
        results: limited.places.length,
      },
      {
        hasMore: nearby.hasMore,
        mode: "radius-100m",
        results: nearby.places.length,
      },
    ]);
    console.log("Spatial place query verification passed.");
  } finally {
    await closeDatabaseConnection();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
