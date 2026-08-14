import type { ImportDatabaseClient } from "./database";
import type { SummaryDraft } from "./summary";
import type {
  PlaceAreaInput,
  PlaceInput,
  PlaceMediaInput,
  VibeReportInput,
} from "./validation";

type PlannedArea = Readonly<{ input: PlaceAreaInput }>;
type PlannedMedia = Readonly<{ input: PlaceMediaInput }>;
type PlannedReport = Readonly<{ input: VibeReportInput }>;

export type SeedPlan = Readonly<{
  areas: readonly PlannedArea[];
  media: readonly PlannedMedia[];
  reports: readonly PlannedReport[];
}>;

function datesAreEqual(left: Date | null, right?: Date): boolean {
  if (left === null || right === undefined) return left === null && !right;
  return left.getTime() === right.getTime();
}

async function loadKnownPlaceStatuses(
  client: ImportDatabaseClient,
  internalIds: readonly string[],
): Promise<Map<string, string>> {
  if (internalIds.length === 0) return new Map();
  const result = await client.query<{ internal_id: string; status: string }>(
    "SELECT internal_id, status FROM places WHERE internal_id = ANY($1::text[])",
    [internalIds],
  );
  return new Map(
    result.rows.map(({ internal_id: internalId, status }) => [
      internalId,
      status,
    ]),
  );
}

async function planAreas(
  client: ImportDatabaseClient,
  rows: readonly PlaceAreaInput[],
  knownPlaces: ReadonlyMap<string, string>,
  draft: SummaryDraft,
): Promise<readonly PlannedArea[]> {
  if (rows.length === 0) return [];
  const existing = await client.query<{
    description: string | null;
    internal_id: string;
    is_simulated: boolean;
    name: string;
    place_internal_id: string;
  }>(
    `SELECT area.internal_id, place.internal_id AS place_internal_id,
            area.name, area.description, area.is_simulated
       FROM place_areas AS area
       JOIN places AS place ON place.id = area.place_id
      WHERE area.internal_id = ANY($1::text[])`,
    [rows.map(({ area_id: areaId }) => areaId)],
  );
  const existingById = new Map(
    existing.rows.map((row) => [row.internal_id, row]),
  );
  const create: PlannedArea[] = [];
  const inputNames = new Map<string, string>();

  for (const row of rows) {
    const nameKey = `${row.place_id}\u0000${row.name.trim().toLocaleLowerCase("vi")}`;
    const inputNameOwner = inputNames.get(nameKey);
    if (inputNameOwner && inputNameOwner !== row.area_id) {
      draft.entities.placeAreas.conflicts += 1;
      draft.issues.push({
        code: "duplicate_place_area_name",
        message: `Place areas ${inputNameOwner} and ${row.area_id} use the same name in ${row.place_id}`,
        severity: "error",
      });
      continue;
    }
    inputNames.set(nameKey, row.area_id);

    if (!knownPlaces.has(row.place_id)) {
      draft.entities.placeAreas.conflicts += 1;
      draft.issues.push({
        code: "missing_place",
        message: `Place area ${row.area_id} references unknown place ${row.place_id}`,
        severity: "error",
      });
      continue;
    }

    const stored = existingById.get(row.area_id);
    if (!stored) {
      const nameOwner = await client.query<{ internal_id: string }>(
        `SELECT area.internal_id
           FROM place_areas AS area
           JOIN places AS place ON place.id = area.place_id
          WHERE place.internal_id = $1 AND lower(area.name) = lower($2)
          LIMIT 1`,
        [row.place_id, row.name],
      );
      if (nameOwner.rowCount) {
        draft.entities.placeAreas.conflicts += 1;
        draft.issues.push({
          code: "duplicate_place_area_name",
          message: `Place area name '${row.name}' in ${row.place_id} belongs to ${nameOwner.rows[0].internal_id}`,
          severity: "error",
        });
        continue;
      }
      create.push({ input: row });
      continue;
    }

    if (
      stored.place_internal_id === row.place_id &&
      stored.name === row.name &&
      stored.description === (row.description ?? null) &&
      stored.is_simulated === row.is_simulated
    ) {
      draft.entities.placeAreas.unchanged += 1;
    } else {
      draft.entities.placeAreas.conflicts += 1;
      draft.issues.push({
        code: "immutable_id_conflict",
        message: `Place area ${row.area_id} already exists with different content`,
        severity: "error",
      });
    }
  }

  draft.entities.placeAreas.created += create.length;
  return create;
}

