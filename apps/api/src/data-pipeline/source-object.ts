import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { z } from "zod";

import { sha256 } from "./import/csv";
import type { ServiceAreaBoundaryDefinition } from "./service-area-boundaries";

const workspaceRoot = resolve(process.cwd(), "../..");

const manifestSchema = z.object({
  boundaryVersion: z.number().int().positive(),
  bytes: z.number().int().positive(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  osmAdminLevel: z.string().min(1).optional(),
  osmEndDate: z.string().min(1).optional(),
  osmFeatureType: z.enum(["administrative", "historic"]),
  retrievalUrl: z.url(),
  retrievedAt: z.iso.datetime({ offset: true }),
  schemaVersion: z.literal(1),
  serviceAreaCode: z.string().min(1),
  simplifyToleranceDegrees: z.number().positive(),
  sourceLicense: z.string().min(1),
  sourceName: z.string().min(1),
  sourceRelationId: z.string().min(1),
  sourceStorageKey: z.string().min(1),
  sourceUrl: z.url(),
});

export type BoundarySourceManifest = z.infer<typeof manifestSchema>;

export function getBoundarySourceObjectPath(
  definition: ServiceAreaBoundaryDefinition,
  projectRoot = workspaceRoot,
): string {
  return resolve(
    projectRoot,
    "data/source-objects",
    definition.sourceStorageKey,
  );
}

export function getBoundarySourceManifestPath(
  definition: ServiceAreaBoundaryDefinition,
  projectRoot = workspaceRoot,
): string {
  return resolve(
    dirname(getBoundarySourceObjectPath(definition, projectRoot)),
    "manifest.json",
  );
}

export async function readVerifiedBoundarySourceObject(
  definition: ServiceAreaBoundaryDefinition,
  projectRoot = workspaceRoot,
): Promise<Readonly<{ content: string; manifest: BoundarySourceManifest }>> {
  const objectPath = getBoundarySourceObjectPath(definition, projectRoot);
  const manifestPath = getBoundarySourceManifestPath(definition, projectRoot);
  const [content, rawManifest] = await Promise.all([
    readFile(objectPath, "utf8"),
    readFile(manifestPath, "utf8"),
  ]);
  const manifest = manifestSchema.parse(JSON.parse(rawManifest));
  const expectedMetadata = {
    boundaryVersion: definition.version,
    ...(definition.areaType === "historic_district"
      ? { osmEndDate: definition.osmEndDate }
      : { osmAdminLevel: definition.osmAdminLevel }),
    osmFeatureType: definition.osmFeatureType,
    serviceAreaCode: definition.code,
    sourceLicense: definition.sourceLicense,
    sourceName: definition.sourceName,
    sourceRelationId: definition.sourceRelationId,
    sourceStorageKey: definition.sourceStorageKey,
    sourceUrl: definition.sourceUrl,
  };

  for (const [key, expected] of Object.entries(expectedMetadata)) {
    const actual = manifest[key as keyof typeof expectedMetadata];

    if (actual !== expected) {
      throw new Error(
        `Boundary source manifest mismatch for ${definition.code}: ${key}=${String(actual)}, expected ${String(expected)}`,
      );
    }
  }

  const checksum = sha256(content);
  if (manifest.checksum !== checksum) {
    throw new Error(
      `Boundary source checksum mismatch for ${definition.code}: ${checksum}, expected ${manifest.checksum}`,
    );
  }
  if (manifest.bytes !== Buffer.byteLength(content)) {
    throw new Error(
      `Boundary source byte size mismatch for ${definition.code}`,
    );
  }

  return { content, manifest };
}
