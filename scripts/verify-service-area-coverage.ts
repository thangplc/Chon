import "dotenv/config";

import { parseArgs } from "node:util";

import { serviceAreaBoundaries } from "../src/config/service-area-boundaries";
import { createImportDatabaseClient } from "../src/data-import/database";
import { readVerifiedBoundarySourceObject } from "../src/service-areas/source-object";

type BoundaryRow = Readonly<{
  area_type: string;
  boundary_version: number | null;
  checksum: string | null;
  code: string;
  current_boundary_count: number;
  display_name: string;
  geometry_type: string | null;
  is_empty: boolean | null;
  is_valid: boolean | null;
  priority: number;
  retrieved_at: Date | null;
  source_license: string | null;
  source_name: string | null;
  source_relation_id: string | null;
  source_storage_key: string | null;
  source_url: string | null;
  srid: number | null;
  status: string;
  timezone: string;
}>;

type MembershipRow = Readonly<{
  boundary_version: number;
  code: string;
  current_boundary_version: number;
  internal_id: string;
  is_primary: boolean;
}>;

type ExpectedMembershipRow = Readonly<{
  code: string;
  internal_id: string;
}>;

type TargetPlaceRow = Readonly<{
  district: string;
  internal_id: string;
}>;

function pairKey(row: Readonly<{ code: string; internal_id: string }>): string {
  return `${row.internal_id}:${row.code}`;
}

