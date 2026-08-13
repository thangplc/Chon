import assert from "node:assert/strict";

import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const requiredTables = [
  "place_areas",
  "place_service_areas",
  "place_sources",
  "places",
  "provider_vibe_signals",
  "service_area_boundaries",
  "service_areas",
  "vibe_reports",
];

function requireEnvironmentValue(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function expectDatabaseError(
  client,
  savepoint,
  query,
  expectedCode,
  expectedConstraint,
) {
  await client.query(`SAVEPOINT ${savepoint}`);

  let databaseError;

  try {
    await client.query(query);
  } catch (error) {
    databaseError = error;
  }

  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  await client.query(`RELEASE SAVEPOINT ${savepoint}`);

  assert.ok(
    databaseError,
    `Expected ${expectedConstraint} to reject the query`,
  );
  assert.equal(databaseError.code, expectedCode);
  assert.equal(databaseError.constraint, expectedConstraint);
}

async function verifyMetadata(client) {
  const tables = await client.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = ANY($1::text[])
      ORDER BY table_name`,
    [requiredTables],
  );

  assert.deepEqual(
    tables.rows.map(({ table_name: tableName }) => tableName),
    requiredTables,
  );

  const geometryColumns = await client.query(
    `SELECT f_table_name, type, srid
       FROM geometry_columns
      WHERE f_table_schema = current_schema()
        AND f_table_name = ANY($1::text[])
      ORDER BY f_table_name`,
    [["places", "service_area_boundaries"]],
  );

  assert.deepEqual(geometryColumns.rows, [
    { f_table_name: "places", srid: 4326, type: "POINT" },
    {
      f_table_name: "service_area_boundaries",
      srid: 4326,
      type: "MULTIPOLYGON",
    },
  ]);

  const indexes = await client.query(
    `SELECT indexname, indexdef
       FROM pg_indexes
      WHERE schemaname = current_schema()
        AND indexname = ANY($1::text[])`,
    [
      [
        "places_location_gist_idx",
        "provider_vibe_signals_expires_at_idx",
        "provider_vibe_signals_place_time_idx",
        "provider_vibe_signals_place_type_idx",
        "service_area_boundaries_boundary_gist_idx",
        "service_area_boundaries_one_current_unique",
        "place_service_areas_one_primary_unique",
      ],
    ],
  );

  assert.equal(indexes.rowCount, 7);
  assert.match(
    indexes.rows.find(
      ({ indexname }) => indexname === "places_location_gist_idx",
    ).indexdef,
    /USING gist/,
  );
  assert.match(
    indexes.rows.find(
      ({ indexname }) =>
        indexname === "service_area_boundaries_boundary_gist_idx",
    ).indexdef,
    /USING gist/,
  );
}

async function verifyDomainRules(client) {
  const serviceArea = await client.query(
    `INSERT INTO service_areas
       (code, display_name, area_type, timezone, priority, status)
     VALUES
       ('verify-q1', 'Verify Quận 1', 'district', 'Asia/Ho_Chi_Minh', 1, 'active')
     RETURNING id`,
  );
  const serviceAreaId = serviceArea.rows[0].id;

  await client.query(
    `INSERT INTO service_area_boundaries
       (service_area_id, version, boundary, source_storage_key, source_name,
        source_relation_id, source_url, source_license, retrieved_at,
        checksum, is_current)
     VALUES
       ($1, 1, ST_GeomFromText($2, 4326), 'verify/q1-v1.geojson', 'OpenStreetMap',
        'verify-relation-1', 'https://www.openstreetmap.org', 'ODbL-1.0', now(),
        'verify-checksum-v1', true)`,
    [
      serviceAreaId,
      "MULTIPOLYGON(((106.68 10.76,106.72 10.76,106.72 10.80,106.68 10.80,106.68 10.76)))",
    ],
  );

  const place = await client.query(
    `INSERT INTO places
       (internal_id, name, slug, location, address, district, status)
     VALUES
       ('verify_place', 'Verify Cafe', 'verify-cafe', ST_SetSRID(ST_MakePoint(106.70, 10.78), 4326),
        '1 Verify Street', 'Quận 1', 'published')
     RETURNING id`,
  );
  const placeId = place.rows[0].id;

  const otherPlace = await client.query(
    `INSERT INTO places
       (internal_id, name, slug, location, address, district, status)
     VALUES
       ('verify_other_place', 'Verify Other Cafe', 'verify-other-cafe',
        ST_SetSRID(ST_MakePoint(106.701, 10.781), 4326),
        '2 Verify Street', 'Quận 1', 'published')
     RETURNING id`,
  );
  const otherPlaceId = otherPlace.rows[0].id;

  const fsqSource = await client.query(
    `INSERT INTO place_sources
       (place_id, provider, provider_place_id, last_synced_at, source_url)
     VALUES
       ($1, 'fsq_os_places', 'verify-fsq-place', now(),
        'https://foursquare.com/verify-fsq-place')
     RETURNING id`,
    [placeId],
  );
  const fsqSourceId = fsqSource.rows[0].id;

  const googleSource = await client.query(
    `INSERT INTO place_sources
       (place_id, provider, provider_place_id, last_synced_at, source_url)
     VALUES
       ($1, 'google_places', 'verify-google-place', now(),
        'https://maps.google.com/?cid=verify-google-place')
     RETURNING id`,
    [placeId],
  );
  const googleSourceId = googleSource.rows[0].id;

  const placeArea = await client.query(
    `INSERT INTO place_areas (internal_id, place_id, name)
     VALUES ('verify_area', $1, 'Tầng 1')
     RETURNING id`,
    [placeId],
  );

  await client.query(
    `INSERT INTO place_service_areas
       (place_id, service_area_id, is_primary, boundary_version)
     VALUES ($1, $2, true, 1)`,
    [placeId, serviceAreaId],
  );

  await client.query(
    `INSERT INTO vibe_reports
       (internal_id, place_id, place_area_id, visited_at, noise, crowd, workability,
        visit_mode, location_verification, data_type, is_simulated,
        day_type, time_bucket)
     VALUES
       ('verify_report', $1, $2, now() - interval '1 hour', 2, 3, 5, 'work', 'none',
        'synthetic', true, 'weekday', 'morning')`,
    [placeId, placeArea.rows[0].id],
  );

  await client.query(
    `INSERT INTO provider_vibe_signals
       (place_id, place_source_id, provider_product, provider_signal_id,
        signal_type, signal_value, noise, workability, mapping_version,
        confidence_score, retrieved_at, storage_policy)
     VALUES
       ($1, $2, 'places_premium', 'verify-taste-quiet', 'taste',
        $3::jsonb, 2, 4.5, 'provider-map-v1', 0.7, now(), 'persist_allowed')`,
    [placeId, fsqSourceId, JSON.stringify({ label: "quiet" })],
  );

  await client.query(
    `INSERT INTO provider_vibe_signals
       (place_id, place_source_id, provider_product, provider_signal_id,
        signal_type, confidence_score, retrieved_at, source_url,
        attribution_text, storage_policy)
     VALUES
       ($1, $2, 'places_api_new', 'verify-google-reference', 'rating',
        0.5, now(), 'https://maps.google.com/?cid=verify-google-place',
        'Google Maps', 'reference_only')`,
    [placeId, googleSourceId],
  );

  const coverage = await client.query(
    `SELECT ST_Covers(boundary.boundary, place.location) AS is_covered
       FROM service_area_boundaries AS boundary
       JOIN places AS place ON place.id = $2
      WHERE boundary.service_area_id = $1
        AND boundary.is_current = true`,
    [serviceAreaId, placeId],
  );

  assert.equal(coverage.rows[0].is_covered, true);

  await expectDatabaseError(
    client,
    "duplicate_current_boundary",
    {
      text: `INSERT INTO service_area_boundaries
        (service_area_id, version, boundary, source_storage_key, source_name,
         source_relation_id, source_url, source_license, retrieved_at,
         checksum, is_current)
       VALUES
        ($1, 2, ST_GeomFromText($2, 4326), 'verify/q1-v2.geojson', 'OpenStreetMap',
         'verify-relation-2', 'https://www.openstreetmap.org', 'ODbL-1.0', now(),
         'verify-checksum-v2', true)`,
      values: [
        serviceAreaId,
        "MULTIPOLYGON(((106.68 10.76,106.72 10.76,106.72 10.80,106.68 10.80,106.68 10.76)))",
      ],
    },
    "23505",
    "service_area_boundaries_one_current_unique",
  );

  await expectDatabaseError(
    client,
    "too_few_vibe_scores",
    {
      text: `INSERT INTO vibe_reports
        (internal_id, place_id, visited_at, noise, crowd, visit_mode, location_verification,
         data_type, is_simulated, day_type, time_bucket)
       VALUES
        ('verify_bad_report', $1, now() - interval '1 hour', 2, 3, 'work', 'none', 'synthetic',
         true, 'weekday', 'morning')`,
      values: [placeId],
    },
    "23514",
    "vibe_reports_at_least_three_scores_check",
  );

  await expectDatabaseError(
    client,
    "provider_reference_only_content",
    {
      text: `INSERT INTO provider_vibe_signals
        (place_id, place_source_id, provider_product, provider_signal_id,
         signal_type, signal_value, confidence_score, retrieved_at,
         storage_policy)
       VALUES
        ($1, $2, 'places_api_new', 'verify-bad-reference', 'rating',
         $3::jsonb, 0.5, now(), 'reference_only')`,
      values: [placeId, googleSourceId, JSON.stringify({ rating: 4.5 })],
    },
    "23514",
    "provider_vibe_signals_storage_policy_contract_check",
  );

  await expectDatabaseError(
    client,
    "provider_mapping_without_version",
    {
      text: `INSERT INTO provider_vibe_signals
        (place_id, place_source_id, provider_product, provider_signal_id,
         signal_type, signal_value, crowd, confidence_score, retrieved_at,
         storage_policy)
       VALUES
        ($1, $2, 'places_premium', 'verify-bad-mapping', 'popular_hours',
         $3::jsonb, 4, 0.8, now(), 'persist_allowed')`,
      values: [placeId, fsqSourceId, JSON.stringify({ weekday: ["09:00"] })],
    },
    "23514",
    "provider_vibe_signals_mapping_contract_check",
  );

  await expectDatabaseError(
    client,
    "provider_source_place_mismatch",
    {
      text: `INSERT INTO provider_vibe_signals
        (place_id, place_source_id, provider_product, provider_signal_id,
         signal_type, signal_value, confidence_score, retrieved_at,
         storage_policy)
       VALUES
        ($1, $2, 'places_premium', 'verify-bad-place', 'rating',
         $3::jsonb, 0.5, now(), 'persist_allowed')`,
      values: [otherPlaceId, fsqSourceId, JSON.stringify({ rating: 8.5 })],
    },
    "23503",
    "provider_vibe_signals_place_source_same_place_fkey",
  );
}

async function main() {
  const client = new Client({
    database: requireEnvironmentValue("DATABASE_NAME"),
    host: requireEnvironmentValue("DATABASE_HOST"),
    options: `-c search_path=${requireEnvironmentValue("DATABASE_SCHEMA")}`,
    password: requireEnvironmentValue("DATABASE_PASSWORD"),
    port: Number(requireEnvironmentValue("DATABASE_PORT")),
    ssl:
      requireEnvironmentValue("DATABASE_SSL") === "true"
        ? { rejectUnauthorized: true }
        : undefined,
    user: requireEnvironmentValue("DATABASE_USER"),
  });
  let transactionOpen = false;

  try {
    await client.connect();
    await verifyMetadata(client);
    await client.query("BEGIN");
    transactionOpen = true;
    await verifyDomainRules(client);
    await client.query("ROLLBACK");
    transactionOpen = false;
    console.log("Core schema verification passed.");
  } finally {
    if (transactionOpen) {
      await client.query("ROLLBACK");
    }

    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
