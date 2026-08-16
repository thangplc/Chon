import "./load-api-env.mjs";

import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { z } from "zod";

import { parsePlaceOpeningHours } from "../../../packages/domain/src/place-detail/place-detail";
import { createImportDatabaseClient } from "../src/data-pipeline/import/database";
import { readCsv } from "../src/data-pipeline/import/csv";

type Environment = "local" | "ci" | "staging";

type MetadataInput = Readonly<{
  amenities: readonly string[];
  currency: string;
  environment: Environment;
  estimated_capacity?: number;
  opening_hours?: ReturnType<typeof parsePlaceOpeningHours>;
  place_id: string;
  price_level?: number;
  size_category: "small" | "medium" | "large" | "unknown";
  source_note?: string;
  space_note?: string;
  typical_spend_max?: number;
  typical_spend_min?: number;
  updated_by?: string;
}>;

type ExistingMetadata = Omit<MetadataInput, "place_id" | "updated_by"> & {
  place_id: string;
};

const workspaceRoot = resolve(
  fileURLToPath(new URL("../../..", import.meta.url)),
);
const environments = new Set<Environment>(["local", "ci", "staging"]);
const internalId = z.string().regex(/^[a-z0-9_]{3,64}$/);
const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.string().trim().min(1).max(maximum).optional(),
  );
const optionalInteger = (minimum: number, maximum?: number) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.coerce
      .number()
      .int()
      .min(minimum)
      .max(maximum ?? Number.MAX_SAFE_INTEGER)
      .optional(),
  );
const optionalJson = <T>(parseValue: (value: unknown) => T) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z
      .string()
      .transform((value, context) => {
        try {
          return parseValue(JSON.parse(value) as unknown);
        } catch (error) {
          context.addIssue({
            code: "custom",
            message: error instanceof Error ? error.message : "Invalid JSON",
          });
          return z.NEVER;
        }
      })
      .optional(),
  );

const metadataSchema = z
  .object({
    amenities: optionalJson((value) => {
      if (!Array.isArray(value) || value.length > 30) {
        throw new Error("amenities must be a JSON array with at most 30 items");
      }
      return value.map((item, index) => {
        if (
          typeof item !== "string" ||
          item.trim().length === 0 ||
          item.length > 64
        ) {
          throw new Error(
            `amenities[${index}] must be a non-empty string of at most 64 characters`,
          );
        }
        return item.trim();
      });
    }).default([]),
    currency: z.preprocess(
      (value) => (value === "" || value === undefined ? "VND" : value),
      z.string().regex(/^[A-Z]{3}$/),
    ),
    environment: z.enum(["local", "ci", "staging"]),
    estimated_capacity: optionalInteger(1),
    opening_hours: optionalJson((value) => parsePlaceOpeningHours(value)),
    place_id: internalId,
    price_level: optionalInteger(1, 4),
    size_category: z.preprocess(
      (value) => (value === "" || value === undefined ? "unknown" : value),
      z.enum(["small", "medium", "large", "unknown"]),
    ),
    source_note: optionalText(240),
    space_note: optionalText(240),
    typical_spend_max: optionalInteger(0),
    typical_spend_min: optionalInteger(0),
    updated_by: optionalText(128),
  })
  .strict()
  .superRefine((row, context) => {
    if (
      row.typical_spend_min !== undefined &&
      row.typical_spend_max !== undefined &&
      row.typical_spend_max < row.typical_spend_min
    ) {
      context.addIssue({
        code: "custom",
        message: "typical_spend_max must be greater than or equal to min",
        path: ["typical_spend_max"],
      });
    }
  });

function parseOptions() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "dry-run": { type: "boolean" },
      environment: { type: "string" },
      file: { type: "string" },
      json: { type: "boolean" },
      operator: { type: "string" },
    },
    strict: true,
  });
  const file = values.file;
  if (typeof file !== "string" || file.trim() === "") {
    throw new Error("Missing required option --file");
  }
  const environment = values.environment ?? "local";
  if (!environments.has(environment as Environment)) {
    throw new Error("--environment must be local, ci or staging");
  }
  return {
    dryRun: values["dry-run"] === true,
    environment: environment as Environment,
    filePath: resolve(workspaceRoot, file),
    json: values.json === true,
    operator:
      typeof values.operator === "string"
        ? values.operator
        : (process.env.DATA_OPERATOR_ID ?? "local-developer"),
  };
}

function validateEnvironment(environment: Environment, dryRun: boolean): void {
  const configured = process.env.DATA_IMPORT_TARGET_ENVIRONMENT?.trim();
  if (!dryRun && configured !== environment) {
    throw new Error(
      `Import environment mismatch: --environment=${environment} but DATA_IMPORT_TARGET_ENVIRONMENT=${configured ?? "<missing>"}`,
    );
  }
}

function parseRows(
  records: readonly Record<string, string>[],
): readonly MetadataInput[] {
  return records.map((record, index) => {
    const result = metadataSchema.safeParse(record);
    if (!result.success) {
      throw new Error(
        `Invalid metadata row ${index + 2}: ${result.error.issues.map(({ message, path }) => `${path.join(".")}: ${message}`).join("; ")}`,
      );
    }
    return result.data;
  });
}

