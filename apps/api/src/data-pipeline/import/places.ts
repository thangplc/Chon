import {
  openingHoursAreEqual,
  type PlaceOpeningHours,
} from "../../../../../packages/domain/src/place-detail/place-detail";

import type { ImportDatabaseClient } from "./database";
import type { SummaryDraft } from "./summary";
import type { ImportIssue } from "./types";
import type { PlaceInput, PlaceMutableField } from "./validation";

type ExistingPlace = Readonly<{
  address: string;
  currency: string;
  district: string;
  estimatedCapacity: number | null;
  id: string;
  internalId: string;
  isSimulated: boolean;
  latitude: number;
  longitude: number;
  name: string;
  openingHours: PlaceOpeningHours | null;
  priceLevel: number | null;
  sizeCategory: string;
  slug: string;
  status: string;
  typicalSpendMax: number | null;
  typicalSpendMin: number | null;
}>;

export type PlannedPlace = Readonly<{
  input: PlaceInput;
  serviceAreas: readonly Readonly<{
    boundaryVersion: number;
    serviceAreaId: string;
  }>[];
  slug: string;
}>;

export type PlacePlan = Readonly<{
  create: readonly PlannedPlace[];
  existingIds: ReadonlyMap<string, string>;
  update: readonly Readonly<{ id: string; input: PlaceInput }>[];
}>;

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "D")
    .toLocaleLowerCase("vi")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function slugifyPlaceName(name: string, fallback: string): string {
  const slug = normalizeName(name).replaceAll(" ", "-");
  return slug || fallback.replaceAll("_", "-");
}

function coordinatesAreEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 1e-9;
}

