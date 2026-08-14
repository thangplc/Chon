import { randomUUID } from "node:crypto";

import {
  CONTRACT_VERSION,
  createEntityCounts,
  type ImportCommand,
  type ImportEnvironment,
  type ImportFile,
  type ImportIssue,
  type ImportSummary,
  type MutableEntityCounts,
} from "./types";

export type SummaryDraft = {
  command: ImportCommand;
  dataTypes: Record<string, number>;
  dryRun: boolean;
  entities: MutableEntityCounts;
  environment: ImportEnvironment;
  files: ImportFile[];
  importId: string;
  issues: ImportIssue[];
  operatorId: string;
  startedAt: string;
};

export function createSummaryDraft(input: {
  command: ImportCommand;
  dryRun: boolean;
  environment: ImportEnvironment;
  operatorId: string;
}): SummaryDraft {
  return {
    ...input,
    dataTypes: {},
    entities: createEntityCounts(),
    files: [],
    importId: randomUUID(),
    issues: [],
    startedAt: new Date().toISOString(),
  };
}

export function finalizeSummary(
  draft: SummaryDraft,
  status: "passed" | "failed",
): ImportSummary {
  const entityValues = Object.values(draft.entities);
  const conflicts = entityValues.reduce(
    (total, entity) => total + entity.conflicts,
    0,
  );
  const created = entityValues.reduce(
    (total, entity) => total + entity.created,
    0,
  );
  const unchanged = entityValues.reduce(
    (total, entity) => total + entity.unchanged,
    0,
  );
  const updated = entityValues.reduce(
    (total, entity) => total + entity.updated,
    0,
  );

  return {
    command: draft.command,
    completedAt: new Date().toISOString(),
    contractVersion: CONTRACT_VERSION,
    counts: {
      conflicts,
      created,
      rejected: draft.issues.filter(({ severity }) => severity === "error")
        .length,
      unchanged,
      updated,
      warnings: draft.issues.filter(({ severity }) => severity === "warning")
        .length,
    },
    dataTypes: draft.dataTypes,
    dryRun: draft.dryRun,
    entities: draft.entities,
    environment: draft.environment,
    files: draft.files,
    importId: draft.importId,
    issues: draft.issues,
    operatorId: draft.operatorId,
    startedAt: draft.startedAt,
    status,
  };
}

export function printSummary(summary: ImportSummary, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const mode = summary.dryRun ? "DRY RUN" : "IMPORT";
  console.log(`Import ID:        ${summary.importId}`);
  console.log(`Command:          ${summary.command}`);
  console.log(`Mode:             ${mode}`);
  console.log(`Environment:      ${summary.environment}`);
  console.log(`Contract:         ${summary.contractVersion}`);

  for (const file of summary.files) {
    console.log(
      `Source:           ${file.name} (${file.records} records, sha256:${file.checksum.slice(0, 12)}…)`,
    );
  }

  console.log(`Created:          ${summary.counts.created}`);
  console.log(`Updated:          ${summary.counts.updated}`);
  console.log(`Unchanged:        ${summary.counts.unchanged}`);
  console.log(`Conflicts:        ${summary.counts.conflicts}`);
  console.log(`Rejected:         ${summary.counts.rejected}`);
  console.log(`Warnings:         ${summary.counts.warnings}`);
  console.log(
    `Database writes:  ${summary.dryRun || summary.status === "failed" ? 0 : summary.counts.created + summary.counts.updated}`,
  );

  for (const issue of summary.issues) {
    const location = [issue.file, issue.row ? `row ${issue.row}` : undefined]
      .filter(Boolean)
      .join(":");
    console.log(
      `${issue.severity.toUpperCase()} ${issue.code}${location ? ` (${location})` : ""}: ${issue.message}`,
    );
  }

  console.log(`Result:           ${summary.status.toUpperCase()}`);
}
