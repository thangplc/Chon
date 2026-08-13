import "dotenv/config";

import { resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  runDataImport,
  type DataImportOptions,
} from "../src/data-import/runner";
import { printSummary } from "../src/data-import/summary";
import type { ImportEnvironment } from "../src/data-import/types";

const HELP = `Chốn data importer

Usage:
  pnpm data:import boundary --file <geojson> --code <code> --name <name>
    --version <n> --source-storage-key <key> --source-name <name>
    --source-relation-id <id> --source-url <url> --source-license <license>
    --retrieved-at <iso-timestamp> [--current] [--dry-run]

  pnpm data:import poi --file <places.csv> --sources <place-sources.csv> [--dry-run]
  pnpm data:import seed --dir <seed-directory> [--dry-run]

Common options:
  --environment local|ci|staging|research|production  Default: local
  --operator <id>                                   Default: local-developer
  --json                                            Print machine-readable summary
`;

const environments = new Set<ImportEnvironment>([
  "local",
  "ci",
  "staging",
  "research",
  "production",
]);

function required(value: string | undefined, option: string): string {
  if (!value?.trim()) throw new Error(`Missing required option --${option}`);
  return value.trim();
}

function bounded(
  value: string | undefined,
  option: string,
  maximum: number,
): string {
  const parsed = required(value, option);
  if (parsed.length > maximum) {
    throw new Error(`--${option} must be at most ${maximum} characters`);
  }
  return parsed;
}

function positiveInteger(value: string | undefined, option: string): number {
  const parsed = Number(required(value, option));
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${option} must be a positive integer`);
  }
  return parsed;
}

function integer(value: string | undefined, option: string, fallback: number) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed))
    throw new Error(`--${option} must be an integer`);
  return parsed;
}

function common(values: Record<string, string | boolean | undefined>) {
  const rawEnvironment =
    typeof values.environment === "string" ? values.environment : "local";
  if (!environments.has(rawEnvironment as ImportEnvironment)) {
    throw new Error(`Invalid --environment: ${rawEnvironment}`);
  }

  const dryRun = values["dry-run"] === true;
  const environment = rawEnvironment as ImportEnvironment;

  return {
    dryRun,
    environment,
    json: values.json === true,
    operatorId:
      typeof values.operator === "string"
        ? values.operator
        : (process.env.DATA_OPERATOR_ID ?? "local-developer"),
  };
}

function commonOptions() {
  return {
    "dry-run": { type: "boolean" as const },
    environment: { type: "string" as const },
    help: { short: "h", type: "boolean" as const },
    json: { type: "boolean" as const },
    operator: { type: "string" as const },
  };
}

function parseCommand(argv: readonly string[]): {
  json: boolean;
  options: DataImportOptions;
} {
  const command = argv[0];
  if (!command || command === "help" || argv.includes("--help")) {
    console.log(HELP);
    process.exit(0);
  }

  if (command === "poi") {
    const { values } = parseArgs({
      args: argv.slice(1),
      options: {
        ...commonOptions(),
        file: { type: "string" },
        sources: { type: "string" },
      },
      strict: true,
    });
    const shared = common(values);
    return {
      json: shared.json,
      options: {
        command,
        dryRun: shared.dryRun,
        environment: shared.environment,
        input: {
          filePath: resolve(required(values.file, "file")),
          sourcesPath: resolve(required(values.sources, "sources")),
        },
        operatorId: shared.operatorId,
      },
    };
  }

  if (command === "seed") {
    const { values } = parseArgs({
      args: argv.slice(1),
      options: { ...commonOptions(), dir: { type: "string" } },
      strict: true,
    });
    const shared = common(values);
    return {
      json: shared.json,
      options: {
        command,
        dryRun: shared.dryRun,
        environment: shared.environment,
        input: { directory: resolve(required(values.dir, "dir")) },
        operatorId: shared.operatorId,
      },
    };
  }

  if (command === "boundary") {
    const { values } = parseArgs({
      args: argv.slice(1),
      options: {
        ...commonOptions(),
        "area-type": { type: "string" },
        code: { type: "string" },
        current: { type: "boolean" },
        file: { type: "string" },
        name: { type: "string" },
        "parent-code": { type: "string" },
        priority: { type: "string" },
        "retrieved-at": { type: "string" },
        "source-license": { type: "string" },
        "source-name": { type: "string" },
        "source-relation-id": { type: "string" },
        "source-storage-key": { type: "string" },
        "source-url": { type: "string" },
        status: { type: "string" },
        timezone: { type: "string" },
        version: { type: "string" },
      },
      strict: true,
    });
    const shared = common(values);
    const retrievedAtValue = required(values["retrieved-at"], "retrieved-at");
    if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(retrievedAtValue)) {
      throw new Error("--retrieved-at must be ISO 8601 with timezone");
    }
    const retrievedAt = new Date(retrievedAtValue);
    if (Number.isNaN(retrievedAt.getTime())) {
      throw new Error("--retrieved-at is not a valid timestamp");
    }
    const sourceUrl = required(values["source-url"], "source-url");
    if (sourceUrl.length > 2_048) {
      throw new Error("--source-url must be at most 2048 characters");
    }
    new URL(sourceUrl);
    const status = typeof values.status === "string" ? values.status : "active";
    if (!new Set(["draft", "active", "paused", "archived"]).has(status)) {
      throw new Error(`Invalid --status: ${status}`);
    }

    return {
      json: shared.json,
      options: {
        command,
        dryRun: shared.dryRun,
        environment: shared.environment,
        input: {
          areaType:
            typeof values["area-type"] === "string"
              ? bounded(values["area-type"], "area-type", 32)
              : "district",
          code: (() => {
            const code = bounded(values.code, "code", 64);
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)) {
              throw new Error("--code must be lowercase kebab-case");
            }
            return code;
          })(),
          current: values.current === true,
          displayName: bounded(values.name, "name", 120),
          filePath: resolve(required(values.file, "file")),
          parentCode:
            typeof values["parent-code"] === "string"
              ? (() => {
                  const parentCode = bounded(
                    values["parent-code"],
                    "parent-code",
                    64,
                  );
                  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parentCode)) {
                    throw new Error(
                      "--parent-code must be lowercase kebab-case",
                    );
                  }
                  return parentCode;
                })()
              : undefined,
          priority: integer(values.priority, "priority", 0),
          retrievedAt,
          sourceLicense: bounded(
            values["source-license"],
            "source-license",
            120,
          ),
          sourceName: bounded(values["source-name"], "source-name", 120),
          sourceRelationId: bounded(
            values["source-relation-id"],
            "source-relation-id",
            64,
          ),
          sourceStorageKey: bounded(
            values["source-storage-key"],
            "source-storage-key",
            512,
          ),
          sourceUrl,
          status: status as "draft" | "active" | "paused" | "archived",
          timezone:
            typeof values.timezone === "string"
              ? bounded(values.timezone, "timezone", 64)
              : "Asia/Ho_Chi_Minh",
          version: positiveInteger(values.version, "version"),
        },
        operatorId: shared.operatorId,
      },
    };
  }

  throw new Error(`Unknown command '${command}'\n\n${HELP}`);
}

async function main() {
  const parsed = parseCommand(process.argv.slice(2));
  const summary = await runDataImport(parsed.options);
  printSummary(summary, parsed.json);
  if (summary.status === "failed") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
