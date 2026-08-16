import "./load-api-env.mjs";

import { parseArgs } from "node:util";

import {
  beginImportTransaction,
  createImportDatabaseClient,
  type ImportDatabaseClient,
} from "../src/data-pipeline/import/database";
import type { ImportEnvironment } from "../src/data-pipeline/import/types";
import type { PlaceOpeningHours } from "../../../packages/domain/src/place-detail/place-detail";
import { readOsmOpeningHoursConfig } from "../src/providers/osm/config";
import { matchOsmOpeningHours } from "../src/providers/osm/matcher";
import { parseOsmOpeningHours } from "../src/providers/osm/opening-hours";
import {
  OverpassClient,
  type OsmOpeningHoursCandidate,
} from "../src/providers/osm/overpass-client";

type PlaceRecord = Readonly<{
  address: string;
  district: string;
  id: string;
  internalId: string;
  latitude: number;
  longitude: number;
  name: string;
}>;

type ExistingOsmSource = Readonly<{
  id: string;
  placeInternalId: string;
  providerPlaceId: string;
}>;

type Resolution = Readonly<{
  candidate: OsmOpeningHoursCandidate;
  confidence: number;
  distanceMeters: number;
  openingHours: PlaceOpeningHours;
  place: PlaceRecord;
}>;

type Summary = {
  ambiguous: number;
  conflicts: number;
  invalidOpeningHours: number;
  matched: number;
  osmCandidates: number;
  requests: number;
  skippedExisting: number;
  unmatched: number;
  updated: number;
  warnings: string[];
};

const environments = new Set<ImportEnvironment>([
  "local",
  "ci",
  "staging",
  "research",
  "production",
]);

const HELP = `OSM opening-hours enrichment (Overpass, backend-only)

Usage:
  OSM_OPENING_HOURS_ENABLED=true pnpm osm:opening-hours:sync --dry-run
  OSM_OPENING_HOURS_ENABLED=true pnpm osm:opening-hours:sync --environment local

Options:
  --dry-run             Query OSM and report matches without database writes
  --environment <name>  local|ci|staging|research|production (default: local)
  --limit <n>           Limit missing-hours places for a small smoke test
  --json                Print machine-readable summary
`;

function parsePositiveInteger(
  value: string | undefined,
  option: string,
): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${option} must be a positive integer`);
  }
  return parsed;
}

async function loadPlaces(
  client: ImportDatabaseClient,
  limit: number | undefined,
): Promise<readonly PlaceRecord[]> {
  const result = await client.query<{
    address: string;
    district: string;
    id: string;
    internal_id: string;
    latitude: number;
    longitude: number;
    name: string;
  }>(
    `SELECT id, internal_id, name, address, district,
            ST_Y(location) AS latitude, ST_X(location) AS longitude
       FROM places
      WHERE status = 'published'
        AND is_simulated = false
        AND opening_hours IS NULL
      ORDER BY internal_id
      LIMIT $1`,
    [limit ?? 10_000],
  );
  return result.rows.map((row) => ({
    address: row.address,
    district: row.district,
    id: row.id,
    internalId: row.internal_id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    name: row.name,
  }));
}

async function countExistingOpeningHours(
  client: ImportDatabaseClient,
): Promise<number> {
  const result = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM places
      WHERE status = 'published'
        AND is_simulated = false
        AND opening_hours IS NOT NULL`,
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function loadExistingOsmSources(
  client: ImportDatabaseClient,
): Promise<readonly ExistingOsmSource[]> {
  const result = await client.query<{
    id: string;
    place_internal_id: string;
    provider_place_id: string;
  }>(
    `SELECT source.id, place.internal_id AS place_internal_id,
            source.provider_place_id
       FROM place_sources AS source
       JOIN places AS place ON place.id = source.place_id
      WHERE source.provider = 'openstreetmap'`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    placeInternalId: row.place_internal_id,
    providerPlaceId: row.provider_place_id,
  }));
}

