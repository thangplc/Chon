import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ImportDatabaseClient } from "./database";
import { runDataImport } from "./runner";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, {
        force: true,
        recursive: true,
      }),
    ),
  );
});

function fakeClient(query = vi.fn()) {
  query.mockResolvedValue({ rowCount: 0, rows: [] });
  return {
    client: { query } as unknown as ImportDatabaseClient,
    query,
  };
}

async function createRealProductionSeed(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "chon-production-seed-"));
  temporaryDirectories.push(directory);
  await writeFile(
    join(directory, "places.csv"),
    [
      "internal_id,name,address,latitude,longitude,district,status,is_simulated",
      "real_place_001,Quán thật,1 Đường Thật,10.78,106.70,Quận 1,published,false",
    ].join("\n"),
  );
  await writeFile(
    join(directory, "editorial-vibe-reports.csv"),
    [
      "report_id,place_id,visited_at,visit_mode,noise,crowd,lighting,location_verification,data_type,is_simulated,verified_by,verified_at,moderation_status,source_note",
      "real_report_001,real_place_001,2025-01-01T09:00:00+07:00,work,2,2,3,verified,editorial,false,founder,2025-01-01T10:00:00+07:00,approved,Founder verified",
    ].join("\n"),
  );
  return directory;
}

describe("runDataImport environment policy", () => {
  it("rejects writes when the configured target differs before creating a client", async () => {
    const previousTarget = process.env.DATA_IMPORT_TARGET_ENVIRONMENT;
    process.env.DATA_IMPORT_TARGET_ENVIRONMENT = "production";

    try {
      const summary = await runDataImport({
        command: "seed",
        dryRun: false,
        environment: "local",
        input: { directory: "unused" },
        operatorId: "test-operator",
      });

      expect(summary.status).toBe("failed");
      expect(summary.issues).toContainEqual(
        expect.objectContaining({
          code: "import_environment_mismatch",
          message:
            "Import environment mismatch: --environment=local but DATA_IMPORT_TARGET_ENVIRONMENT=production",
        }),
      );
    } finally {
      if (previousTarget === undefined) {
        delete process.env.DATA_IMPORT_TARGET_ENVIRONMENT;
      } else {
        process.env.DATA_IMPORT_TARGET_ENVIRONMENT = previousTarget;
      }
    }
  });

  it("rejects production fixture records before querying the database", async () => {
    const { client, query } = fakeClient();
    const summary = await runDataImport(
      {
        command: "seed",
        dryRun: true,
        environment: "production",
        input: { directory: resolve("../../data/fixtures") },
        operatorId: "test-operator",
      },
      client,
      { manageTransaction: false },
    );

    expect(summary.status).toBe("failed");
    expect(summary.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "production_data_type_forbidden",
        }),
        expect.objectContaining({
          code: "production_simulated_record_forbidden",
        }),
      ]),
    );
    expect(query).not.toHaveBeenCalled();
  });

  it("allows a real editorial production dry-run without database writes", async () => {
    const directory = await createRealProductionSeed();
    const { client, query } = fakeClient();
    const summary = await runDataImport(
      {
        command: "seed",
        dryRun: true,
        environment: "production",
        input: { directory },
        operatorId: "test-operator",
      },
      client,
      { manageTransaction: false },
    );

    expect(summary.status).toBe("passed");
    expect(summary.dataTypes).toEqual({ editorial: 1 });
    expect(summary.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: expect.stringMatching(/^production_/),
        }),
      ]),
    );
    const statements = query.mock.calls.map(([statement]) => String(statement));
    expect(statements.length).toBeGreaterThan(0);
    expect(
      statements.every((statement) => /^\s*SELECT\b/i.test(statement)),
    ).toBe(true);
  });
});
