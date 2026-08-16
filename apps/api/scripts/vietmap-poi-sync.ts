import "./load-api-env.mjs";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs } from "node:util";

import {
  runDataImport,
  type DataImportOptions,
} from "../src/data-pipeline/import/runner";
import {
  createImportDatabaseClient,
  type ImportDatabaseClient,
} from "../src/data-pipeline/import/database";
import { printSummary } from "../src/data-pipeline/import/summary";
import type { ImportEnvironment } from "../src/data-pipeline/import/types";
import { readVietmapPoiConfig } from "../src/providers/poi/config";
import { VietmapPoiClient } from "../src/providers/poi/vietmap/client";
import {
  createVietmapImportRows,
  serializeVietmapCsv,
  VIETMAP_PLACE_CSV_HEADERS,
  VIETMAP_SOURCE_CSV_HEADERS,
} from "../src/providers/poi/vietmap/sync";

type SyncArea = Readonly<{
  code: string;
  displayName: string;
  latitude: number;
  longitude: number;
  maxLatitude: number;
  maxLongitude: number;
  minLatitude: number;
  minLongitude: number;
}>;

type FetchedPoi = Readonly<{
  area: SyncArea;
  poi: Awaited<ReturnType<VietmapPoiClient["search"]>>[number];
}>;

const DEFAULT_AREA_CODES = ["hcm-q1", "hcm-q3", "hcm-binh-thanh"] as const;
const AREA_ALIASES: Readonly<Record<string, string>> = {
  binh_thanh: "hcm-binh-thanh",
  "binh-thanh": "hcm-binh-thanh",
  q1: "hcm-q1",
  q3: "hcm-q3",
};

const HELP = `VIETMAP POI sync (live, backend-only)

Usage:
  pnpm vietmap:poi:sync --dry-run
  pnpm vietmap:poi:sync --areas hcm-q1,hcm-q3,hcm-binh-thanh --dry-run
  pnpm vietmap:poi:sync --areas q1,q3,binh-thanh --environment local

Options:
  --areas <codes>       Active service-area codes (default: three HCM areas)
  --category <code>     VIETMAP POI category, defaults to env config
  --dry-run             Fetch live data and validate without database writes
  --environment <name>  local|ci|staging|research|production (default: local)
  --json                Print machine-readable import summary
  --radius <meters>     Search radius per area (default: 1500)
  --text <query>        Search text (default: env config or cafe)
`;

const environments = new Set<ImportEnvironment>([
  "local",
  "ci",
  "staging",
  "research",
  "production",
]);