function validateEnvironment(
  environment: ImportEnvironment,
  dryRun: boolean,
  productionReady: boolean,
): void {
  if (!dryRun && process.env.DATA_IMPORT_TARGET_ENVIRONMENT !== environment) {
    throw new Error(
      `DATA_IMPORT_TARGET_ENVIRONMENT must equal --environment=${environment} for writes`,
    );
  }
  if (environment === "production" && !productionReady) {
    throw new Error(
      "OSM_OPENING_HOURS_PRODUCTION_READY=true is required for production sync",
    );
  }
}

function sourceKey(candidate: OsmOpeningHoursCandidate): string {
  return `${candidate.osmType}:${candidate.osmId}`;
}

function printSummary(
  summary: Summary,
  input: Readonly<{
    dryRun: boolean;
    environment: ImportEnvironment;
    json: boolean;
  }>,
): void {
  if (input.json) {
    console.log(
      JSON.stringify(
        {
          ...summary,
          dryRun: input.dryRun,
          environment: input.environment,
          provider: "openstreetmap",
        },
        null,
        2,
      ),
    );
    return;
  }
  console.log("OSM opening-hours enrichment");
  console.log(`Mode:               ${input.dryRun ? "DRY RUN" : "IMPORT"}`);
  console.log(`Environment:        ${input.environment}`);
  console.log(`Overpass requests:  ${summary.requests}`);
  console.log(`OSM candidates:     ${summary.osmCandidates}`);
  console.log(`Matched:            ${summary.matched}`);
  console.log(`Updated:            ${summary.updated}`);
  console.log(`Skipped (existing): ${summary.skippedExisting}`);
  console.log(`Unmatched:          ${summary.unmatched}`);
  console.log(`Ambiguous:          ${summary.ambiguous}`);
  console.log(`Invalid/unsupported:${summary.invalidOpeningHours}`);
  console.log(`Source conflicts:   ${summary.conflicts}`);
  for (const warning of summary.warnings) console.log(`WARNING: ${warning}`);
}

async function writeResolutions(
  client: ImportDatabaseClient,
  resolutions: readonly Resolution[],
  existingSources: readonly ExistingOsmSource[],
): Promise<
  Readonly<{ conflicts: number; updated: number; warnings: string[] }>
