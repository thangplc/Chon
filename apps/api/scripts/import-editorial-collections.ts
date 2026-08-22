import "./load-api-env.mjs";

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { parseEditorialCollectionRows } from "../src/collections/editorial-collection-import";
import { createImportDatabaseClient } from "../src/data-pipeline/import/database";
import { readCsv } from "../src/data-pipeline/import/csv";

const environments = ["local", "ci", "staging", "production"] as const;
type Environment = (typeof environments)[number];
const workspaceRoot = resolve(
  fileURLToPath(new URL("../../..", import.meta.url)),
);

function readOptions() {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean" },
      environment: { type: "string" },
      file: { type: "string" },
      json: { type: "boolean" },
    },
    strict: true,
  });
  const environment = values.environment ?? "local";
  if (!environments.includes(environment as Environment)) {
    throw new Error("--environment must be local, ci, staging or production");
  }
  const file = values.file;
  if (!file) throw new Error("Missing required option --file");
  const dryRun = values["dry-run"] === true;
  const configured = process.env.DATA_IMPORT_TARGET_ENVIRONMENT?.trim();
  if (!dryRun && configured !== environment) {
    throw new Error(
      `Import environment mismatch: --environment=${environment} but DATA_IMPORT_TARGET_ENVIRONMENT=${configured ?? "<missing>"}`,
    );
  }
  if (
    !dryRun &&
    environment === "production" &&
    process.env.DATA_IMPORT_ALLOW_PRODUCTION !== "true"
  ) {
    throw new Error(
      "Production editorial import requires DATA_IMPORT_ALLOW_PRODUCTION=true",
    );
  }
  return {
    dryRun,
    environment: environment as Environment,
    filePath: resolve(workspaceRoot, file),
    json: values.json === true,
  };
}

async function main() {
  const options = readOptions();
  const parsed = await readCsv(options.filePath);
  const rows = parseEditorialCollectionRows(parsed.records);
  if (rows.some(({ environment }) => environment !== options.environment)) {
    throw new Error(
      `CSV environment must match --environment=${options.environment}`,
    );
  }

  const client = createImportDatabaseClient();
  let transactionOpen = false;
  try {
    await client.connect();
    const internalIds = [
      ...new Set(rows.map(({ place_internal_id }) => place_internal_id)),
    ];
    const result = await client.query<{
      id: string;
      internal_id: string;
      is_simulated: boolean;
      status: string;
    }>(
      `SELECT id, internal_id, is_simulated, status
         FROM places
        WHERE internal_id = ANY($1::text[])`,
      [internalIds],
    );
    const places = new Map(
      result.rows.map((place) => [place.internal_id, place]),
    );
    const issues: string[] = [];
    for (const internalId of internalIds) {
      const place = places.get(internalId);
      if (!place) issues.push(`${internalId}: place not found`);
      else if (place.is_simulated)
        issues.push(`${internalId}: simulated place is forbidden`);
      else if (place.status !== "published")
        issues.push(`${internalId}: place must be published`);
    }
    if (issues.length > 0) throw new Error(issues.join("\n"));

    const groups = new Map<string, (typeof rows)[number][]>();
    for (const row of rows) {
      const group = groups.get(row.collection_slug) ?? [];
      group.push(row);
      groups.set(row.collection_slug, group);
    }
    if (!options.dryRun) {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      transactionOpen = true;
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('chon-editorial-collection-import'))",
      );
      for (const [slug, group] of groups) {
        const metadata = group[0]!;
        const existing = await client.query<{ id: string }>(
          `SELECT id FROM collections
            WHERE owner_type = 'editorial' AND slug = $1
            FOR UPDATE`,
          [slug],
        );
        let collectionId = existing.rows[0]?.id;
        if (collectionId) {
          await client.query(
            `UPDATE collections SET name = $2, description = $3,
                    visibility = 'public', status = $4::varchar,
                    published_at = CASE WHEN $4::varchar = 'published'
                      THEN COALESCE(published_at, now()) ELSE NULL END,
                    updated_at = now()
              WHERE id = $1`,
            [
              collectionId,
              metadata.collection_name,
              metadata.description,
              metadata.status,
            ],
          );
        } else {
          const inserted = await client.query<{ id: string }>(
            `INSERT INTO collections
               (user_id, owner_type, name, description, slug, visibility,
                status, published_at, is_default)
             VALUES (NULL, 'editorial', $1, $2, $3, 'public', $4::varchar,
                CASE WHEN $4::varchar = 'published' THEN now() ELSE NULL END, false)
             RETURNING id`,
            [
              metadata.collection_name,
              metadata.description,
              slug,
              metadata.status,
            ],
          );
          collectionId = inserted.rows[0]!.id;
        }

        const placeIds = group.map(
          ({ place_internal_id }) => places.get(place_internal_id)!.id,
        );
        await client.query(
          `DELETE FROM collection_places
            WHERE collection_id = $1 AND NOT (place_id = ANY($2::uuid[]))`,
          [collectionId, placeIds],
        );
        for (const row of group) {
          await client.query(
            `INSERT INTO collection_places (collection_id, place_id, note, position)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (collection_id, place_id) DO UPDATE SET
               note = EXCLUDED.note, position = EXCLUDED.position,
               updated_at = now()`,
            [
              collectionId,
              places.get(row.place_internal_id)!.id,
              row.note,
              row.position,
            ],
          );
        }
      }
      await client.query("COMMIT");
      transactionOpen = false;
    }

    const summary = {
      collections: groups.size,
      dryRun: options.dryRun,
      environment: options.environment,
      file: parsed.file,
      places: rows.length,
      status: "passed",
    };
    if (options.json) console.log(JSON.stringify(summary, null, 2));
    else {
      console.log(
        `Editorial collection ${options.dryRun ? "dry-run" : "import"}`,
      );
      console.log(
        `File:        ${parsed.file.name} (${parsed.file.records} records)`,
      );
      console.log(`Environment: ${options.environment}`);
      console.log(`Collections: ${groups.size}`);
      console.log(`Places:      ${rows.length}`);
      console.log(`Writes:      ${options.dryRun ? 0 : "committed"}`);
      console.log("Result:      PASSED");
    }
  } finally {
    if (transactionOpen) await client.query("ROLLBACK");
    await client.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