async function loadKnownAreas(
  client: ImportDatabaseClient,
  inputAreas: readonly PlaceAreaInput[],
): Promise<Map<string, string>> {
  const known = new Map(
    inputAreas.map(({ area_id: areaId, place_id: placeId }) => [
      areaId,
      placeId,
    ]),
  );
  const result = await client.query<{
    area_id: string;
    place_id: string;
  }>(
    `SELECT area.internal_id AS area_id, place.internal_id AS place_id
       FROM place_areas AS area
       JOIN places AS place ON place.id = area.place_id`,
  );

  for (const row of result.rows) known.set(row.area_id, row.place_id);
  return known;
}

function mediaIsUnchanged(
  stored: {
    alt_text: string;
    captured_at: Date | null;
    height: number;
    is_simulated: boolean;
    media_type: string;
    moderation_status: string;
    place_area_internal_id: string | null;
    place_internal_id: string;
    rights_status: string;
    sort_order: number;
    source_reference: string | null;
    source_type: string;
    source_url: string | null;
    storage_key: string | null;
    thumbnail_key: string | null;
    uploaded_by: string | null;
    width: number;
  },
  row: PlaceMediaInput,
): boolean {
  return (
    stored.place_internal_id === row.place_id &&
    stored.place_area_internal_id === (row.place_area_id ?? null) &&
    stored.media_type === row.media_type &&
    stored.storage_key === (row.storage_key ?? null) &&
    stored.source_url === (row.source_url ?? null) &&
    stored.thumbnail_key === (row.thumbnail_key ?? null) &&
    stored.width === row.width &&
    stored.height === row.height &&
    stored.source_type === row.source_type &&
    stored.source_reference === (row.source_reference ?? null) &&
    stored.rights_status === row.rights_status &&
    datesAreEqual(stored.captured_at, row.captured_at) &&
    stored.uploaded_by === (row.uploaded_by ?? null) &&
    stored.alt_text === row.alt_text &&
    stored.sort_order === row.sort_order &&
    stored.moderation_status === row.moderation_status &&
    stored.is_simulated === row.is_simulated
  );
}

async function planMedia(
  client: ImportDatabaseClient,
  rows: readonly PlaceMediaInput[],
  knownPlaces: ReadonlyMap<string, string>,
  knownAreas: ReadonlyMap<string, string>,
  draft: SummaryDraft,
): Promise<readonly PlannedMedia[]> {
  if (rows.length === 0) return [];
  const existing = await client.query<{
    alt_text: string;
    captured_at: Date | null;
    height: number;
    internal_id: string;
    is_simulated: boolean;
    media_type: string;
    moderation_status: string;
    place_area_internal_id: string | null;
    place_internal_id: string;
    rights_status: string;
    sort_order: number;
    source_reference: string | null;
    source_type: string;
    source_url: string | null;
    storage_key: string | null;
    thumbnail_key: string | null;
    uploaded_by: string | null;
    width: number;
  }>(
    `SELECT media.internal_id, place.internal_id AS place_internal_id,
            area.internal_id AS place_area_internal_id, media.media_type,
            media.storage_key, media.source_url, media.thumbnail_key,
            media.width, media.height, media.source_type,
            media.source_reference, media.rights_status, media.captured_at,
            media.uploaded_by, media.alt_text, media.sort_order,
            media.moderation_status, media.is_simulated
       FROM place_media AS media
       JOIN places AS place ON place.id = media.place_id
       LEFT JOIN place_areas AS area ON area.id = media.place_area_id
      WHERE media.internal_id = ANY($1::text[])`,
    [rows.map(({ media_id: mediaId }) => mediaId)],
  );
  const existingById = new Map(
    existing.rows.map((row) => [row.internal_id, row]),
  );
  const inputSlots = new Map<string, string>();
  const create: PlannedMedia[] = [];

  for (const row of rows) {
    const slotKey = `${row.place_id}\u0000${row.sort_order}`;
    const slotOwner = inputSlots.get(slotKey);
    if (slotOwner && slotOwner !== row.media_id) {
      draft.entities.placeMedia.conflicts += 1;
      draft.issues.push({
        code: "duplicate_place_media_sort_order",
        message: `Media ${slotOwner} and ${row.media_id} use sort_order=${row.sort_order} in ${row.place_id}`,
        severity: "error",
      });
      continue;
    }
    inputSlots.set(slotKey, row.media_id);

    if (!knownPlaces.has(row.place_id)) {
      draft.entities.placeMedia.conflicts += 1;
      draft.issues.push({
        code: "missing_place",
        message: `Media ${row.media_id} references unknown place ${row.place_id}`,
        severity: "error",
      });
      continue;
    }
    if (
      row.place_area_id &&
      knownAreas.get(row.place_area_id) !== row.place_id
    ) {
      draft.entities.placeMedia.conflicts += 1;
      draft.issues.push({
        code: "invalid_place_area",
        message: `Media ${row.media_id} references an unknown area or an area from another place`,
        severity: "error",
      });
      continue;
    }

    const stored = existingById.get(row.media_id);
    if (stored) {
      if (mediaIsUnchanged(stored, row)) {
        draft.entities.placeMedia.unchanged += 1;
      } else {
        draft.entities.placeMedia.conflicts += 1;
        draft.issues.push({
          code: "immutable_id_conflict",
          message: `Media ${row.media_id} already exists with different content`,
          severity: "error",
        });
      }
      continue;
    }

    const persistedSlot = await client.query<{ internal_id: string }>(
      `SELECT media.internal_id
         FROM place_media AS media
         JOIN places AS place ON place.id = media.place_id
        WHERE place.internal_id = $1 AND media.sort_order = $2
        LIMIT 1`,
      [row.place_id, row.sort_order],
    );
    if (persistedSlot.rowCount) {
      draft.entities.placeMedia.conflicts += 1;
      draft.issues.push({
        code: "duplicate_place_media_sort_order",
        message: `Media slot ${row.place_id}:${row.sort_order} belongs to ${persistedSlot.rows[0].internal_id}`,
        severity: "error",
      });
      continue;
    }

    create.push({ input: row });
  }

  draft.entities.placeMedia.created += create.length;
  return create;
}