> {
  const sourceByPlace = new Map(
    existingSources.map((source) => [source.placeInternalId, source]),
  );
  const sourceByProviderId = new Map(
    existingSources.map((source) => [source.providerPlaceId, source]),
  );
  let conflicts = 0;
  let updated = 0;
  const warnings: string[] = [];

  for (const resolution of resolutions) {
    const providerPlaceId = sourceKey(resolution.candidate);
    const sourceForPlace = sourceByPlace.get(resolution.place.internalId);
    const sourceForProvider = sourceByProviderId.get(providerPlaceId);
    if (sourceForPlace && sourceForPlace.providerPlaceId !== providerPlaceId) {
      conflicts += 1;
      warnings.push(
        `${resolution.place.internalId} already maps to openstreetmap:${sourceForPlace.providerPlaceId}`,
      );
      continue;
    }
    if (
      sourceForProvider &&
      sourceForProvider.placeInternalId !== resolution.place.internalId
    ) {
      conflicts += 1;
      warnings.push(
        `openstreetmap:${providerPlaceId} already maps to ${sourceForProvider.placeInternalId}`,
      );
      continue;
    }

    const rawData = JSON.stringify({
      match_confidence: resolution.confidence,
      match_distance_meters: resolution.distanceMeters,
      name: resolution.candidate.name,
      opening_hours: resolution.candidate.openingHours,
      osm_id: resolution.candidate.osmId,
      osm_type: resolution.candidate.osmType,
      tags: resolution.candidate.tags,
    });
    if (sourceForPlace) {
      await client.query(
        `UPDATE place_sources
            SET last_synced_at = now(), source_url = $2,
                raw_data = $3::jsonb, updated_at = now()
          WHERE id = $1`,
        [sourceForPlace.id, resolution.candidate.sourceUrl, rawData],
      );
    } else {
      const placeIdResult = await client.query<{ id: string }>(
        "SELECT id FROM places WHERE internal_id = $1",
        [resolution.place.internalId],
      );
      const placeId = placeIdResult.rows[0]?.id;
      if (!placeId) {
        conflicts += 1;
        warnings.push(
          `Place ${resolution.place.internalId} disappeared before write`,
        );
        continue;
      }
      await client.query(
        `INSERT INTO place_sources
          (place_id, provider, provider_place_id, last_synced_at, source_url, raw_data)
         VALUES ($1, 'openstreetmap', $2, now(), $3, $4::jsonb)`,
        [placeId, providerPlaceId, resolution.candidate.sourceUrl, rawData],
      );
    }
    await client.query(
      `UPDATE places
          SET opening_hours = $2::jsonb, updated_at = now()
        WHERE id = $1 AND opening_hours IS NULL`,
      [resolution.place.id, JSON.stringify(resolution.openingHours)],
    );
    updated += 1;
  }
  return { conflicts, updated, warnings };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean" },
      environment: { type: "string" },
      help: { short: "h", type: "boolean" },
      json: { type: "boolean" },
      limit: { type: "string" },
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
  const environment = rawEnvironment as ImportEnvironment;
  const dryRun = values["dry-run"] === true;
  const json = values.json === true;
  const limit = parsePositiveInteger(values.limit, "limit");
  const config = readOsmOpeningHoursConfig();
  if (!config.enabled) {
    throw new Error(
      "Set OSM_OPENING_HOURS_ENABLED=true before running OSM enrichment",
    );
  }
  validateEnvironment(environment, dryRun, config.productionReady);

  let client: ImportDatabaseClient | undefined;
  let transactionOpen = false;
  const summary: Summary = {
    ambiguous: 0,
    conflicts: 0,
    invalidOpeningHours: 0,
    matched: 0,
    osmCandidates: 0,
    requests: 0,
    skippedExisting: 0,
    unmatched: 0,
    updated: 0,
    warnings: [],
  };

  try {
    client = createImportDatabaseClient();
    await client.connect();
    summary.skippedExisting = await countExistingOpeningHours(client);
    const places = await loadPlaces(client, limit);
    const existingSources = await loadExistingOsmSources(client);

    if (places.length > 0) {
      const overpass = new OverpassClient(config);
      const lookup = await overpass.lookup(places);
      summary.requests = lookup.requests;
      summary.osmCandidates = lookup.candidates.length;
      const resolutions: Resolution[] = [];
      for (const place of places) {
        const match = matchOsmOpeningHours(
          place,
          lookup.candidates,
          config.radiusMeters,
        );
        if (match.status !== "matched") {
          if (match.status === "unmatched") summary.unmatched += 1;
          else summary.ambiguous += 1;
          continue;
        }
        const parsed = parseOsmOpeningHours(match.candidate.openingHours);
        if (!parsed.ok) {
          summary.invalidOpeningHours += 1;
          summary.warnings.push(
            `${place.internalId}: ${parsed.reason} (${match.candidate.openingHours})`,
          );
          continue;
        }
        summary.matched += 1;
        resolutions.push({
          candidate: match.candidate,
          confidence: match.confidence,
          distanceMeters: match.distanceMeters,
          openingHours: parsed.openingHours,
          place,
        });
      }

      if (!dryRun && resolutions.length > 0) {
        await beginImportTransaction(client);
        transactionOpen = true;
        const written = await writeResolutions(
          client,
          resolutions,
          existingSources,
        );
        summary.conflicts += written.conflicts;
        summary.updated = written.updated;
        summary.warnings.push(...written.warnings);
        await client.query("COMMIT");
        transactionOpen = false;
      }
    }
    printSummary(summary, { dryRun, environment, json });
  } catch (error) {
    if (transactionOpen && client) await client.query("ROLLBACK");
    throw error;
  } finally {
    if (client) await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
