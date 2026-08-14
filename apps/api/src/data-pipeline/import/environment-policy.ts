import type { ImportEnvironment, ImportIssue } from "./types";

type Environment = Readonly<Record<string, string | undefined>>;

export type ImportPolicyDataType =
  "synthetic" | "research" | "editorial" | "community";

export type ImportPolicyRecord = Readonly<{
  dataType?: ImportPolicyDataType;
  entity: "place" | "place_area" | "place_media" | "vibe_report";
  file: string;
  identifier: string;
  isSimulated: boolean;
  row: number;
}>;

const PRODUCTION_REPORT_DATA_TYPES = new Set<ImportPolicyDataType>([
  "editorial",
  "community",
]);
const IMPORT_ENVIRONMENTS = new Set<ImportEnvironment>([
  "local",
  "ci",
  "staging",
  "research",
  "production",
]);

export function assertImportWriteTargetEnvironment(
  requestedEnvironment: ImportEnvironment,
  dryRun: boolean,
  environment: Environment = process.env,
): void {
  const configuredEnvironment =
    environment.DATA_IMPORT_TARGET_ENVIRONMENT?.trim();

  if (!configuredEnvironment) {
    if (dryRun) return;
    throw new Error(
      "DATA_IMPORT_TARGET_ENVIRONMENT is required for database writes",
    );
  }

  if (!IMPORT_ENVIRONMENTS.has(configuredEnvironment as ImportEnvironment)) {
    throw new Error(
      `Invalid DATA_IMPORT_TARGET_ENVIRONMENT: ${configuredEnvironment}`,
    );
  }

  if (!dryRun && configuredEnvironment !== requestedEnvironment) {
    throw new Error(
      `Import environment mismatch: --environment=${requestedEnvironment} but DATA_IMPORT_TARGET_ENVIRONMENT=${configuredEnvironment}`,
    );
  }
}

export function evaluateImportEnvironmentPolicy(
  environment: ImportEnvironment,
  records: readonly ImportPolicyRecord[],
): ImportIssue[] {
  if (environment !== "production") {
    return [];
  }

  return records.flatMap((record): ImportIssue[] => {
    if (
      record.entity === "vibe_report" &&
      record.dataType &&
      !PRODUCTION_REPORT_DATA_TYPES.has(record.dataType)
    ) {
      return [
        {
          code: "production_data_type_forbidden",
          file: record.file,
          message: `Production import rejects vibe report ${record.identifier}: data_type=${record.dataType}`,
          row: record.row,
          severity: "error",
        },
      ];
    }

    if (record.isSimulated) {
      return [
        {
          code: "production_simulated_record_forbidden",
          file: record.file,
          message: `Production import rejects ${record.entity} ${record.identifier}: is_simulated=true`,
          row: record.row,
          severity: "error",
        },
      ];
    }

    return [];
  });
}
