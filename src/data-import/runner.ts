import { access, readdir } from "node:fs/promises";
import { join } from "node:path";

import {
  executeBoundaryPlan,
  planBoundaryImport,
  type BoundaryOptions,
} from "./boundary";
import { readCsv } from "./csv";
import {
  beginImportTransaction,
  createImportDatabaseClient,
  type ImportDatabaseClient,
} from "./database";
import {
  assertImportWriteTargetEnvironment,
  evaluateImportEnvironmentPolicy,
} from "./environment-policy";
import { hasFatalIssues, insertPlannedPlaces, planPlaces } from "./places";
import { insertPlannedPlaceSources, planPlaceSources } from "./place-sources";
import { insertSeedRecords, planSeedRecords } from "./seed";
import {
  createSummaryDraft,
  finalizeSummary,
  type SummaryDraft,
} from "./summary";
import {
  ImportError,
  type ImportEnvironment,
  type ImportSummary,
} from "./types";
import {
  assertUniqueIds,
  validatePlaceAreas,
  validatePlaceSources,
  validatePlaces,
  validateVibeReports,
  type PlaceAreaInput,
  type PlaceInput,
  type PlaceSourceInput,
  type VibeReportInput,
} from "./validation";

type CommonOptions = Readonly<{
  dryRun: boolean;
  environment: ImportEnvironment;
  operatorId: string;
}>;

export type DataImportOptions =
  | (CommonOptions & Readonly<{ command: "boundary"; input: BoundaryOptions }>)
  | (CommonOptions &
      Readonly<{
        command: "poi";
        input: Readonly<{ filePath: string; sourcesPath: string }>;
      }>)
  | (CommonOptions &
      Readonly<{ command: "seed"; input: Readonly<{ directory: string }> }>);

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadPlaces(
  filePath: string,
  draft: SummaryDraft,
): Promise<readonly PlaceInput[]> {
  const parsed = await readCsv(filePath);
  draft.files.push(parsed.file);
  const rows = validatePlaces(parsed);
  assertUniqueIds(rows, ({ internal_id: internalId }) => internalId, "place");
  draft.issues.push(
    ...evaluateImportEnvironmentPolicy(
      draft.environment,
      rows.map((row, index) => ({
        entity: "place",
        file: parsed.file.name,
        identifier: row.internal_id,
        isSimulated: row.is_simulated,
        row: index + 2,
      })),
    ),
  );
  return rows;
}

async function loadPlaceSources(
  filePath: string,
  draft: SummaryDraft,
): Promise<readonly PlaceSourceInput[]> {
  const parsed = await readCsv(filePath);
  draft.files.push(parsed.file);
  return validatePlaceSources(parsed);
}

async function loadSeed(directory: string, draft: SummaryDraft) {
  const placesPath = join(directory, "places.csv");
  if (!(await fileExists(placesPath))) {
    throw new ImportError("Seed directory has no places.csv", [
      {
        code: "missing_seed_file",
        file: "places.csv",
        message: "Seed directory must contain places.csv",
        severity: "error",
      },
    ]);
  }

  const places = await loadPlaces(placesPath, draft);
  const areasPath = join(directory, "place-areas.csv");
  let areas: readonly PlaceAreaInput[] = [];
  if (await fileExists(areasPath)) {
    const parsed = await readCsv(areasPath);
    draft.files.push(parsed.file);
    areas = validatePlaceAreas(parsed);
    assertUniqueIds(areas, ({ area_id: areaId }) => areaId, "place area");
    draft.issues.push(
      ...evaluateImportEnvironmentPolicy(
        draft.environment,
        areas.map((row, index) => ({
          entity: "place_area",
          file: parsed.file.name,
          identifier: row.area_id,
          isSimulated: row.is_simulated,
          row: index + 2,
        })),
      ),
    );
  }

  const fileNames = (await readdir(directory))
    .filter((fileName) => fileName.endsWith("vibe-reports.csv"))
    .sort();
  const reports: VibeReportInput[] = [];
  for (const fileName of fileNames) {
    const parsed = await readCsv(join(directory, fileName));
    draft.files.push(parsed.file);
    const fileReports = validateVibeReports(parsed);
    reports.push(...fileReports);
    draft.issues.push(
      ...evaluateImportEnvironmentPolicy(
        draft.environment,
        fileReports.map((row, index) => ({
          dataType: row.data_type,
          entity: "vibe_report",
          file: parsed.file.name,
          identifier: row.report_id,
          isSimulated: row.is_simulated,
          row: index + 2,
        })),
      ),
    );
  }
  assertUniqueIds(reports, ({ report_id: reportId }) => reportId, "report");

  return { areas, places, reports };
}

