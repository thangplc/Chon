export const CONTRACT_VERSION = "1.0";

export type ImportCommand = "boundary" | "poi" | "seed";
export type ImportEnvironment =
  "local" | "ci" | "staging" | "research" | "production";

export type ImportEntity =
  | "serviceAreas"
  | "boundaries"
  | "places"
  | "placeAreas"
  | "placeSources"
  | "placeServiceAreas"
  | "vibeReports";

export type ImportCounts = Readonly<{
  conflicts: number;
  created: number;
  rejected: number;
  unchanged: number;
  updated: number;
  warnings: number;
}>;

export type EntityCounts = Readonly<
  Record<
    ImportEntity,
    Readonly<{
      conflicts: number;
      created: number;
      unchanged: number;
      updated: number;
    }>
  >
>;

export type ImportFile = Readonly<{
  checksum: string;
  name: string;
  records: number;
}>;

export type ImportIssue = Readonly<{
  code: string;
  file?: string;
  message: string;
  row?: number;
  severity: "error" | "warning";
}>;

export type ImportSummary = Readonly<{
  command: ImportCommand;
  completedAt: string;
  contractVersion: string;
  counts: ImportCounts;
  dataTypes: Readonly<Record<string, number>>;
  dryRun: boolean;
  entities: EntityCounts;
  environment: ImportEnvironment;
  files: readonly ImportFile[];
  importId: string;
  issues: readonly ImportIssue[];
  operatorId: string;
  startedAt: string;
  status: "passed" | "failed";
}>;

export type MutableEntityCounts = Record<
  ImportEntity,
  {
    conflicts: number;
    created: number;
    unchanged: number;
    updated: number;
  }
>;

export function createEntityCounts(): MutableEntityCounts {
  return {
    boundaries: { conflicts: 0, created: 0, unchanged: 0, updated: 0 },
    places: { conflicts: 0, created: 0, unchanged: 0, updated: 0 },
    placeAreas: { conflicts: 0, created: 0, unchanged: 0, updated: 0 },
    placeSources: { conflicts: 0, created: 0, unchanged: 0, updated: 0 },
    placeServiceAreas: {
      conflicts: 0,
      created: 0,
      unchanged: 0,
      updated: 0,
    },
    serviceAreas: { conflicts: 0, created: 0, unchanged: 0, updated: 0 },
    vibeReports: { conflicts: 0, created: 0, unchanged: 0, updated: 0 },
  };
}

export class ImportError extends Error {
  constructor(
    message: string,
    readonly issues: readonly ImportIssue[],
  ) {
    super(message);
    this.name = "ImportError";
  }
}
