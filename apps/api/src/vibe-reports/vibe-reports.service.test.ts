import { describe, expect, it, vi } from "vitest";

import type { ApiEnvironment } from "../config/api-environment";
import type { ChonDatabase } from "../database/database.module";
import {
  determineLocationVerification,
  VibeReportValidationError,
  VibeReportsService,
} from "./vibe-reports.service";

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
  const limit = vi.fn().mockResolvedValue([
    {
      distanceMeters: options?.distanceMeters ?? null,
      id: "22222222-2222-4222-8222-222222222222",
      isSimulated: options?.isSimulated ?? false,
    },
  ]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
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
  const db = { insert, select } as unknown as ChonDatabase;
  const config = {
    get: vi.fn((key: keyof ApiEnvironment) => {
      if (key === "DATA_IMPORT_TARGET_ENVIRONMENT") {
        return options?.environment ?? "local";
      }
      return undefined;
    }),
  };

  return {
    db,
    insert,
    service: new VibeReportsService(config as never, db),
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

  it("creates a pending community report with server-owned provenance", async () => {
    const { insert, service, values } = createService();

    await expect(
      service.createForPlaceSlug(
        "goc-may-01",
        {
          scores: { noise: 1, privacy: 4, workability: 5 },
          shortNote: "Buổi sáng khá yên tĩnh.",
          visitMode: "work",
          visitedAt: new Date(Date.now() - 60_000).toISOString(),
        },
        user,
      ),
    ).resolves.toMatchObject({
      id: "33333333-3333-4333-8333-333333333333",
      moderationStatus: "pending",
      placeId: "22222222-2222-4222-8222-222222222222",
    });

    expect(insert).toHaveBeenCalledOnce();
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        dataType: "community",
        isSimulated: false,
        locationVerification: "none",
        moderationStatus: "pending",
        userId: user.id,
      }),
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
          visitMode: "work",
          visitedAt: "2026-08-16T02:00:00.000Z",
        },
        user,
      ),
    ).rejects.toThrow("Place is not publicly available");
  });
});