function editDistance(left: string, right: string): number {
  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function namesAreSimilar(left: string, right: string): boolean {
  const normalizedLeft = normalizeName(left);
  const normalizedRight = normalizeName(right);
  const maximumLength = Math.max(normalizedLeft.length, normalizedRight.length);
  if (maximumLength === 0) return true;
  return (
    1 - editDistance(normalizedLeft, normalizedRight) / maximumLength >= 0.8
  );
}

function immutablePlaceFieldsMatch(
  existing: ExistingPlace,
  input: PlaceInput,
  slug: string,
): boolean {
  return (
    existing.name === input.name &&
    existing.slug === slug &&
    existing.address === input.address &&
    existing.district === input.district &&
    coordinatesAreEqual(existing.latitude, input.latitude) &&
    coordinatesAreEqual(existing.longitude, input.longitude) &&
    existing.status === input.status &&
    existing.isSimulated === input.is_simulated
  );
}

function mutablePlaceFieldsMatch(
  existing: ExistingPlace,
  input: PlaceInput,
): boolean {
  const matches = (field: PlaceMutableField, valueMatches: boolean) =>
    !input.providedMutableFields.includes(field) || valueMatches;

  return (
    matches("size_category", existing.sizeCategory === input.size_category) &&
    matches(
      "estimated_capacity",
      existing.estimatedCapacity === (input.estimated_capacity ?? null),
    ) &&
    matches(
      "price_level",
      existing.priceLevel === (input.price_level ?? null),
    ) &&
    matches(
      "typical_spend_min",
      existing.typicalSpendMin === (input.typical_spend_min ?? null),
    ) &&
    matches(
      "typical_spend_max",
      existing.typicalSpendMax === (input.typical_spend_max ?? null),
    ) &&
    matches("currency", existing.currency === input.currency) &&
    matches(
      "opening_hours",
      openingHoursAreEqual(existing.openingHours, input.opening_hours ?? null),
    )
  );
}

function haversineDistanceMeters(left: PlaceInput, right: PlaceInput): number {
  const earthRadius = 6_371_000;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const leftLatitude = radians(left.latitude);
  const rightLatitude = radians(right.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) *
      Math.cos(rightLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function loadExistingPlaces(
  client: ImportDatabaseClient,
  internalIds: readonly string[],
): Promise<Map<string, ExistingPlace>> {
  if (internalIds.length === 0) return new Map();

  const result = await client.query<{
    address: string;
    currency: string;
    district: string;
    estimated_capacity: number | null;
    id: string;
    internal_id: string;
    is_simulated: boolean;
    latitude: number;
    longitude: number;
    name: string;
    opening_hours: PlaceOpeningHours | null;
    price_level: number | null;
    size_category: string;
    slug: string;
    status: string;
    typical_spend_max: number | null;
    typical_spend_min: number | null;
  }>(
    `SELECT id, internal_id, name, slug, address, district, status,
            is_simulated, size_category, estimated_capacity, price_level,
            typical_spend_min, typical_spend_max, currency, opening_hours,
            ST_Y(location) AS latitude, ST_X(location) AS longitude
       FROM places
      WHERE internal_id = ANY($1::text[])`,
    [internalIds],
  );

  return new Map(
    result.rows.map((row) => [
      row.internal_id,
      {
        address: row.address,
        currency: row.currency,
        district: row.district,
        estimatedCapacity: row.estimated_capacity,
        id: row.id,
        internalId: row.internal_id,
        isSimulated: row.is_simulated,
        latitude: row.latitude,
        longitude: row.longitude,
        name: row.name,
        openingHours: row.opening_hours,
        priceLevel: row.price_level,
        sizeCategory: row.size_category,
        slug: row.slug,
        status: row.status,
        typicalSpendMax: row.typical_spend_max,
        typicalSpendMin: row.typical_spend_min,
      },
    ]),
  );
}

async function loadServiceAreasForPoint(
  client: ImportDatabaseClient,
  input: PlaceInput,
): Promise<PlannedPlace["serviceAreas"]> {
  const result = await client.query<{
    boundary_version: number;
    service_area_id: string;
  }>(
    `SELECT boundary.service_area_id, boundary.version AS boundary_version
       FROM service_area_boundaries AS boundary
       JOIN service_areas AS area ON area.id = boundary.service_area_id
      WHERE boundary.is_current = true
        AND area.status = 'active'
        AND ST_Covers(
          boundary.boundary,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)
        )
      ORDER BY area.priority DESC, area.code`,
    [input.longitude, input.latitude],
  );

  return result.rows.map((row) => ({
    boundaryVersion: row.boundary_version,
    serviceAreaId: row.service_area_id,
  }));
}

async function findNearbySameName(
  client: ImportDatabaseClient,
  input: PlaceInput,
): Promise<readonly string[]> {
  const result = await client.query<{
    internal_id: string;
    name: string;
    same_location: boolean;
  }>(
    `SELECT internal_id, name,
            ST_Equals(location, ST_SetSRID(ST_MakePoint($2, $3), 4326)) AS same_location
       FROM places
      WHERE internal_id <> $1
        AND ST_DWithin(
          location::geography,
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
          30
        )`,
    [input.internal_id, input.longitude, input.latitude],
  );
  return result.rows
    .filter(
      ({ name, same_location: sameLocation }) =>
        sameLocation || namesAreSimilar(name, input.name),
    )
    .map(({ internal_id: internalId }) => internalId);
}

export async function planPlaces(
  client: ImportDatabaseClient,
  rows: readonly PlaceInput[],
  draft: SummaryDraft,
): Promise<PlacePlan> {
  const existing = await loadExistingPlaces(
    client,
    rows.map(({ internal_id: internalId }) => internalId),
  );
  const existingIds = new Map(
    [...existing].map(([internalId, place]) => [internalId, place.id]),
  );
  const create: PlannedPlace[] = [];
  const update: { id: string; input: PlaceInput }[] = [];
  const conflictingIds = new Set<string>();
  const slugOwners = new Map<string, string>();

  for (const row of rows) {
    const slug = slugifyPlaceName(row.name, row.internal_id);
    const existingSlugOwner = slugOwners.get(slug);

    if (existingSlugOwner && existingSlugOwner !== row.internal_id) {
      conflictingIds.add(existingSlugOwner);
      conflictingIds.add(row.internal_id);
      draft.issues.push({
        code: "duplicate_slug",
        message: `Places ${existingSlugOwner} and ${row.internal_id} generate the same slug '${slug}'`,
        severity: "error",
      });
      continue;
    }
    slugOwners.set(slug, row.internal_id);

    const stored = existing.get(row.internal_id);
    if (stored) {
      if (!immutablePlaceFieldsMatch(stored, row, slug)) {
        conflictingIds.add(row.internal_id);
        draft.issues.push({
          code: "immutable_id_conflict",
          message: `Place ${row.internal_id} already exists with different identity content`,
          severity: "error",
        });
      } else if (mutablePlaceFieldsMatch(stored, row)) {
        draft.entities.places.unchanged += 1;
      } else {
        update.push({ id: stored.id, input: row });
        draft.entities.places.updated += 1;
      }
      continue;
    }

    const slugResult = await client.query<{ internal_id: string }>(
      "SELECT internal_id FROM places WHERE slug = $1 LIMIT 1",
      [slug],
    );
    if (slugResult.rowCount) {
      conflictingIds.add(row.internal_id);
      draft.issues.push({
        code: "slug_conflict",
        message: `Slug '${slug}' belongs to ${slugResult.rows[0].internal_id}`,
        severity: "error",
      });
      continue;
    }

    const nearby = await findNearbySameName(client, row);
    if (nearby.length > 0) {
      conflictingIds.add(row.internal_id);
      draft.issues.push({
        code: "possible_duplicate_place",
        message: `Place ${row.internal_id} has the same normalized name within 30m of ${nearby.join(", ")}`,
        severity: "error",
      });
      continue;
    }

    const serviceAreas = await loadServiceAreasForPoint(client, row);
    if (serviceAreas.length === 0) {
      draft.issues.push({
        code: "outside_active_service_area",
        message: `Place ${row.internal_id} is not covered by an active current boundary`,
        severity: "warning",
      });
    }
    create.push({ input: row, serviceAreas, slug });
  }

  for (let leftIndex = 0; leftIndex < create.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < create.length;
      rightIndex += 1
    ) {
      const left = create[leftIndex].input;
      const right = create[rightIndex].input;
      if (
        haversineDistanceMeters(left, right) <= 30 &&
        (namesAreSimilar(left.name, right.name) ||
          (coordinatesAreEqual(left.latitude, right.latitude) &&
            coordinatesAreEqual(left.longitude, right.longitude)))
      ) {
        conflictingIds.add(left.internal_id);
        conflictingIds.add(right.internal_id);
        draft.issues.push({
          code: "possible_duplicate_place",
          message: `Places ${left.internal_id} and ${right.internal_id} have the same normalized name within 30m`,
          severity: "error",
        });
      }
    }
  }

  draft.entities.places.conflicts += conflictingIds.size;
  const safeCreate = create.filter(
    ({ input }) => !conflictingIds.has(input.internal_id),
  );
  draft.entities.places.created += safeCreate.length;
  draft.entities.placeServiceAreas.created += safeCreate.reduce(
    (total, place) => total + place.serviceAreas.length,
    0,
  );

  return { create: safeCreate, existingIds, update };
}

export async function insertPlannedPlaces(
  client: ImportDatabaseClient,
  plan: PlacePlan,
): Promise<Map<string, string>> {
  const placeIds = new Map(plan.existingIds);

  for (const place of plan.update) {
    const input = place.input;
    const updateFields: string[] = [];
    const values: unknown[] = [place.id];
    const setField = (
      column: string,
      field: PlaceMutableField,
      value: unknown,
    ) => {
      if (!input.providedMutableFields.includes(field)) return;
      updateFields.push(`${column} = $${values.length + 1}`);
      values.push(value);
    };

    setField("price_level", "price_level", input.price_level ?? null);
    setField(
      "typical_spend_min",
      "typical_spend_min",
      input.typical_spend_min ?? null,
    );
    setField(
      "typical_spend_max",
      "typical_spend_max",
      input.typical_spend_max ?? null,
    );
    setField("currency", "currency", input.currency);
    setField("size_category", "size_category", input.size_category);
    setField(
      "estimated_capacity",
      "estimated_capacity",
      input.estimated_capacity ?? null,
    );
    setField("opening_hours", "opening_hours", input.opening_hours ?? null);

    if (updateFields.length === 0) continue;
    updateFields.push("updated_at = now()");
    await client.query(
      `UPDATE places SET ${updateFields.join(", ")} WHERE id = $1`,
      values,
    );
  }

  for (const place of plan.create) {
    const input = place.input;
    const result = await client.query<{ id: string }>(
      `INSERT INTO places
        (internal_id, name, slug, location, address, district, price_level,
         typical_spend_min, typical_spend_max, currency, size_category,
         estimated_capacity, opening_hours, status, is_simulated)
       VALUES
        ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, $7, $8,
         $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING id`,
      [
        input.internal_id,
        input.name,
        place.slug,
        input.longitude,
        input.latitude,
        input.address,
        input.district,
        input.price_level ?? null,
        input.typical_spend_min ?? null,
        input.typical_spend_max ?? null,
        input.currency,
        input.size_category,
        input.estimated_capacity ?? null,
        input.opening_hours ?? null,
        input.status,
        input.is_simulated,
      ],
    );
    const placeId = result.rows[0].id;
    placeIds.set(input.internal_id, placeId);

    for (const [index, membership] of place.serviceAreas.entries()) {
      await client.query(
        `INSERT INTO place_service_areas
          (place_id, service_area_id, is_primary, boundary_version)
         VALUES ($1, $2, $3, $4)`,
        [
          placeId,
          membership.serviceAreaId,
          index === 0,
          membership.boundaryVersion,
        ],
      );
    }
  }

  return placeIds;
}

export function hasFatalIssues(issues: readonly ImportIssue[]): boolean {
  return issues.some(({ severity }) => severity === "error");
}