function reportIsUnchanged(
  stored: {
    consent_recorded: boolean | null;
    crowd: number | null;
    data_type: string;
    day_type: string | null;
    is_simulated: boolean;
    lighting: number | null;
    location_verification: string;
    moderation_status: string;
    noise: number | null;
    participant_id: string | null;
    place_area_internal_id: string | null;
    place_internal_id: string;
    privacy: number | null;
    seat_availability: string;
    short_note: string | null;
    social_energy: number | null;
    source_note: string | null;
    time_bucket: string | null;
    user_id: string | null;
    verified_at: Date | null;
    verified_by: string | null;
    visit_mode: string;
    visited_at: Date;
    workability: number | null;
  },
  row: VibeReportInput,
): boolean {
  return (
    stored.place_internal_id === row.place_id &&
    stored.place_area_internal_id === (row.place_area_id ?? null) &&
    stored.visited_at.getTime() === row.visited_at.getTime() &&
    stored.visit_mode === row.visit_mode &&
    stored.noise === (row.noise ?? null) &&
    stored.crowd === (row.crowd ?? null) &&
    stored.lighting === (row.lighting ?? null) &&
    stored.privacy === (row.privacy ?? null) &&
    stored.workability === (row.workability ?? null) &&
    stored.social_energy === (row.social_energy ?? null) &&
    stored.seat_availability === row.seat_availability &&
    stored.location_verification === row.location_verification &&
    stored.data_type === row.data_type &&
    stored.is_simulated === row.is_simulated &&
    stored.moderation_status === row.moderation_status &&
    stored.day_type === (row.day_type ?? null) &&
    stored.time_bucket === (row.time_bucket ?? null) &&
    stored.consent_recorded === (row.consent_recorded ?? null) &&
    stored.user_id === (row.user_id ?? null) &&
    stored.participant_id === (row.participant_id ?? null) &&
    stored.verified_by === (row.verified_by ?? null) &&
    stored.short_note === (row.short_note ?? null) &&
    stored.source_note === (row.source_note ?? null) &&
    datesAreEqual(stored.verified_at, row.verified_at)
  );
}