function positiveNumber(
  value: string | undefined,
  option: string,
  fallback: number,
): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${option} must be a positive number`);
  }
  return parsed;
}

function parseAreaCodes(value: string | undefined): readonly string[] {
  const raw = value
    ? value
        .split(",")
        .map((code) => code.trim().toLowerCase())
        .filter(Boolean)
    : [...DEFAULT_AREA_CODES];
  const codes = raw.map((code) => AREA_ALIASES[code] ?? code);
  if (codes.length === 0) throw new Error("--areas must not be empty");
  if (codes.some((code) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code))) {
    throw new Error("--areas must contain lowercase kebab-case area codes");
  }
  return [...new Set(codes)];
}

async function loadActiveAreas(
  client: ImportDatabaseClient,
  codes: readonly string[],
): Promise<readonly SyncArea[]> {
  const result = await client.query<{
    code: string;
    display_name: string;
    latitude: number;
    longitude: number;
    max_latitude: number;
    max_longitude: number;
    min_latitude: number;
    min_longitude: number;
  }>(
    `SELECT area.code, area.display_name,
            ST_Y(ST_PointOnSurface(boundary.boundary)) AS latitude,
            ST_X(ST_PointOnSurface(boundary.boundary)) AS longitude,
            ST_YMax(Box3D(boundary.boundary)) AS max_latitude,
            ST_XMax(Box3D(boundary.boundary)) AS max_longitude,
            ST_YMin(Box3D(boundary.boundary)) AS min_latitude,
            ST_XMin(Box3D(boundary.boundary)) AS min_longitude
       FROM service_areas AS area
       JOIN service_area_boundaries AS boundary
         ON boundary.service_area_id = area.id
        AND boundary.is_current = true
      WHERE area.code = ANY($1::text[])
        AND area.status = 'active'
      ORDER BY area.priority DESC, area.code`,
    [codes],
  );

  const foundCodes = new Set(result.rows.map(({ code }) => code));
  const missing = codes.filter((code) => !foundCodes.has(code));
  if (missing.length > 0) {
    throw new Error(
      `Active current service areas not found: ${missing.join(", ")}`,
    );
  }

  return result.rows.map((row) => ({
    code: row.code,
    displayName: row.display_name,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    maxLatitude: Number(row.max_latitude),
    maxLongitude: Number(row.max_longitude),
    minLatitude: Number(row.min_latitude),
    minLongitude: Number(row.min_longitude),
  }));
}

function searchCenters(
  area: SyncArea,
  radiusMeters: number,
): readonly Readonly<{ latitude: number; longitude: number }>[] {
  const latitudeRange = Math.max(0, area.maxLatitude - area.minLatitude);
  const longitudeRange = Math.max(0, area.maxLongitude - area.minLongitude);
  const latitudeStep = radiusMeters / 111_000;
  const longitudeStep =
    radiusMeters /
    (111_000 * Math.max(Math.cos((area.latitude * Math.PI) / 180), 0.2));
  const latitudeCount = Math.max(
    1,
    Math.ceil(latitudeRange / (latitudeStep * 1.25)),
  );
  const longitudeCount = Math.max(
    1,
    Math.ceil(longitudeRange / (longitudeStep * 1.25)),
  );
  const centers: { latitude: number; longitude: number }[] = [];

  for (
    let latitudeIndex = 0;
    latitudeIndex < latitudeCount;
    latitudeIndex += 1
  ) {
    for (
      let longitudeIndex = 0;
      longitudeIndex < longitudeCount;
      longitudeIndex += 1
    ) {
      centers.push({
        latitude:
          area.minLatitude +
          ((latitudeIndex + 0.5) / latitudeCount) * latitudeRange,
        longitude:
          area.minLongitude +
          ((longitudeIndex + 0.5) / longitudeCount) * longitudeRange,
      });
    }
  }

  return centers;
}

async function fetchAreas(
  areas: readonly SyncArea[],
  input: Readonly<{
    category: string | undefined;
    radiusMeters: number;
    text: string;
  }>,
): Promise<readonly FetchedPoi[]> {
  const config = readVietmapPoiConfig();
  if (!config.enabled) {
    throw new Error(
      "Set VIETMAP_POI_ENABLED=true before running the live VIETMAP sync",
    );
  }

  const adapter = new VietmapPoiClient(config);
  const results: FetchedPoi[] = [];

  for (const area of areas) {
    for (const center of searchCenters(area, input.radiusMeters)) {
      const places = await adapter.search({
        category: input.category,
        latitude: center.latitude,
        longitude: center.longitude,
        radiusMeters: input.radiusMeters,
        text: input.text,
      });
      for (const poi of places) results.push({ area, poi });
    }
  }

  return results;
}

async function keepPointsCoveredByActiveBoundaries(
  client: ImportDatabaseClient,
  fetched: readonly FetchedPoi[],
  areas: readonly SyncArea[],
): Promise<Readonly<{ covered: readonly FetchedPoi[]; outside: number }>> {
  if (fetched.length === 0) return { covered: [], outside: 0 };

  const areaCodes = areas.map(({ code }) => code);

  const candidates = [
    ...new Map(
      fetched.map(({ poi }) => [
        poi.providerPlaceId,
        {
          latitude: poi.latitude,
          longitude: poi.longitude,
          provider_place_id: poi.providerPlaceId,
        },
      ]),
    ).values(),
  ];
  const result = await client.query<{
    area_code: string;
    provider_place_id: string;
  }>(
    `WITH candidates AS (
       SELECT candidate.provider_place_id,
              candidate.latitude,
              candidate.longitude
         FROM jsonb_to_recordset($1::jsonb) AS candidate(
           provider_place_id text,
           latitude double precision,
           longitude double precision
         )
     )
     SELECT DISTINCT ON (candidate.provider_place_id)
              candidate.provider_place_id,
              area.code AS area_code
       FROM candidates AS candidate
       JOIN service_area_boundaries AS boundary
         ON boundary.is_current = true
       JOIN service_areas AS area
         ON area.id = boundary.service_area_id
        AND area.status = 'active'
        AND area.code = ANY($2::text[])
      WHERE ST_Covers(
        boundary.boundary,
        ST_SetSRID(ST_MakePoint(candidate.longitude, candidate.latitude), 4326)
      )
      ORDER BY candidate.provider_place_id, area.priority DESC, area.code`,
    [JSON.stringify(candidates), areaCodes],
  );
  const areaByCode = new Map(areas.map((area) => [area.code, area]));
  const coveredAreaByProviderId = new Map(
    result.rows.flatMap((row) => {
      const area = areaByCode.get(row.area_code);
      return area ? [[row.provider_place_id, area] as const] : [];
    }),
  );
  const covered = fetched.flatMap(({ poi }) => {
    const area = coveredAreaByProviderId.get(poi.providerPlaceId);
    return area ? [{ area, poi }] : [];
  });
  return { covered, outside: fetched.length - covered.length };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      areas: { type: "string" },
      category: { type: "string" },
      "dry-run": { type: "boolean" },
      environment: { type: "string" },
      help: { short: "h", type: "boolean" },
      json: { type: "boolean" },
      radius: { type: "string" },
      text: { type: "string" },
    },
    strict: true,
  });

  if (values.help) {
    console.log(HELP);
    return;
  }

  const rawEnvironment =
    typeof values.environment === "string" ? values.environment : "local";
  if (!environments.has(rawEnvironment as ImportEnvironment)) {
    throw new Error(`Invalid --environment: ${rawEnvironment}`);
  }

  const config = readVietmapPoiConfig();
  if (rawEnvironment === "production" && !config.productionReady) {
    throw new Error(
      "VIETMAP_POI_PRODUCTION_READY=true is required for production sync",
    );
  }
  const areaCodes = parseAreaCodes(values.areas);
  const radiusMeters = positiveNumber(values.radius, "radius", 1_500);
  const category =
    typeof values.category === "string"
      ? values.category.trim() || undefined
      : config.categoryCafe;
  const text =
    typeof values.text === "string" && values.text.trim()
      ? values.text.trim()
      : config.queryText;
  const dryRun = values["dry-run"] === true;
  const json = values.json === true;
  let database: ImportDatabaseClient | undefined;
  let temporaryDirectory: string | undefined;

  try {
    database = createImportDatabaseClient();
    await database.connect();
    const areas = await loadActiveAreas(database, areaCodes);
    const fetched = await fetchAreas(areas, { category, radiusMeters, text });
    const coverage = await keepPointsCoveredByActiveBoundaries(
      database,
      fetched,
      areas,
    );
    await database.end();
    database = undefined;

    const rows = createVietmapImportRows(coverage.covered);
    temporaryDirectory = await mkdtemp(join(tmpdir(), "chon-vietmap-poi-"));
    const placesPath = join(temporaryDirectory, "places.csv");
    const sourcesPath = join(temporaryDirectory, "place-sources.csv");
    await writeFile(
      placesPath,
      serializeVietmapCsv(VIETMAP_PLACE_CSV_HEADERS, rows.places),
    );
    await writeFile(
      sourcesPath,
      serializeVietmapCsv(VIETMAP_SOURCE_CSV_HEADERS, rows.sources),
    );

    if (!json) {
      console.log(
        `Fetched ${fetched.length} provider results; excluded ${coverage.outside} outside active boundaries; ${rows.places.length} unique POIs across ${areas.length} service areas.`,
      );
      console.log(
        `Mode: ${dryRun ? "DRY RUN (no database writes)" : "IMPORT"}; category=${category ?? "none"}; radius=${radiusMeters}m; text=${text}`,
      );
    }

    const options: DataImportOptions = {
      command: "poi",
      dryRun,
      environment: rawEnvironment as ImportEnvironment,
      input: { filePath: placesPath, sourcesPath },
      operatorId: process.env.DATA_OPERATOR_ID ?? "local-developer",
    };
    const summary = await runDataImport(options);
    printSummary(summary, json);
    if (summary.status === "failed") process.exitCode = 1;
  } finally {
    if (database) await database.end();
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
