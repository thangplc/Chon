import type { ImportDatabaseClient } from "./database";
import type { PlacePlan } from "./places";
import type { SummaryDraft } from "./summary";
import { ImportError } from "./types";
import type { PlaceInput, PlaceSourceInput } from "./validation";

type ExistingPlaceSource = Readonly<{
  id: string;
  lastSyncedAt: Date;
  placeInternalId: string;
  provider: string;
  providerPlaceId: string;
  sourceUrl: string | null;
}>;

type PlannedPlaceSource = Readonly<{
  existingId?: string;
  input: PlaceSourceInput;
}>;

export type PlaceSourcePlan = Readonly<{
  create: readonly PlannedPlaceSource[];
  update: readonly PlannedPlaceSource[];
}>;

function externalKey(source: PlaceSourceInput): string {
  return `${source.provider}\u0000${source.provider_place_id}`;
}

function placeProviderKey(source: PlaceSourceInput): string {
  return `${source.place_id}\u0000${source.provider}`;
}

export function assertUniqueProviderMappings(
  rows: readonly PlaceSourceInput[],
): void {
  const externalOwners = new Map<string, string>();
  const placeProviders = new Map<string, string>();
  const issues = [];

  for (const row of rows) {
    const external = externalKey(row);
    const externalOwner = externalOwners.get(external);
    if (externalOwner !== undefined) {
      issues.push({
        code: "duplicate_provider_mapping",
        message: `${row.provider}:${row.provider_place_id} appears more than once in the input (places ${externalOwner} and ${row.place_id})`,
        severity: "error" as const,
      });
    } else {
      externalOwners.set(external, row.place_id);
    }

    const placeProvider = placeProviderKey(row);
    const existingProviderId = placeProviders.get(placeProvider);
    if (existingProviderId !== undefined) {
      issues.push({
        code: "duplicate_place_provider",
        message: `${row.place_id} has multiple ${row.provider} mappings (${existingProviderId} and ${row.provider_place_id})`,
        severity: "error" as const,
      });
    } else {
      placeProviders.set(placeProvider, row.provider_place_id);
    }
  }

  if (issues.length > 0) {
    throw new ImportError("Provider mapping input is ambiguous", issues);
  }
}

async function loadKnownPlaceIds(
  client: ImportDatabaseClient,
  sourcePlaceIds: readonly string[],
  inputPlaces: readonly PlaceInput[],
): Promise<Set<string>> {
  const known = new Set(
    inputPlaces.map(({ internal_id: internalId }) => internalId),
  );
  if (sourcePlaceIds.length === 0) return known;

  const result = await client.query<{ internal_id: string }>(
    "SELECT internal_id FROM places WHERE internal_id = ANY($1::text[])",
    [sourcePlaceIds],
  );
  for (const row of result.rows) known.add(row.internal_id);
  return known;
}

async function loadExistingMappings(
  client: ImportDatabaseClient,
  rows: readonly PlaceSourceInput[],
): Promise<readonly ExistingPlaceSource[]> {
  if (rows.length === 0) return [];
  const providers = [...new Set(rows.map(({ provider }) => provider))];
  const providerPlaceIds = [
    ...new Set(
      rows.map(({ provider_place_id: providerPlaceId }) => providerPlaceId),
    ),
  ];
  const placeInternalIds = [
    ...new Set(rows.map(({ place_id: placeId }) => placeId)),
  ];
  const result = await client.query<{
    id: string;
    last_synced_at: Date;
    place_internal_id: string;
    provider: string;
    provider_place_id: string;
    source_url: string | null;
  }>(
    `SELECT source.id, place.internal_id AS place_internal_id,
            source.provider, source.provider_place_id, source.last_synced_at,
            source.source_url
       FROM place_sources AS source
       JOIN places AS place ON place.id = source.place_id
      WHERE (
        source.provider = ANY($1::text[])
        AND source.provider_place_id = ANY($2::text[])
      ) OR (
        place.internal_id = ANY($3::text[])
        AND source.provider = ANY($1::text[])
      )`,
    [providers, providerPlaceIds, placeInternalIds],
  );

  return result.rows.map((row) => ({
    id: row.id,
    lastSyncedAt: row.last_synced_at,
    placeInternalId: row.place_internal_id,
    provider: row.provider,
    providerPlaceId: row.provider_place_id,
    sourceUrl: row.source_url,
  }));
}

