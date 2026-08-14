import { access, mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

import {
  createNominatimBoundaryLookupUrl,
  serviceAreaBoundaries,
  serviceAreaBoundarySimplifyToleranceDegrees,
  type ServiceAreaBoundaryDefinition,
} from "../src/config/service-area-boundaries";
import { sha256 } from "../src/data-import/csv";
import {
  getBoundarySourceManifestPath,
  getBoundarySourceObjectPath,
  readVerifiedBoundarySourceObject,
  type BoundarySourceManifest,
} from "../src/service-areas/source-object";

type JsonObject = Record<string, unknown>;

type BoundaryFeature = Readonly<{
  bbox?: unknown;
  geometry: Readonly<{
    coordinates: unknown;
    type: "MultiPolygon" | "Polygon";
  }>;
  properties: JsonObject;
  type: "Feature";
}>;

type SyncResult = Readonly<{
  bytes: number;
  checksum: string;
  code: string;
  relationId: string;
  status: "downloaded" | "reused";
  storageKey: string;
}>;

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function asBoundaryFeature(value: unknown): BoundaryFeature | undefined {
  const feature = asObject(value);
  const geometry = asObject(feature?.geometry);

  if (
    feature?.type !== "Feature" ||
    !geometry ||
    (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") ||
    !Array.isArray(geometry.coordinates)
  ) {
    return undefined;
  }

  return {
    bbox: feature.bbox,
    geometry: {
      coordinates: geometry.coordinates,
      type: geometry.type,
    },
    properties: asObject(feature.properties) ?? {},
    type: "Feature",
  };
}

function relationIdOf(feature: BoundaryFeature): string {
  const relationId = feature.properties.osm_id;

  return typeof relationId === "number" || typeof relationId === "string"
    ? String(relationId)
    : "";
}

function validateFeature(
  definition: ServiceAreaBoundaryDefinition,
  feature: BoundaryFeature,
): void {
  const properties = feature.properties;
  const extraTags = asObject(properties.extratags);
  const failures = [
    properties.osm_type === "relation"
      ? undefined
      : `osm_type=${String(properties.osm_type)}`,
    relationIdOf(feature) === definition.sourceRelationId
      ? undefined
      : `osm_id=${relationIdOf(feature)}`,
    properties.name === definition.osmName
      ? undefined
      : `name=${String(properties.name)}`,
    properties.type === "historic"
      ? undefined
      : `type=${String(properties.type)}`,
    extraTags?.end_date === definition.osmEndDate
      ? undefined
      : `end_date=${String(extraTags?.end_date)}`,
  ].filter((failure): failure is string => Boolean(failure));

  if (failures.length > 0) {
    throw new Error(
      `OSM boundary metadata drift for ${definition.code}: ${failures.join(", ")}`,
    );
  }
}

function createSnapshot(
  definition: ServiceAreaBoundaryDefinition,
  feature: BoundaryFeature,
  retrievedAt: string,
): string {
  const snapshot = {
    ...(feature.bbox === undefined ? {} : { bbox: feature.bbox }),
    geometry: feature.geometry,
    properties: {
      ...feature.properties,
      chonSource: {
        boundaryVersion: definition.version,
        retrievedAt,
        schemaVersion: 1,
        serviceAreaCode: definition.code,
        simplifyToleranceDegrees: serviceAreaBoundarySimplifyToleranceDegrees,
        sourceStorageKey: definition.sourceStorageKey,
      },
    },
    type: "Feature",
  };

  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeSnapshot(
  definition: ServiceAreaBoundaryDefinition,
  content: string,
  manifest: BoundarySourceManifest,
): Promise<void> {
  const objectPath = getBoundarySourceObjectPath(definition);
  const manifestPath = getBoundarySourceManifestPath(definition);
  const objectTemporaryPath = `${objectPath}.${process.pid}.tmp`;
  const manifestTemporaryPath = `${manifestPath}.${process.pid}.tmp`;

  await mkdir(dirname(objectPath), { recursive: true });
  await Promise.all([
    writeFile(objectTemporaryPath, content, { flag: "wx" }),
    writeFile(manifestTemporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: "wx",
    }),
  ]);
  await rename(objectTemporaryPath, objectPath);
  await rename(manifestTemporaryPath, manifestPath);
}

async function inspectExisting(
  definition: ServiceAreaBoundaryDefinition,
): Promise<SyncResult | undefined> {
  const objectPath = getBoundarySourceObjectPath(definition);
  const manifestPath = getBoundarySourceManifestPath(definition);
  const [hasObject, hasManifest] = await Promise.all([
    exists(objectPath),
    exists(manifestPath),
  ]);

  if (hasObject !== hasManifest) {
    throw new Error(
      `Incomplete boundary source object for ${definition.code}; both boundary.geojson and manifest.json are required`,
    );
  }
  if (!hasObject) return undefined;

  const { manifest } = await readVerifiedBoundarySourceObject(definition);

  return {
    bytes: manifest.bytes,
    checksum: manifest.checksum,
    code: definition.code,
    relationId: definition.sourceRelationId,
    status: "reused",
    storageKey: definition.sourceStorageKey,
  };
}

async function downloadMissing(
  definitions: readonly ServiceAreaBoundaryDefinition[],
): Promise<readonly SyncResult[]> {
  if (definitions.length === 0) return [];

  const lookupUrl = createNominatimBoundaryLookupUrl();
  const response = await fetch(lookupUrl, {
    headers: {
      "Accept-Language": "vi",
      "User-Agent": "Chon-MVP/0.1 (service-area boundary sync)",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Nominatim boundary lookup failed: ${response.status} ${response.statusText}`,
    );
  }

  const payload = asObject(await response.json());
  const features = Array.isArray(payload?.features)
    ? payload.features
        .map((feature) => asBoundaryFeature(feature))
        .filter((feature): feature is BoundaryFeature => Boolean(feature))
    : [];
  const retrievedAt = new Date().toISOString();
  const results: SyncResult[] = [];

  for (const definition of definitions) {
    const matches = features.filter(
      (feature) => relationIdOf(feature) === definition.sourceRelationId,
    );
    if (matches.length !== 1) {
      throw new Error(
        `Expected one OSM relation ${definition.sourceRelationId} for ${definition.code}, received ${matches.length}`,
      );
    }

    const feature = matches[0];
    validateFeature(definition, feature);
    const content = createSnapshot(definition, feature, retrievedAt);
    const checksum = sha256(content);
    const bytes = Buffer.byteLength(content);
    const manifest: BoundarySourceManifest = {
      boundaryVersion: definition.version,
      bytes,
      checksum,
      osmEndDate: definition.osmEndDate,
      osmFeatureType: "historic",
      retrievalUrl: lookupUrl.toString(),
      retrievedAt,
      schemaVersion: 1,
      serviceAreaCode: definition.code,
      simplifyToleranceDegrees: serviceAreaBoundarySimplifyToleranceDegrees,
      sourceLicense: definition.sourceLicense,
      sourceName: definition.sourceName,
      sourceRelationId: definition.sourceRelationId,
      sourceStorageKey: definition.sourceStorageKey,
      sourceUrl: definition.sourceUrl,
    };

    await writeSnapshot(definition, content, manifest);
    results.push({
      bytes,
      checksum,
      code: definition.code,
      relationId: definition.sourceRelationId,
      status: "downloaded",
      storageKey: definition.sourceStorageKey,
    });
  }

  return results;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { json: { type: "boolean" } },
    strict: true,
  });
  const inspected = await Promise.all(
    serviceAreaBoundaries.map(async (definition) => ({
      definition,
      result: await inspectExisting(definition),
    })),
  );
  const downloaded = await downloadMissing(
    inspected
      .filter(({ result }) => result === undefined)
      .map(({ definition }) => definition),
  );
  const results = [
    ...inspected.flatMap(({ result }) => (result ? [result] : [])),
    ...downloaded,
  ].sort((left, right) => left.code.localeCompare(right.code));

  if (values.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.table(
      results.map((result) => ({
        bytes: result.bytes,
        code: result.code,
        relation: result.relationId,
        sha256: `${result.checksum.slice(0, 12)}…`,
        status: result.status,
        storageKey: result.storageKey,
      })),
    );
    console.log(
      "Source objects are local mirrors of immutable storage keys and are excluded from Git.",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