async function planReports(
  client: ImportDatabaseClient,
  rows: readonly VibeReportInput[],
  knownPlaces: ReadonlyMap<string, string>,
  knownAreas: ReadonlyMap<string, string>,
  draft: SummaryDraft,
): Promise<readonly PlannedReport[]> {
  if (rows.length === 0) return [];
  const existing = await client.query<{
    consent_recorded: boolean | null;
    crowd: number | null;
    data_type: string;
    day_type: string | null;
    internal_id: string;
    is_simulated: boolean;
    lighting: number | null;
    location_verification: string;
    moderation_status: string;
    noise: number | null;
    participant_id: string | null;
    place_area_internal_id: string | null;
    place_internal_id: string;
    privacy: number | null;
    seat_availability: string;
    short_note: string | null;
    social_energy: number | null;
    source_note: string | null;
    time_bucket: string | null;
    user_id: string | null;
    verified_at: Date | null;
    verified_by: string | null;
    visit_mode: string;
    visited_at: Date;
    workability: number | null;
  }>(
    `SELECT report.internal_id, place.internal_id AS place_internal_id,
            area.internal_id AS place_area_internal_id, report.visited_at,
            report.visit_mode, report.noise, report.crowd, report.lighting,
            report.privacy, report.workability, report.social_energy,
            report.seat_availability, report.location_verification,
            report.data_type, report.is_simulated, report.moderation_status,
            report.day_type, report.time_bucket, report.consent_recorded,
            report.user_id, report.participant_id, report.verified_by,
            report.short_note, report.source_note, report.verified_at
       FROM vibe_reports AS report
       JOIN places AS place ON place.id = report.place_id
       LEFT JOIN place_areas AS area ON area.id = report.place_area_id
      WHERE report.internal_id = ANY($1::text[])`,
    [rows.map(({ report_id: reportId }) => reportId)],
  );
  const existingById = new Map(
    existing.rows.map((row) => [row.internal_id, row]),
  );
  const create: PlannedReport[] = [];

  for (const row of rows) {
    const placeStatus = knownPlaces.get(row.place_id);
    if (!placeStatus) {
      draft.entities.vibeReports.conflicts += 1;
      draft.issues.push({
        code: "missing_place",
        message: `Report ${row.report_id} references unknown place ${row.place_id}`,
        severity: "error",
      });
      continue;
    }
    if (placeStatus === "archived" && !row.is_simulated) {
      draft.entities.vibeReports.conflicts += 1;
      draft.issues.push({
        code: "archived_place",
        message: `Report ${row.report_id} cannot target archived place ${row.place_id}`,
        severity: "error",
      });
      continue;
    }
    if (
      row.place_area_id &&
      knownAreas.get(row.place_area_id) !== row.place_id
    ) {
      draft.entities.vibeReports.conflicts += 1;
      draft.issues.push({
        code: "invalid_place_area",
        message: `Report ${row.report_id} references an unknown area or an area from another place`,
        severity: "error",
      });
      continue;
    }

    const stored = existingById.get(row.report_id);
    if (!stored) {
      create.push({ input: row });
    } else if (reportIsUnchanged(stored, row)) {
      draft.entities.vibeReports.unchanged += 1;
    } else {
      draft.entities.vibeReports.conflicts += 1;
      draft.issues.push({
        code: "immutable_id_conflict",
        message: `Report ${row.report_id} already exists with different content`,
        severity: "error",
      });
    }
  }

  draft.entities.vibeReports.created += create.length;
  return create;
}

export async function planSeedRecords(
  client: ImportDatabaseClient,
  input: Readonly<{
    areas: readonly PlaceAreaInput[];
    media: readonly PlaceMediaInput[];
    places: readonly PlaceInput[];
    reports: readonly VibeReportInput[];
  }>,
  draft: SummaryDraft,
): Promise<SeedPlan> {
  const referencedPlaceIds = [
    ...input.areas.map(({ place_id: placeId }) => placeId),
    ...input.media.map(({ place_id: placeId }) => placeId),
    ...input.reports.map(({ place_id: placeId }) => placeId),
  ];
  const knownPlaces = await loadKnownPlaceStatuses(client, referencedPlaceIds);
  for (const place of input.places) {
    knownPlaces.set(place.internal_id, place.status);
  }

  const areas = await planAreas(client, input.areas, knownPlaces, draft);
  const knownAreas = await loadKnownAreas(client, input.areas);
  const media = await planMedia(
    client,
    input.media,
    knownPlaces,
    knownAreas,
    draft,
  );
  const reports = await planReports(
    client,
    input.reports,
    knownPlaces,
    knownAreas,
    draft,
  );

  for (const report of input.reports) {
    draft.dataTypes[report.data_type] =
      (draft.dataTypes[report.data_type] ?? 0) + 1;
  }

  return { areas, media, reports };
}