export async function planPlaceSources(
  client: ImportDatabaseClient,
  rows: readonly PlaceSourceInput[],
  inputPlaces: readonly PlaceInput[],
  draft: SummaryDraft,
): Promise<PlaceSourcePlan> {
  assertUniqueProviderMappings(rows);
  const knownPlaces = await loadKnownPlaceIds(
    client,
    rows.map(({ place_id: placeId }) => placeId),
    inputPlaces,
  );
  const mappedInputPlaces = new Set(
    rows.map(({ place_id: placeId }) => placeId),
  );

  for (const place of inputPlaces) {
    if (!mappedInputPlaces.has(place.internal_id)) {
      draft.entities.placeSources.conflicts += 1;
      draft.issues.push({
        code: "missing_provider_provenance",
        message: `POI ${place.internal_id} has no row in place-sources.csv`,
        severity: "error",
      });
    }
  }

  const existing = await loadExistingMappings(client, rows);
  const existingByExternal = new Map(
    existing.map((source) => [
      `${source.provider}\u0000${source.providerPlaceId}`,
      source,
    ]),
  );
  const existingByPlaceProvider = new Map(
    existing.map((source) => [
      `${source.placeInternalId}\u0000${source.provider}`,
      source,
    ]),
  );
  const create: PlannedPlaceSource[] = [];
  const update: PlannedPlaceSource[] = [];

  for (const row of rows) {
    if (!knownPlaces.has(row.place_id)) {
      draft.entities.placeSources.conflicts += 1;
      draft.issues.push({
        code: "missing_place",
        message: `Provider mapping ${row.provider}:${row.provider_place_id} references unknown place ${row.place_id}`,
        severity: "error",
      });
      continue;
    }

    const byExternal = existingByExternal.get(externalKey(row));
    const byPlaceProvider = existingByPlaceProvider.get(placeProviderKey(row));

    if (byExternal && byExternal.placeInternalId !== row.place_id) {
      draft.entities.placeSources.conflicts += 1;
      draft.issues.push({
        code: "provider_id_ownership_conflict",
        message: `${row.provider}:${row.provider_place_id} already belongs to ${byExternal.placeInternalId}, not ${row.place_id}`,
        severity: "error",
      });
      continue;
    }

    if (
      byPlaceProvider &&
      byPlaceProvider.providerPlaceId !== row.provider_place_id
    ) {
      draft.entities.placeSources.conflicts += 1;
      draft.issues.push({
        code: "provider_id_remap_conflict",
        message: `${row.place_id} already maps to ${row.provider}:${byPlaceProvider.providerPlaceId}; refusing silent remap to ${row.provider_place_id}`,
        severity: "error",
      });
      continue;
    }

    const stored = byExternal ?? byPlaceProvider;
    if (!stored) {
      create.push({ input: row });
      continue;
    }

    if (row.last_synced_at < stored.lastSyncedAt) {
      draft.entities.placeSources.unchanged += 1;
      draft.issues.push({
        code: "stale_provider_snapshot",
        message: `${row.provider}:${row.provider_place_id} is older than the stored sync timestamp`,
        severity: "warning",
      });
      continue;
    }

    if (
      row.last_synced_at.getTime() === stored.lastSyncedAt.getTime() &&
      (row.source_url ?? null) === stored.sourceUrl
    ) {
      draft.entities.placeSources.unchanged += 1;
      continue;
    }

    update.push({ existingId: stored.id, input: row });
  }

  draft.entities.placeSources.created += create.length;
  draft.entities.placeSources.updated += update.length;
  return { create, update };
}

export async function insertPlannedPlaceSources(
  client: ImportDatabaseClient,
  plan: PlaceSourcePlan,
  placePlan: PlacePlan,
): Promise<void> {
  const internalIds = [
    ...new Set(
      [...plan.create, ...plan.update].map(({ input }) => input.place_id),
    ),
  ];
  const placeIds = new Map(placePlan.existingIds);
  if (internalIds.length > 0) {
    const result = await client.query<{ id: string; internal_id: string }>(
      "SELECT id, internal_id FROM places WHERE internal_id = ANY($1::text[])",
      [internalIds],
    );
    for (const row of result.rows) placeIds.set(row.internal_id, row.id);
  }

  for (const source of plan.create) {
    const placeId = placeIds.get(source.input.place_id);
    if (!placeId)
      throw new Error(`Missing database place ${source.input.place_id}`);
    await client.query(
      `INSERT INTO place_sources
        (place_id, provider, provider_place_id, last_synced_at, source_url)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        placeId,
        source.input.provider,
        source.input.provider_place_id,
        source.input.last_synced_at,
        source.input.source_url ?? null,
      ],
    );
  }

  for (const source of plan.update) {
    await client.query(
      `UPDATE place_sources
          SET last_synced_at = $2, source_url = $3, updated_at = now()
        WHERE id = $1`,
      [
        source.existingId,
        source.input.last_synced_at,
        source.input.source_url ?? null,
      ],
    );
  }
}
