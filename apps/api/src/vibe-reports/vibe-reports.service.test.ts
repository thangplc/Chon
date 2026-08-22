import { describe, expect, it, vi } from "vitest";

import type { ApiEnvironment } from "../config/api-environment";
import type { ChonDatabase } from "../database/database.module";
import {
  determineLocationVerification,
  VibeReportValidationError,
  VibeReportsService,
} from "./vibe-reports.service";
import { VibeReportAbuseService } from "./vibe-report-abuse.service";

const user = {
  avatarUrl: null,
  displayName: "Chốn User",
  email: "user@example.com",
  id: "11111111-1111-4111-8111-111111111111",
  provider: "google" as const,
  status: "active" as const,
};

function createService(options?: {
  distanceMeters?: number;
  isSimulated?: boolean;
  environment?: string;
}) {
  const placeLimit = vi.fn().mockResolvedValue([
    {
      distanceMeters: options?.distanceMeters ?? null,
      id: "22222222-2222-4222-8222-222222222222",
      isSimulated: options?.isSimulated ?? false,
    },
  ]);
  const recentLimit = vi.fn().mockResolvedValue([]);
  const select = vi
    .fn()
    .mockImplementationOnce(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: placeLimit })),
      })),
    }))
    .mockImplementation(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: recentLimit })),
      })),
    }));
  const returning = vi.fn().mockResolvedValue([
    {
      id: "33333333-3333-4333-8333-333333333333",
      placeId: "22222222-2222-4222-8222-222222222222",
      submittedAt: new Date("2026-08-16T02:00:00.000Z"),
    },
  ]);
  const values = vi.fn((value: unknown) => {
    void value;
    return { returning };
  });
  const insert = vi.fn(() => ({ values }));
  const execute = vi.fn().mockResolvedValue(undefined);
  const transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
    callback({ execute, insert, select }),
  );
  const db = { insert, select, transaction } as unknown as ChonDatabase;
  const config = {
    get: vi.fn((key: keyof ApiEnvironment) => {
      if (key === "DATA_IMPORT_TARGET_ENVIRONMENT") {
        return options?.environment ?? "local";
      }
      if (key === "VIBE_REPORT_LIMIT_10_MINUTES") return 3;
      if (key === "VIBE_REPORT_LIMIT_24_HOURS") return 10;
      if (key === "VIBE_REPORT_PLACE_COOLDOWN_MINUTES") return 360;
      return undefined;
    }),
  };
  const rebuildForPlace = vi.fn().mockResolvedValue(1);

  return {
    db,
    insert,
    rebuildForPlace,
    service: new VibeReportsService(
      config as never,
      db,
      {
        rebuildForPlace,
      } as never,
      new VibeReportAbuseService(),
    ),
    values,
  };
}

describe("VibeReportsService", () => {
  it("classifies transient location evidence without persisting coordinates", () => {
    expect(determineLocationVerification(80, 30)).toBe("verified");
    expect(determineLocationVerification("300", 120)).toBe("approximate");
    expect(determineLocationVerification(700, 20)).toBe("none");
    expect(determineLocationVerification(null, undefined)).toBe("none");
  });

  it("publishes a valid community report and refreshes its snapshot", async () => {
    const { insert, rebuildForPlace, service, values } = createService();

    await expect(
      service.createForPlaceSlug(
        "goc-may-01",
        {
          scores: { noise: 1, privacy: 4, workability: 5 },
          shortNote: "Buổi sáng khá yên tĩnh.",
          visitEvidenceMode: "on_site",
          visitMode: "work",
          visitedAt: new Date(Date.now() - 60_000).toISOString(),
        },
        user,
      ),
    ).resolves.toMatchObject({
      id: "33333333-3333-4333-8333-333333333333",
      moderationStatus: "approved",
      placeId: "22222222-2222-4222-8222-222222222222",
    });

    expect(insert).toHaveBeenCalledOnce();
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        dataType: "community",
        isSimulated: false,
        locationVerification: "none",
        moderationStatus: "approved",
        userId: user.id,
      }),
    );
    expect(rebuildForPlace).toHaveBeenCalledWith(
      "22222222-2222-4222-8222-222222222222",
      "local",
    );
  });

  it("stores only the server-derived verification level", async () => {
    const { service, values } = createService({ distanceMeters: 80 });

    await expect(
      service.createForPlaceSlug(
        "goc-may-01",
        {
          locationEvidence: {
            accuracyMeters: 30,
            capturedAt: new Date().toISOString(),
            latitude: 10.78,
            longitude: 106.7,
          },
          scores: { noise: 1, privacy: 4, workability: 5 },
          visitEvidenceMode: "on_site",
          visitMode: "work",
          visitedAt: new Date(Date.now() - 60_000).toISOString(),
        },
        user,
      ),
    ).resolves.toMatchObject({ locationVerification: "verified" });

    const storedReport = values.mock.calls[0]?.[0];
    expect(storedReport).toMatchObject({ locationVerification: "verified" });
    expect(storedReport).not.toHaveProperty("latitude");
    expect(storedReport).not.toHaveProperty("longitude");
  });

  it("rejects invalid and future reports before writing", async () => {
    const { insert, service } = createService();

    await expect(
      service.createForPlaceSlug(
        "goc-may-01",
        {
          scores: { noise: 1, privacy: 4 },
          visitEvidenceMode: "on_site",
          visitMode: "work",
          visitedAt: "2026-08-16T02:00:00.000Z",
        },
        user,
      ),
    ).rejects.toBeInstanceOf(VibeReportValidationError);

    await expect(
      service.createForPlaceSlug(
        "goc-may-01",
        {
          scores: { noise: 1, privacy: 4, workability: 5 },
          visitEvidenceMode: "on_site",
          visitMode: "work",
          visitedAt: "2099-08-16T02:00:00.000Z",
        },
        user,
      ),
    ).rejects.toThrow("visitedAt cannot be in the future");

    expect(insert).not.toHaveBeenCalled();
  });

  it("does not expose simulated places as production contribution targets", async () => {
    const { service } = createService({
      environment: "production",
      isSimulated: true,
    });

    await expect(
      service.createForPlaceSlug(
        "fixture-place",
        {
          scores: { noise: 1, privacy: 4, workability: 5 },
          visitEvidenceMode: "on_site",
          visitMode: "work",
          visitedAt: "2026-08-16T02:00:00.000Z",
        },
        user,
      ),
    ).rejects.toThrow("Place is not publicly available");
  });

  it("stores recalled visits without using current location evidence", async () => {
    const { service, values } = createService({ distanceMeters: 20 });

    await expect(
      service.createForPlaceSlug(
        "goc-may-01",
        {
          scores: { noise: 1, privacy: 4, workability: 5 },
          visitEvidenceMode: "recalled",
          visitMode: "work",
          visitedAt: new Date(Date.now() - 86_400_000).toISOString(),
        },
        user,
      ),
    ).resolves.toMatchObject({ locationVerification: "recalled" });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ locationVerification: "recalled" }),
    );
  });
});