function comparable(row: MetadataInput | ExistingMetadata) {
  return JSON.stringify({
    amenities: row.amenities,
    currency: row.currency,
    environment: row.environment,
    estimated_capacity: row.estimated_capacity ?? null,
    opening_hours: row.opening_hours ?? null,
    price_level: row.price_level ?? null,
    size_category: row.size_category,
    source_note: row.source_note ?? null,
    space_note: row.space_note ?? null,
    typical_spend_max: row.typical_spend_max ?? null,
    typical_spend_min: row.typical_spend_min ?? null,
  });
}

async function main(): Promise<void> {
  const options = parseOptions();
  validateEnvironment(options.environment, options.dryRun);
  const parsed = await readCsv(options.filePath);
  const rows = parseRows(parsed.records);
  const mismatchedRows = rows.filter(
    ({ environment }) => environment !== options.environment,
  );
  if (mismatchedRows.length > 0) {
    throw new Error(
      `CSV environment must match --environment=${options.environment}`,
    );
  }
  const client = createImportDatabaseClient();
  let transactionOpen = false;

  try {
    await client.connect();
    const placeIds = [...new Set(rows.map(({ place_id }) => place_id))];
    const places = await client.query<{
      id: string;
      internal_id: string;
      is_simulated: boolean;
      status: string;
    }>(
      `SELECT id, internal_id, is_simulated, status
         FROM places
        WHERE internal_id = ANY($1::text[])`,
      [placeIds],
    );
    const placesByInternalId = new Map(
      places.rows.map((place) => [place.internal_id, place]),
    );
    const issues: string[] = [];
    for (const row of rows) {
      const place = placesByInternalId.get(row.place_id);
      if (!place) issues.push(`${row.place_id}: place not found`);
      else if (place.is_simulated) {
        issues.push(`${row.place_id}: synthetic overlays require a real POI`);
      } else if (place.status !== "published") {
        issues.push(`${row.place_id}: place must be published`);
      }
    }
    if (issues.length > 0) throw new Error(issues.join("\n"));

    const ids = places.rows.map(({ id }) => id);
    const existingRows: ExistingMetadata[] =
      ids.length === 0
        ? []
        : (
            await client.query<ExistingMetadata>(
              `SELECT place_id, environment, opening_hours, price_level,
                    typical_spend_min, typical_spend_max, currency,
                    size_category, estimated_capacity, amenities,
                    space_note, source_note
               FROM place_metadata_overlays
              WHERE environment = $1 AND place_id = ANY($2::uuid[])`,
              [options.environment, ids],
            )
          ).rows;
    const existingByPlaceId = new Map(
      existingRows.map((row) => [row.place_id, row]),
    );
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const row of rows) {
      const place = placesByInternalId.get(row.place_id);
      if (!place) continue;
      const existingRow = existingByPlaceId.get(place.id);
      if (!existingRow) created += 1;
      else if (
        comparable({ ...row, environment: options.environment }) ===
        comparable(existingRow)
      )
        unchanged += 1;
      else updated += 1;
    }

    if (!options.dryRun) {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      transactionOpen = true;
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('chon-synthetic-metadata-import'))",
      );
      for (const row of rows) {
        const place = placesByInternalId.get(row.place_id);
        if (!place) continue;
        await client.query(
          `INSERT INTO place_metadata_overlays
             (place_id, environment, opening_hours, price_level,
              typical_spend_min, typical_spend_max, currency, size_category,
              estimated_capacity, amenities, space_note, source_note, updated_by)
           VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13)
           ON CONFLICT (place_id, environment) DO UPDATE SET
              opening_hours = EXCLUDED.opening_hours,
              price_level = EXCLUDED.price_level,
              typical_spend_min = EXCLUDED.typical_spend_min,
              typical_spend_max = EXCLUDED.typical_spend_max,
              currency = EXCLUDED.currency,
              size_category = EXCLUDED.size_category,
              estimated_capacity = EXCLUDED.estimated_capacity,
              amenities = EXCLUDED.amenities,
              space_note = EXCLUDED.space_note,
              source_note = EXCLUDED.source_note,
              updated_by = EXCLUDED.updated_by,
              updated_at = now()`,
          [
            place.id,
            options.environment,
            JSON.stringify(row.opening_hours ?? null),
            row.price_level ?? null,
            row.typical_spend_min ?? null,
            row.typical_spend_max ?? null,
            row.currency,
            row.size_category,
            row.estimated_capacity ?? null,
            JSON.stringify(row.amenities),
            row.space_note ?? null,
            row.source_note ?? null,
            row.updated_by ?? options.operator,
          ],
        );
      }
      await client.query("COMMIT");
      transactionOpen = false;
    }

    const summary = {
      command: "metadata-overlay",
      created,
      dryRun: options.dryRun,
      environment: options.environment,
      file: parsed.file,
      status: "passed",
      unchanged,
      updated,
    };
    if (options.json) console.log(JSON.stringify(summary, null, 2));
    else {
      console.log(
        `Synthetic metadata overlay ${options.dryRun ? "dry-run" : "import"}`,
      );
      console.log(
        `File:        ${parsed.file.name} (${parsed.file.records} records)`,
      );
      console.log(`Environment: ${options.environment}`);
      console.log(`Created:     ${created}`);
      console.log(`Updated:     ${updated}`);
      console.log(`Unchanged:   ${unchanged}`);
      console.log("Result:      PASSED");
    }
  } finally {
    if (transactionOpen) await client.query("ROLLBACK");
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
