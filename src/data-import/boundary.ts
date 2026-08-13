import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import type { ImportDatabaseClient } from "./database";
import { sha256 } from "./csv";
import type { SummaryDraft } from "./summary";
import { ImportError } from "./types";

export type BoundaryOptions = Readonly<{
  areaType: string;
  code: string;
  current: boolean;
  displayName: string;
  filePath: string;
  parentCode?: string;
  priority: number;
  retrievedAt: Date;
  sourceLicense: string;
  sourceName: string;
  sourceRelationId: string;
  sourceStorageKey: string;
  sourceUrl: string;
  status: "draft" | "active" | "paused" | "archived";
  timezone: string;
  version: number;
}>;

type BoundarySource = Readonly<{
  checksum: string;
  fileName: string;
  geometryJson: string;
}>;

export type BoundaryPlan = Readonly<{
  action: "activate" | "create" | "unchanged";
  options: BoundaryOptions;
  parentId: string | null;
  serviceAreaAction: "create" | "unchanged" | "update";
  serviceAreaId?: string;
  source: BoundarySource;
}>;

type GeoJsonGeometry = Readonly<{
  coordinates: unknown;
  type: string;
}>;

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function collectGeometry(value: unknown): GeoJsonGeometry[] {
  const object = asObject(value);
  if (!object || typeof object.type !== "string") return [];

  if (object.type === "FeatureCollection") {
    return Array.isArray(object.features)
      ? object.features.flatMap((feature) => collectGeometry(feature))
      : [];
  }

  if (object.type === "Feature") return collectGeometry(object.geometry);

  if (
    (object.type === "Polygon" || object.type === "MultiPolygon") &&
    Array.isArray(object.coordinates)
  ) {
    return [
      {
        coordinates: object.coordinates,
        type: object.type,
      },
    ];
  }

  return [];
}

async function readBoundarySource(filePath: string): Promise<BoundarySource> {
  const content = await readFile(filePath, "utf8");
  const fileName = basename(filePath);
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new ImportError(`Cannot parse ${fileName}`, [
      {
        code: "invalid_geojson",
        file: fileName,
        message: error instanceof Error ? error.message : "Invalid JSON",
        severity: "error",
      },
    ]);
  }

  const geometries = collectGeometry(parsed);
  if (geometries.length === 0) {
    throw new ImportError(`No polygon found in ${fileName}`, [
      {
        code: "invalid_geojson_geometry",
        file: fileName,
        message: "GeoJSON must contain at least one Polygon or MultiPolygon",
        severity: "error",
      },
    ]);
  }

  const coordinates = geometries.flatMap((geometry) =>
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : (geometry.coordinates as unknown[]),
  );

  return {
    checksum: sha256(content),
    fileName,
    geometryJson: JSON.stringify({ coordinates, type: "MultiPolygon" }),
  };
}

async function validateGeometry(
  client: ImportDatabaseClient,
  source: BoundarySource,
): Promise<void> {
  const result = await client.query<{
    is_empty: boolean;
    is_valid: boolean;
    reason: string;
    xmax: number;
    xmin: number;
    ymax: number;
    ymin: number;
  }>(
    `WITH geometry AS (
       SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS value
     )
     SELECT ST_IsEmpty(value) AS is_empty,
            ST_IsValid(value) AS is_valid,
            ST_IsValidReason(value) AS reason,
            ST_XMin(Box3D(value)) AS xmin,
            ST_XMax(Box3D(value)) AS xmax,
            ST_YMin(Box3D(value)) AS ymin,
            ST_YMax(Box3D(value)) AS ymax
       FROM geometry`,
    [source.geometryJson],
  );
  const geometry = result.rows[0];
  const issues = [];

  if (geometry.is_empty) {
    issues.push({
      code: "empty_boundary",
      file: source.fileName,
      message: "Boundary geometry is empty",
      severity: "error" as const,
    });
  }
  if (!geometry.is_valid) {
    issues.push({
      code: "invalid_boundary",
      file: source.fileName,
      message: geometry.reason,
      severity: "error" as const,
    });
  }
  if (
    geometry.xmin < -180 ||
    geometry.xmax > 180 ||
    geometry.ymin < -90 ||
    geometry.ymax > 90
  ) {
    issues.push({
      code: "boundary_coordinate_range",
      file: source.fileName,
      message: "Boundary coordinates must be valid longitude/latitude values",
      severity: "error" as const,
    });
  }

  if (issues.length > 0) {
    throw new ImportError("Boundary validation failed", issues);
  }
}