async function executeCommand(
  client: ImportDatabaseClient,
  options: DataImportOptions,
  draft: SummaryDraft,
): Promise<void> {
  if (options.command === "boundary") {
    const plan = await planBoundaryImport(client, options.input, draft);
    if (!options.dryRun && !hasFatalIssues(draft.issues)) {
      await executeBoundaryPlan(client, plan);
    }
    return;
  }

  if (options.command === "poi") {
    const places = await loadPlaces(options.input.filePath, draft);
    const sources = await loadPlaceSources(options.input.sourcesPath, draft);
    if (hasFatalIssues(draft.issues)) return;
    const placePlan = await planPlaces(client, places, draft);
    const sourcePlan = await planPlaceSources(client, sources, places, draft);
    if (!options.dryRun && !hasFatalIssues(draft.issues)) {
      await insertPlannedPlaces(client, placePlan);
      await insertPlannedPlaceSources(client, sourcePlan, placePlan);
    }
    return;
  }

  const seed = await loadSeed(options.input.directory, draft);
  if (hasFatalIssues(draft.issues)) return;
  const placePlan = await planPlaces(client, seed.places, draft);
  const seedPlan = await planSeedRecords(client, seed, draft);
  if (!options.dryRun && !hasFatalIssues(draft.issues)) {
    const placeIds = await insertPlannedPlaces(client, placePlan);
    await insertSeedRecords(client, seedPlan, placeIds);
  }
}

export async function runDataImport(
  options: DataImportOptions,
  injectedClient?: ImportDatabaseClient,
  execution: Readonly<{ manageTransaction?: boolean }> = {},
): Promise<ImportSummary> {
  const draft = createSummaryDraft({
    command: options.command,
    dryRun: options.dryRun,
    environment: options.environment,
    operatorId: options.operatorId,
  });
  try {
    assertImportWriteTargetEnvironment(options.environment, options.dryRun);
  } catch (error) {
    draft.issues.push({
      code: "import_environment_mismatch",
      message: error instanceof Error ? error.message : String(error),
      severity: "error",
    });
    return finalizeSummary(draft, "failed");
  }
  const client = injectedClient ?? createImportDatabaseClient();
  const ownsClient = injectedClient === undefined;
  const manageTransaction = execution.manageTransaction ?? true;
  if (ownsClient && !manageTransaction) {
    throw new Error(
      "An externally managed transaction requires an injected client",
    );
  }
  let transactionOpen = false;

  try {
    if (ownsClient) await client.connect();
    if (!options.dryRun && manageTransaction) {
      await beginImportTransaction(client);
      transactionOpen = true;
    }

    await executeCommand(client, options, draft);

    if (hasFatalIssues(draft.issues)) {
      if (transactionOpen) {
        await client.query("ROLLBACK");
        transactionOpen = false;
      }
      return finalizeSummary(draft, "failed");
    }

    if (transactionOpen) {
      await client.query("COMMIT");
      transactionOpen = false;
    }
    return finalizeSummary(draft, "passed");
  } catch (error) {
    if (transactionOpen) {
      await client.query("ROLLBACK");
      transactionOpen = false;
    }
    if (error instanceof ImportError) {
      draft.issues.push(...error.issues);
    } else {
      draft.issues.push({
        code: "import_failed",
        message:
          error instanceof Error ? error.message : "Unknown import error",
        severity: "error",
      });
    }
    return finalizeSummary(draft, "failed");
  } finally {
    if (ownsClient) await client.end();
  }
}