export async function insertSeedRecords(
  client: ImportDatabaseClient,
  plan: SeedPlan,
  placeIds: ReadonlyMap<string, string>,
): Promise<void> {
  const resolvedPlaceIds = new Map(placeIds);
  const requiredPlaceIds = [
    ...plan.areas.map(({ input }) => input.place_id),
    ...plan.media.map(({ input }) => input.place_id),
    ...plan.reports.map(({ input }) => input.place_id),
  ];
  if (requiredPlaceIds.length > 0) {
    const storedPlaces = await client.query<{
      id: string;
      internal_id: string;
    }>(
      "SELECT id, internal_id FROM places WHERE internal_id = ANY($1::text[])",
      [requiredPlaceIds],
    );
    for (const row of storedPlaces.rows) {
      resolvedPlaceIds.set(row.internal_id, row.id);
    }
  }
  const areaIds = new Map<string, string>();
  const existingAreas = await client.query<{
    id: string;
    internal_id: string;
  }>("SELECT id, internal_id FROM place_areas");
  for (const row of existingAreas.rows) areaIds.set(row.internal_id, row.id);

  for (const area of plan.areas) {
    const placeId = resolvedPlaceIds.get(area.input.place_id);
    if (!placeId)
      throw new Error(`Missing database place ${area.input.place_id}`);
    const result = await client.query<{ id: string }>(
      `INSERT INTO place_areas
        (internal_id, place_id, name, description, is_simulated)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        area.input.area_id,
        placeId,
        area.input.name,
        area.input.description ?? null,
        area.input.is_simulated,
      ],
    );
    areaIds.set(area.input.area_id, result.rows[0].id);
  }

  for (const media of plan.media) {
    const row = media.input;
    const placeId = resolvedPlaceIds.get(row.place_id);
    if (!placeId) throw new Error(`Missing database place ${row.place_id}`);
    const placeAreaId = row.place_area_id
      ? areaIds.get(row.place_area_id)
      : undefined;

    await client.query(
      `INSERT INTO place_media
        (internal_id, place_id, place_area_id, media_type, storage_key,
         source_url, thumbnail_key, width, height, source_type,
         source_reference, rights_status, captured_at, uploaded_by, alt_text,
         sort_order, moderation_status, is_simulated)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
         $15, $16, $17, $18)`,
      [
        row.media_id,
        placeId,
        placeAreaId ?? null,
        row.media_type,
        row.storage_key ?? null,
        row.source_url ?? null,
        row.thumbnail_key ?? null,
        row.width,
        row.height,
        row.source_type,
        row.source_reference ?? null,
        row.rights_status,
        row.captured_at ?? null,
        row.uploaded_by ?? null,
        row.alt_text,
        row.sort_order,
        row.moderation_status,
        row.is_simulated,
      ],
    );
  }

  for (const report of plan.reports) {
    const row = report.input;
    const placeId = resolvedPlaceIds.get(row.place_id);
    if (!placeId) throw new Error(`Missing database place ${row.place_id}`);
    const placeAreaId = row.place_area_id
      ? areaIds.get(row.place_area_id)
      : undefined;

    await client.query(
      `INSERT INTO vibe_reports
        (internal_id, place_id, place_area_id, user_id, participant_id,
         verified_by, visited_at, noise, crowd, lighting, privacy, workability,
         social_energy, visit_mode, seat_availability, location_verification,
         data_type, is_simulated, moderation_status, day_type, time_bucket,
         consent_recorded, short_note, source_note, verified_at)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
         $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
      [
        row.report_id,
        placeId,
        placeAreaId ?? null,
        row.user_id ?? null,
        row.participant_id ?? null,
        row.verified_by ?? null,
        row.visited_at,
        row.noise ?? null,
        row.crowd ?? null,
        row.lighting ?? null,
        row.privacy ?? null,
        row.workability ?? null,
        row.social_energy ?? null,
        row.visit_mode,
        row.seat_availability,
        row.location_verification,
        row.data_type,
        row.is_simulated,
        row.moderation_status,
        row.day_type ?? null,
        row.time_bucket ?? null,
        row.consent_recorded ?? null,
        row.short_note ?? null,
        row.source_note ?? null,
        row.verified_at ?? null,
      ],
    );
  }
}
