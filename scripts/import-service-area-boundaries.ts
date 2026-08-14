import "dotenv/config";

import { parseArgs } from "node:util";

import { serviceAreaBoundaries } from "../src/config/service-area-boundaries";
import {
  beginImportTransaction,
  createImportDatabaseClient,
} from "../src/data-import/database";
import { runDataImport } from "../src/data-import/runner";
import { printSummary } from "../src/data-import/summary";
import type {
  ImportEnvironment,
  ImportSummary,
} from "../src/data-import/types";
import {
  getBoundarySourceObjectPath,
  readVerifiedBoundarySourceObject,
} from "../src/service-areas/source-object";

const environments = new Set<ImportEnvironment>([
  "local",
  "ci",
  "staging",
  "research",
  "production",
]);

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean" },
      environment: { default: "local", type: "string" },
      json: { type: "boolean" },
      operator: { type: "string" },
    },
    strict: true,
  });
  if (!environments.has(values.environment as ImportEnvironment)) {
    throw new Error(`Invalid --environment: ${values.environment}`);
  }

  const environment = values.environment as ImportEnvironment;
  const dryRun = values["dry-run"] === true;
  const operatorId =
    values.operator ?? process.env.DATA_OPERATOR_ID ?? "local-developer";
  const sources = await Promise.all(
    serviceAreaBoundaries.map(async (definition) => ({
      definition,
      source: await readVerifiedBoundarySourceObject(definition),
    })),
  );
  const client = createImportDatabaseClient();
  const summaries: ImportSummary[] = [];
  let transactionOpen = false;

  try {
    await client.connect();
    if (!dryRun) {
      await beginImportTransaction(client);
      transactionOpen = true;
    }

    for (const { definition, source } of sources) {
      const summary = await runDataImport(
        {
          command: "boundary",
          dryRun,
          environment,
          input: {
            areaType: definition.areaType,
            code: definition.code,
            current: true,
            displayName: definition.displayName,
            filePath: getBoundarySourceObjectPath(definition),
            priority: definition.priority,
            retrievedAt: new Date(source.manifest.retrievedAt),
            sourceLicense: definition.sourceLicense,
            sourceName: definition.sourceName,
            sourceRelationId: definition.sourceRelationId,
            sourceStorageKey: definition.sourceStorageKey,
            sourceUrl: definition.sourceUrl,
            status: definition.status,
            timezone: definition.timezone,
            version: definition.version,
          },
          operatorId,
        },
        client,
        { manageTransaction: false },
      );
      summaries.push(summary);

      if (!dryRun && summary.status === "failed") break;
    }

    if (summaries.some(({ status }) => status === "failed")) {
      if (transactionOpen) {
        await client.query("ROLLBACK");
        transactionOpen = false;
      }
      process.exitCode = 1;
    } else if (transactionOpen) {
      await client.query("COMMIT");
      transactionOpen = false;
    }
  } finally {
    if (transactionOpen) await client.query("ROLLBACK");
    await client.end();
  }

  if (values.json) {
    console.log(JSON.stringify(summaries, null, 2));
  } else {
    summaries.forEach((summary, index) => {
      if (index > 0) console.log("");
      console.log(`Service area:     ${serviceAreaBoundaries[index].code}`);
      printSummary(summary, false);
    });
    console.log(
      dryRun
        ? "No boundary changes were written."
        : process.exitCode
          ? "All boundary changes were rolled back."
          : "All three boundaries were committed atomically.",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
