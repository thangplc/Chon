import "./load-api-env.mjs";

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  beginImportTransaction,
  createImportDatabaseClient,
} from "../src/data-pipeline/import/database";
import { runDataImport } from "../src/data-pipeline/import/runner";

async function main() {
  const directory = await mkdtemp(join(tmpdir(), "chon-import-"));
  const boundaryPath = join(directory, "verify-boundary.geojson");
  const placesPath = join(directory, "places.csv");
  const placeSourcesPath = join(directory, "place-sources.csv");
  const conflictingPlacesPath = join(directory, "conflicting-places.csv");
  const conflictingSourcesPath = join(directory, "conflicting-sources.csv");
  const areasPath = join(directory, "place-areas.csv");
  const reportsPath = join(directory, "synthetic-vibe-reports.csv");
  const now = new Date();
  const visitedAt = new Date(now.getTime() - 3_600_000).toISOString();
  const client = createImportDatabaseClient();
  let transactionOpen = false;

  try {
    await writeFile(
      boundaryPath,
      JSON.stringify({
        geometry: {
          coordinates: [
            [
              [106.68, 10.76],
              [106.72, 10.76],
              [106.72, 10.8],
              [106.68, 10.8],
              [106.68, 10.76],
            ],
          ],
          type: "Polygon",
        },
        properties: {},
        type: "Feature",
      }),
    );
    await writeFile(
      placesPath,
      [
        "internal_id,name,address,latitude,longitude,district,status,is_simulated,size_category,estimated_capacity,price_level,typical_spend_min,typical_spend_max,currency",
        "verify_import_place,Verify Import Cafe,1 Verify Street,10.78,106.70,Quận 1,published,true,small,20,2,30000,60000,VND",
      ].join("\n"),
    );
    await writeFile(
      placeSourcesPath,
      [
        "place_id,provider,provider_place_id,last_synced_at,source_url",
        `verify_import_place,fsq_os_places,fsq-verify-place,${now.toISOString()},https://example.com/places/fsq-verify-place`,
      ].join("\n"),
    );
    await writeFile(
      areasPath,
      [
        "area_id,place_id,name,description,is_simulated",
        "verify_import_area,verify_import_place,Tầng 1,Khu kiểm thử,true",
      ].join("\n"),
    );
    await writeFile(
      reportsPath,
      [
        "report_id,place_id,place_area_id,visited_at,day_type,time_bucket,visit_mode,noise,crowd,lighting,privacy,workability,social_energy,seat_availability,location_verification,data_type,is_simulated,moderation_status,short_note",
        `verify_import_report,verify_import_place,verify_import_area,${visitedAt},weekday,morning,work,2,2,3,4,5,2,easy,none,synthetic,true,approved,Integration verification`,
      ].join("\n"),
    );

    await client.connect();
    await beginImportTransaction(client);
    transactionOpen = true;

    const productionGuard = await runDataImport(
      {
        command: "seed",
        dryRun: true,
        environment: "production",
        input: { directory },
        operatorId: "integration-test",
      },
      client,
      { manageTransaction: false },
    );
    assert.equal(productionGuard.status, "failed");
    assert.ok(
      productionGuard.issues.some(
        ({ code }) => code === "production_simulated_record_forbidden",
      ),
    );
    assert.ok(
      productionGuard.issues.some(
        ({ code }) => code === "production_data_type_forbidden",
      ),
    );

    const boundary = await runDataImport(
      {
        command: "boundary",
        dryRun: false,
        environment: "local",
        input: {
          areaType: "district",
          code: "verify-import-q1",
          current: true,
          displayName: "Verify Import Quận 1",
          filePath: boundaryPath,
          priority: 1,
          retrievedAt: now,
          sourceLicense: "ODbL-1.0",
          sourceName: "OpenStreetMap",
          sourceRelationId: "verify-import-relation",
          sourceStorageKey: "verify/import-q1-v1.geojson",
          sourceUrl: "https://www.openstreetmap.org",
          status: "active",
          timezone: "Asia/Ho_Chi_Minh",
          version: 1,
        },
        operatorId: "integration-test",
      },
      client,
      { manageTransaction: false },
    );
    assert.equal(boundary.status, "passed");
    assert.equal(boundary.entities.boundaries.created, 1);

    const boundaryV2 = await runDataImport(
      {
        command: "boundary",
        dryRun: false,
        environment: "local",
        input: {
          areaType: "district",
          code: "verify-import-q1",
          current: true,
          displayName: "Verify Import Quận 1",
          filePath: boundaryPath,
          priority: 1,
          retrievedAt: now,
          sourceLicense: "ODbL-1.0",
          sourceName: "OpenStreetMap",
          sourceRelationId: "verify-import-relation",
          sourceStorageKey: "verify/import-q1-v2.geojson",
          sourceUrl: "https://www.openstreetmap.org",
          status: "active",
          timezone: "Asia/Ho_Chi_Minh",
          version: 2,
        },
        operatorId: "integration-test",
      },
      client,
      { manageTransaction: false },
    );
    assert.equal(boundaryV2.status, "passed");
    assert.equal(boundaryV2.entities.boundaries.created, 1);

    const reactivateBoundaryV1 = await runDataImport(
      {
        command: "boundary",
        dryRun: false,
        environment: "local",
        input: {
          areaType: "district",
          code: "verify-import-q1",
          current: true,
          displayName: "Verify Import Quận 1",
          filePath: boundaryPath,
          priority: 1,
          retrievedAt: now,
          sourceLicense: "ODbL-1.0",
          sourceName: "OpenStreetMap",
          sourceRelationId: "verify-import-relation",
          sourceStorageKey: "verify/import-q1-v1.geojson",
          sourceUrl: "https://www.openstreetmap.org",
          status: "active",
          timezone: "Asia/Ho_Chi_Minh",
          version: 1,
        },
        operatorId: "integration-test",
      },
      client,
      { manageTransaction: false },
    );
    assert.equal(reactivateBoundaryV1.status, "passed");
    assert.equal(reactivateBoundaryV1.entities.boundaries.updated, 1);

    const expectedMemberships = await client.query<{ count: number }>(
      `SELECT count(*)::integer AS count
         FROM service_area_boundaries AS boundary
         JOIN service_areas AS area ON area.id = boundary.service_area_id
        WHERE boundary.is_current = true
          AND area.status = 'active'
          AND ST_Covers(
            boundary.boundary,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)
          )`,
      [106.7, 10.78],
    );
    const expectedMembershipCount = expectedMemberships.rows[0].count;
    assert.ok(expectedMembershipCount >= 1);

    const poi = await runDataImport(
      {
        command: "poi",
        dryRun: false,
        environment: "local",
        input: { filePath: placesPath, sourcesPath: placeSourcesPath },
        operatorId: "integration-test",
      },
      client,
      { manageTransaction: false },
    );
    assert.equal(poi.status, "passed");
    assert.equal(poi.entities.places.created, 1);
    assert.equal(
      poi.entities.placeServiceAreas.created,
      expectedMembershipCount,
    );
    assert.equal(poi.entities.placeSources.created, 1);

    const repeatPoi = await runDataImport(
      {
        command: "poi",
        dryRun: true,
        environment: "local",
        input: { filePath: placesPath, sourcesPath: placeSourcesPath },
        operatorId: "integration-test",
      },
      client,
      { manageTransaction: false },
    );
    assert.equal(repeatPoi.status, "passed");
    assert.equal(repeatPoi.entities.places.unchanged, 1);
    assert.equal(repeatPoi.entities.placeSources.unchanged, 1);

    const newerSyncTime = new Date(now.getTime() + 1_000);
    await writeFile(
      placeSourcesPath,
      [
        "place_id,provider,provider_place_id,last_synced_at,source_url",
        `verify_import_place,fsq_os_places,fsq-verify-place,${newerSyncTime.toISOString()},https://example.com/places/fsq-verify-place-v2`,
      ].join("\n"),
    );
    const updateProvenance = await runDataImport(
      {
        command: "poi",
        dryRun: false,
        environment: "local",
        input: { filePath: placesPath, sourcesPath: placeSourcesPath },
        operatorId: "integration-test",
      },
      client,
      { manageTransaction: false },
    );
    assert.equal(updateProvenance.status, "passed");
    assert.equal(updateProvenance.entities.placeSources.updated, 1);

    await writeFile(
      conflictingPlacesPath,
      [
        "internal_id,name,address,latitude,longitude,district,status,is_simulated,size_category,estimated_capacity,price_level,typical_spend_min,typical_spend_max,currency",
        "verify_import_other,Other Verify Cafe,2 Verify Street,10.79,106.71,Quận 1,published,true,small,10,1,20000,40000,VND",
      ].join("\n"),
    );
    await writeFile(
      conflictingSourcesPath,
      [
        "place_id,provider,provider_place_id,last_synced_at,source_url",
        `verify_import_other,fsq_os_places,fsq-verify-place,${newerSyncTime.toISOString()},https://example.com/places/fsq-verify-place`,
      ].join("\n"),
    );
    const ownershipConflict = await runDataImport(
      {
        command: "poi",
        dryRun: false,
        environment: "local",
        input: {
          filePath: conflictingPlacesPath,
          sourcesPath: conflictingSourcesPath,
        },
        operatorId: "integration-test",
      },
      client,
      { manageTransaction: false },
    );
    assert.equal(ownershipConflict.status, "failed");
    assert.ok(
      ownershipConflict.issues.some(
        ({ code }) => code === "provider_id_ownership_conflict",
      ),
    );
    const rejectedPlace = await client.query<{ count: number }>(
      "SELECT count(*)::integer AS count FROM places WHERE internal_id = 'verify_import_other'",
    );
    assert.equal(rejectedPlace.rows[0].count, 0);

    const seed = await runDataImport(
      {
        command: "seed",
        dryRun: false,
        environment: "local",
        input: { directory },
        operatorId: "integration-test",
      },
      client,
      { manageTransaction: false },
    );
    assert.equal(seed.status, "passed");
    assert.equal(seed.entities.places.unchanged, 1);
    assert.equal(seed.entities.placeAreas.created, 1);
    assert.equal(seed.entities.vibeReports.created, 1);

    const repeat = await runDataImport(
      {
        command: "seed",
        dryRun: true,
        environment: "local",
        input: { directory },
        operatorId: "integration-test",
      },
      client,
      { manageTransaction: false },
    );
    assert.equal(repeat.status, "passed");
    assert.equal(repeat.counts.created, 0);
    assert.equal(repeat.entities.places.unchanged, 1);
    assert.equal(repeat.entities.placeAreas.unchanged, 1);
    assert.equal(repeat.entities.vibeReports.unchanged, 1);

    const databaseState = await client.query<{
      is_covered: boolean;
      membership_count: number;
      source_count: number;
      report_count: number;
    }>(
      `SELECT
         ST_Covers(boundary.boundary, place.location) AS is_covered,
         (SELECT count(*)::integer FROM place_service_areas AS membership
           WHERE membership.place_id = place.id) AS membership_count,
         (SELECT count(*)::integer FROM vibe_reports AS report
           WHERE report.place_id = place.id) AS report_count,
         (SELECT count(*)::integer FROM place_sources AS source
           WHERE source.place_id = place.id
             AND source.provider = 'fsq_os_places'
             AND source.provider_place_id = 'fsq-verify-place') AS source_count
       FROM places AS place
       JOIN service_area_boundaries AS boundary ON boundary.is_current = true
      WHERE place.internal_id = 'verify_import_place'
        AND boundary.service_area_id = (
          SELECT id FROM service_areas WHERE code = 'verify-import-q1'
        )`,
    );
    assert.deepEqual(databaseState.rows[0], {
      is_covered: true,
      membership_count: expectedMembershipCount,
      report_count: 1,
      source_count: 1,
    });

    const currentBoundary = await client.query<{ version: number }>(
      `SELECT boundary.version
         FROM service_area_boundaries AS boundary
         JOIN service_areas AS area ON area.id = boundary.service_area_id
        WHERE area.code = 'verify-import-q1' AND boundary.is_current = true`,
    );
    assert.deepEqual(currentBoundary.rows, [{ version: 1 }]);

    const providerSource = await client.query<{
      last_synced_at: Date;
      source_url: string;
    }>(
      `SELECT last_synced_at, source_url
         FROM place_sources
        WHERE provider = 'fsq_os_places'
          AND provider_place_id = 'fsq-verify-place'`,
    );
    assert.equal(
      providerSource.rows[0].last_synced_at.getTime(),
      newerSyncTime.getTime(),
    );
    assert.equal(
      providerSource.rows[0].source_url,
      "https://example.com/places/fsq-verify-place-v2",
    );

    await client.query("ROLLBACK");
    transactionOpen = false;
    console.log("Data importer integration verification passed.");
  } finally {
    if (transactionOpen) await client.query("ROLLBACK");
    await client.end();
    await rm(directory, { force: true, recursive: true });
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exitCode = 1;
});