function asTimestamp(value: Date | null): number | undefined {
  return value ? new Date(value).getTime() : undefined;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { json: { type: "boolean" } },
    strict: true,
  });
  const sourceObjects = await Promise.all(
    serviceAreaBoundaries.map(async (definition) => ({
      definition,
      source: await readVerifiedBoundarySourceObject(definition),
    })),
  );
  const codes = serviceAreaBoundaries.map(({ code }) => code);
  const client = createImportDatabaseClient();
  const failures: string[] = [];

  try {
    await client.connect();
    const boundaryResult = await client.query<BoundaryRow>(
      `SELECT service_area.code,
              service_area.display_name,
              service_area.area_type,
              service_area.timezone,
              service_area.priority,
              service_area.status,
              boundary.version AS boundary_version,
              boundary.source_storage_key,
              boundary.source_name,
              boundary.source_relation_id,
              boundary.source_url,
              boundary.source_license,
              boundary.retrieved_at,
              boundary.checksum,
              ST_IsValid(boundary.boundary) AS is_valid,
              ST_IsEmpty(boundary.boundary) AS is_empty,
              ST_SRID(boundary.boundary) AS srid,
              GeometryType(boundary.boundary) AS geometry_type,
              (SELECT count(*)::integer
                 FROM service_area_boundaries AS current_boundary
                WHERE current_boundary.service_area_id = service_area.id
                  AND current_boundary.is_current = true) AS current_boundary_count
         FROM service_areas AS service_area
         LEFT JOIN service_area_boundaries AS boundary
           ON boundary.service_area_id = service_area.id
          AND boundary.is_current = true
        WHERE service_area.code = ANY($1::text[])
        ORDER BY service_area.code`,
      [codes],
    );
    const boundaryRows = boundaryResult.rows;

    for (const { definition, source } of sourceObjects) {
      const rows = boundaryRows.filter(({ code }) => code === definition.code);
      if (rows.length !== 1) {
        failures.push(
          `${definition.code}: expected one service area, found ${rows.length}`,
        );
        continue;
      }

      const row = rows[0];
      const expectations: ReadonlyArray<readonly [string, unknown, unknown]> = [
        ["display_name", row.display_name, definition.displayName],
        ["area_type", row.area_type, definition.areaType],
        ["timezone", row.timezone, definition.timezone],
        ["priority", row.priority, definition.priority],
        ["status", row.status, definition.status],
        ["current boundary count", row.current_boundary_count, 1],
        ["boundary version", row.boundary_version, definition.version],
        ["geometry type", row.geometry_type, "MULTIPOLYGON"],
        ["SRID", row.srid, 4326],
        ["valid geometry", row.is_valid, true],
        ["empty geometry", row.is_empty, false],
        [
          "source storage key",
          row.source_storage_key,
          definition.sourceStorageKey,
        ],
        ["source name", row.source_name, definition.sourceName],
        [
          "source relation ID",
          row.source_relation_id,
          definition.sourceRelationId,
        ],
        ["source URL", row.source_url, definition.sourceUrl],
        ["source license", row.source_license, definition.sourceLicense],
        ["checksum", row.checksum, source.manifest.checksum],
        [
          "retrieved_at",
          asTimestamp(row.retrieved_at),
          new Date(source.manifest.retrievedAt).getTime(),
        ],
      ];

      for (const [field, actual, expected] of expectations) {
        if (actual !== expected) {
          failures.push(
            `${definition.code}: ${field}=${String(actual)}, expected ${String(expected)}`,
          );
        }
      }
    }

    const expectedResult = await client.query<ExpectedMembershipRow>(
      `SELECT place.internal_id, service_area.code
         FROM places AS place
         JOIN service_area_boundaries AS boundary
           ON boundary.is_current = true
          AND ST_Covers(boundary.boundary, place.location)
         JOIN service_areas AS service_area
           ON service_area.id = boundary.service_area_id
        WHERE service_area.code = ANY($1::text[])
        ORDER BY place.internal_id, service_area.code`,
      [codes],
    );
    const actualResult = await client.query<MembershipRow>(
      `SELECT place.internal_id,
              service_area.code,
              membership.is_primary,
              membership.boundary_version,
              boundary.version AS current_boundary_version
         FROM place_service_areas AS membership
         JOIN places AS place ON place.id = membership.place_id
         JOIN service_areas AS service_area
           ON service_area.id = membership.service_area_id
         JOIN service_area_boundaries AS boundary
           ON boundary.service_area_id = service_area.id
          AND boundary.is_current = true
        WHERE service_area.code = ANY($1::text[])
        ORDER BY place.internal_id, service_area.code`,
      [codes],
    );
    const expectedKeys = new Set(expectedResult.rows.map(pairKey));
    const actualKeys = new Set(actualResult.rows.map(pairKey));

    for (const key of expectedKeys) {
      if (!actualKeys.has(key))
        failures.push(`Missing spatial membership: ${key}`);
    }
    for (const key of actualKeys) {
      if (!expectedKeys.has(key))
        failures.push(`Extra spatial membership: ${key}`);
    }
    for (const row of actualResult.rows) {
      if (row.boundary_version !== row.current_boundary_version) {
        failures.push(
          `${pairKey(row)} uses boundary v${row.boundary_version}, current is v${row.current_boundary_version}`,
        );
      }
    }

    const districtToCode = new Map([
      ["Quận 1", "hcm-q1"],
      ["Quận 3", "hcm-q3"],
      ["Bình Thạnh", "hcm-binh-thanh"],
      ["Quận Bình Thạnh", "hcm-binh-thanh"],
    ]);
    const targetPlaceResult = await client.query<TargetPlaceRow>(
      `SELECT internal_id, district
         FROM places
        WHERE district = ANY($1::text[])
        ORDER BY internal_id`,
      [[...districtToCode.keys()]],
    );

    for (const place of targetPlaceResult.rows) {
      const expectedCode = districtToCode.get(place.district);
      if (!expectedCode) continue;

      const expectedPair = pairKey({ code: expectedCode, ...place });
      if (!expectedKeys.has(expectedPair)) {
        failures.push(
          `${place.internal_id}: district=${place.district} but point is outside ${expectedCode}`,
        );
      }

      const memberships = actualResult.rows.filter(
        ({ internal_id: internalId }) => internalId === place.internal_id,
      );
      const primaryCount = memberships.filter(
        ({ is_primary: primary }) => primary,
      ).length;
      if (primaryCount !== 1) {
        failures.push(
          `${place.internal_id}: expected one primary service area, found ${primaryCount}`,
        );
      }
    }

    const counts = serviceAreaBoundaries.map((definition) => ({
      code: definition.code,
      currentBoundary: boundaryRows.find(({ code }) => code === definition.code)
        ?.boundary_version,
      memberships: actualResult.rows.filter(
        ({ code }) => code === definition.code,
      ).length,
      relation: definition.sourceRelationId,
      storageKey: definition.sourceStorageKey,
    }));
    const output = {
      boundaries: counts,
      failures,
      spatialMemberships: actualResult.rows.length,
      status: failures.length === 0 ? "passed" : "failed",
      targetPlaces: targetPlaceResult.rows.length,
    };

    if (values.json) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.table(counts);
      console.log(`Target places:       ${output.targetPlaces}`);
      console.log(`Spatial memberships: ${output.spatialMemberships}`);
      for (const failure of failures) console.error(`ERROR: ${failure}`);
      console.log(`Coverage verification: ${output.status.toUpperCase()}`);
    }

    if (failures.length > 0) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
