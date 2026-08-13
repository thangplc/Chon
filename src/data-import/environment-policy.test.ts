import { describe, expect, it } from "vitest";

import {
  assertImportWriteTargetEnvironment,
  evaluateImportEnvironmentPolicy,
  type ImportPolicyDataType,
} from "./environment-policy";
import type { ImportEnvironment } from "./types";

const dataTypes: readonly ImportPolicyDataType[] = [
  "synthetic",
  "research",
  "editorial",
  "community",
];

function report(dataType: ImportPolicyDataType, isSimulated = false) {
  return {
    dataType,
    entity: "vibe_report" as const,
    file: `${dataType}-vibe-reports.csv`,
    identifier: `${dataType}_report_001`,
    isSimulated,
    row: 2,
  };
}

describe("evaluateImportEnvironmentPolicy", () => {
  it.each(["local", "ci", "staging", "research"] as const)(
    "allows all four data types in %s",
    (environment: ImportEnvironment) => {
      const issues = evaluateImportEnvironmentPolicy(
        environment,
        dataTypes.map((dataType) => report(dataType, true)),
      );

      expect(issues).toEqual([]);
    },
  );

  it("allows only real editorial and community reports in production", () => {
    const issues = evaluateImportEnvironmentPolicy(
      "production",
      dataTypes.map((dataType) => report(dataType)),
    );

    expect(issues).toHaveLength(2);
    expect(issues.map(({ code }) => code)).toEqual([
      "production_data_type_forbidden",
      "production_data_type_forbidden",
    ]);
    expect(issues.map(({ message }) => message)).toEqual([
      expect.stringContaining("data_type=synthetic"),
      expect.stringContaining("data_type=research"),
    ]);
  });

  it("rejects simulated places, areas and otherwise allowed reports", () => {
    const issues = evaluateImportEnvironmentPolicy("production", [
      {
        entity: "place",
        file: "places.csv",
        identifier: "simulated_place",
        isSimulated: true,
        row: 2,
      },
      {
        entity: "place_area",
        file: "place-areas.csv",
        identifier: "simulated_area",
        isSimulated: true,
        row: 2,
      },
      report("editorial", true),
      report("community", true),
    ]);

    expect(issues).toHaveLength(4);
    expect(
      issues.every(
        ({ code }) => code === "production_simulated_record_forbidden",
      ),
    ).toBe(true);
  });

  it("reports one rejection per disallowed record", () => {
    const issues = evaluateImportEnvironmentPolicy("production", [
      report("synthetic", true),
      report("research", true),
    ]);

    expect(issues).toHaveLength(2);
  });
});

describe("assertImportWriteTargetEnvironment", () => {
  it("requires a configured target for database writes", () => {
    expect(() =>
      assertImportWriteTargetEnvironment("local", false, {}),
    ).toThrowError(
      "DATA_IMPORT_TARGET_ENVIRONMENT is required for database writes",
    );
  });

  it("rejects a write whose requested and configured targets differ", () => {
    expect(() =>
      assertImportWriteTargetEnvironment("local", false, {
        DATA_IMPORT_TARGET_ENVIRONMENT: "production",
      }),
    ).toThrowError(
      "Import environment mismatch: --environment=local but DATA_IMPORT_TARGET_ENVIRONMENT=production",
    );
  });

  it("allows writes only when the target matches", () => {
    expect(() =>
      assertImportWriteTargetEnvironment("production", false, {
        DATA_IMPORT_TARGET_ENVIRONMENT: "production",
      }),
    ).not.toThrow();
  });

  it("allows a production-policy dry-run against a non-production target", () => {
    expect(() =>
      assertImportWriteTargetEnvironment("production", true, {
        DATA_IMPORT_TARGET_ENVIRONMENT: "local",
      }),
    ).not.toThrow();
  });
});
