import "./load-api-env.mjs";

import { parseArgs } from "node:util";

import { validateApiEnvironment } from "../src/config/api-environment";
import {
  getDatabaseConnection,
  closeDatabaseConnection,
} from "../src/database/client";
import { VibeSnapshotBuildRunner } from "../src/vibe-snapshots/vibe-snapshot-builder-core";

const environmentValues = ["local", "ci", "staging", "production"] as const;
type SnapshotEnvironment = (typeof environmentValues)[number];

function readEnvironment(value: string | undefined): SnapshotEnvironment {
  const environment =
    value ?? process.env.DATA_IMPORT_TARGET_ENVIRONMENT ?? "local";
  if (!environmentValues.includes(environment as SnapshotEnvironment)) {
    throw new Error(`Invalid --environment: ${environment}`);
  }
  return environment as SnapshotEnvironment;
}

function readOptions() {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean" },
      environment: { type: "string" },
      json: { type: "boolean" },
      help: { short: "h", type: "boolean" },
    },
    strict: true,
  });
  if (values.help) {
    console.log(
      `Rebuild contribution vibe snapshots\n\nUsage:\n  pnpm vibe:snapshots:rebuild [--environment local|ci|staging|production] [--dry-run] [--json]`,
    );
    process.exit(0);
  }

  const environment = readEnvironment(values.environment);
  const dryRun = values["dry-run"] === true;
  if (!dryRun) {
    const configured = process.env.DATA_IMPORT_TARGET_ENVIRONMENT;
    if (!configured) {
      throw new Error(
        "DATA_IMPORT_TARGET_ENVIRONMENT is required for snapshot writes",
      );
    }
    if (configured !== environment) {
      throw new Error(
        `Snapshot environment mismatch: --environment=${environment} but DATA_IMPORT_TARGET_ENVIRONMENT=${configured}`,
      );
    }
  }

  return { dryRun, environment, json: values.json === true };
}

async function main(): Promise<void> {
  const options = readOptions();
  const environment = validateApiEnvironment(
    process.env,
  ).DATA_IMPORT_TARGET_ENVIRONMENT;
  if (environment !== options.environment && !options.dryRun) {
    throw new Error(
      `Loaded API environment mismatch: expected ${options.environment} but got ${environment}`,
    );
  }

  const { db } = getDatabaseConnection();
  try {
    const builder = new VibeSnapshotBuildRunner(db);
    const summary = await builder.rebuild(options.environment, options.dryRun);
    if (options.json) console.log(JSON.stringify(summary, null, 2));
    else {
      console.log(
        `${options.dryRun ? "Validated" : "Rebuilt"} ${summary.snapshots} contribution vibe snapshots from ${summary.eligibleReports} reports (${summary.simulatedSnapshots} simulated).`,
      );
      if (summary.skippedReports > 0) {
        console.log(
          `Skipped ${summary.skippedReports} approved reports without explicit time context or a place timezone.`,
        );
      }
    }
  } finally {
    await closeDatabaseConnection();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