export async function planBoundaryImport(
  client: ImportDatabaseClient,
  options: BoundaryOptions,
  draft: SummaryDraft,
): Promise<BoundaryPlan> {
  const source = await readBoundarySource(options.filePath);
  draft.files.push({
    checksum: source.checksum,
    name: source.fileName,
    records: 1,
  });
  await validateGeometry(client, source);

  const parent = options.parentCode
    ? await client.query<{ id: string }>(
        "SELECT id FROM service_areas WHERE code = $1",
        [options.parentCode],
      )
    : undefined;
  if (options.parentCode && !parent?.rowCount) {
    throw new ImportError("Boundary parent does not exist", [
      {
        code: "missing_parent_service_area",
        message: `Parent service area ${options.parentCode} does not exist`,
        severity: "error",
      },
    ]);
  }
  const parentId = parent?.rows[0]?.id ?? null;
  const areaResult = await client.query<{
    area_type: string;
    display_name: string;
    id: string;
    parent_id: string | null;
    priority: number;
    status: string;
    timezone: string;
  }>("SELECT * FROM service_areas WHERE code = $1", [options.code]);
  const area = areaResult.rows[0];
  let serviceAreaAction: BoundaryPlan["serviceAreaAction"] = "create";

  if (area) {
    serviceAreaAction =
      area.display_name === options.displayName &&
      area.area_type === options.areaType &&
      area.timezone === options.timezone &&
      area.priority === options.priority &&
      area.status === options.status &&
      area.parent_id === parentId
        ? "unchanged"
        : "update";
  }
  if (serviceAreaAction === "create") {
    draft.entities.serviceAreas.created += 1;
  } else if (serviceAreaAction === "update") {
    draft.entities.serviceAreas.updated += 1;
  } else {
    draft.entities.serviceAreas.unchanged += 1;
  }

  const boundaryResult = area
    ? await client.query<{
        checksum: string;
        is_current: boolean;
        retrieved_at: Date;
        source_license: string;
        source_name: string;
        source_relation_id: string;
        source_storage_key: string;
        source_url: string;
      }>(
        `SELECT checksum, is_current, retrieved_at, source_license, source_name,
                source_relation_id, source_storage_key, source_url
           FROM service_area_boundaries
          WHERE service_area_id = $1 AND version = $2`,
        [area.id, options.version],
      )
    : undefined;
  const boundary = boundaryResult?.rows[0];
  let action: BoundaryPlan["action"] = "create";

  if (boundary) {
    const unchanged =
      boundary.checksum === source.checksum &&
      boundary.source_license === options.sourceLicense &&
      boundary.source_name === options.sourceName &&
      boundary.source_relation_id === options.sourceRelationId &&
      boundary.source_storage_key === options.sourceStorageKey &&
      boundary.source_url === options.sourceUrl &&
      boundary.retrieved_at.getTime() === options.retrievedAt.getTime();

    if (!unchanged) {
      draft.entities.boundaries.conflicts += 1;
      draft.issues.push({
        code: "boundary_version_conflict",
        message: `Boundary ${options.code} version ${options.version} already exists with different source content or metadata`,
        severity: "error",
      });
    } else {
      action =
        options.current && !boundary.is_current ? "activate" : "unchanged";
    }
  }
  if (action === "create") {
    draft.entities.boundaries.created += 1;
  } else if (action === "activate") {
    draft.entities.boundaries.updated += 1;
  } else {
    draft.entities.boundaries.unchanged += 1;
  }

  if (action !== "unchanged" && options.current) {
    const membership = await client.query<{
      existing_memberships: number;
      new_memberships: number;
    }>(
      `WITH candidate AS (
         SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS boundary
       )
       SELECT
         (SELECT count(*)::integer FROM places, candidate
           WHERE ST_Covers(candidate.boundary, places.location)
             AND NOT EXISTS (
               SELECT 1 FROM place_service_areas AS membership
                WHERE membership.place_id = places.id
                  AND membership.service_area_id = $2
             )) AS new_memberships,
         (SELECT count(*)::integer FROM place_service_areas
           WHERE service_area_id = $2) AS existing_memberships`,
      [source.geometryJson, area?.id ?? "00000000-0000-0000-0000-000000000000"],
    );
    draft.entities.placeServiceAreas.created +=
      membership.rows[0].new_memberships;
    draft.entities.placeServiceAreas.updated +=
      membership.rows[0].existing_memberships;
  }

  return {
    action,
    options,
    parentId,
    serviceAreaAction,
    serviceAreaId: area?.id,
    source,
  };
}

export async function executeBoundaryPlan(
  client: ImportDatabaseClient,
  plan: BoundaryPlan,
): Promise<void> {
  const { options, source } = plan;
  let serviceAreaId = plan.serviceAreaId;

  if (plan.serviceAreaAction === "create") {
    const result = await client.query<{ id: string }>(
      `INSERT INTO service_areas
        (code, display_name, area_type, timezone, priority, status, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        options.code,
        options.displayName,
        options.areaType,
        options.timezone,
        options.priority,
        options.status,
        plan.parentId,
      ],
    );
    serviceAreaId = result.rows[0].id;
  } else if (plan.serviceAreaAction === "update") {
    await client.query(
      `UPDATE service_areas
          SET display_name = $2, area_type = $3, timezone = $4, priority = $5,
              status = $6, parent_id = $7, updated_at = now()
        WHERE id = $1`,
      [
        serviceAreaId,
        options.displayName,
        options.areaType,
        options.timezone,
        options.priority,
        options.status,
        plan.parentId,
      ],
    );
  }

  if (plan.action === "unchanged") return;
  if (!serviceAreaId) throw new Error("Service area ID was not resolved");

  if (options.current) {
    await client.query(
      `UPDATE service_area_boundaries
          SET is_current = false, updated_at = now()
        WHERE service_area_id = $1 AND is_current = true`,
      [serviceAreaId],
    );
  }

  if (plan.action === "create") {
    await client.query(
      `INSERT INTO service_area_boundaries
        (service_area_id, version, boundary, source_storage_key, source_name,
         source_relation_id, source_url, source_license, retrieved_at, checksum,
         is_current)
       VALUES
        ($1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326), $4, $5, $6, $7, $8,
         $9, $10, $11)`,
      [
        serviceAreaId,
        options.version,
        source.geometryJson,
        options.sourceStorageKey,
        options.sourceName,
        options.sourceRelationId,
        options.sourceUrl,
        options.sourceLicense,
        options.retrievedAt,
        source.checksum,
        options.current,
      ],
    );
  } else {
    await client.query(
      `UPDATE service_area_boundaries
          SET is_current = true, updated_at = now()
        WHERE service_area_id = $1 AND version = $2`,
      [serviceAreaId, options.version],
    );
  }

  if (!options.current) return;

  await client.query(
    `DELETE FROM place_service_areas AS membership
      WHERE membership.service_area_id = $1
        AND NOT EXISTS (
          SELECT 1
            FROM service_area_boundaries AS boundary
            JOIN places AS place ON place.id = membership.place_id
           WHERE boundary.service_area_id = $1
             AND boundary.version = $2
             AND ST_Covers(boundary.boundary, place.location)
        )`,
    [serviceAreaId, options.version],
  );
  await client.query(
    `UPDATE place_service_areas
        SET boundary_version = $2, assigned_at = now()
      WHERE service_area_id = $1`,
    [serviceAreaId, options.version],
  );
  await client.query(
    `INSERT INTO place_service_areas
      (place_id, service_area_id, is_primary, boundary_version)
     SELECT place.id, $1,
            NOT EXISTS (
              SELECT 1 FROM place_service_areas AS current_primary
               WHERE current_primary.place_id = place.id
                 AND current_primary.is_primary = true
            ),
            $2
       FROM places AS place
       JOIN service_area_boundaries AS boundary
         ON boundary.service_area_id = $1 AND boundary.version = $2
      WHERE ST_Covers(boundary.boundary, place.location)
     ON CONFLICT (place_id, service_area_id) DO NOTHING`,
    [serviceAreaId, options.version],
  );
}
