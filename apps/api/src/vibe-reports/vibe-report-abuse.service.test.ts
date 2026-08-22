import { describe, expect, it } from "vitest";

import {
  type RecentCommunityReport,
  VibeReportAbuseService,
  VibeReportDuplicateError,
  VibeReportRateLimitError,
} from "./vibe-report-abuse.service";

const now = new Date("2026-08-22T03:00:00.000Z");
const placeId = "22222222-2222-4222-8222-222222222222";
const candidate = {
  scores: { noise: 2, privacy: 4, workability: 5 },
  seatAvailability: "normal",
  shortNote: "Yên tĩnh",
  visitMode: "work",
  visitedAt: new Date("2026-08-22T02:00:00.000Z"),
};
const limits = {
  limitPerDay: 10,
  limitPerTenMinutes: 3,
  placeCooldownMinutes: 360,
};

function report(
  overrides: Partial<RecentCommunityReport> = {},
): RecentCommunityReport {
  return {
    crowd: null,
    lighting: null,
    noise: 1,
    placeId: "33333333-3333-4333-8333-333333333333",
    privacy: 3,
    seatAvailability: "unknown",
    shortNote: null,
    socialEnergy: null,
    submittedAt: new Date("2026-08-22T02:55:00.000Z"),
    visitMode: "study",
    visitedAt: new Date("2026-08-22T01:00:00.000Z"),
    workability: 4,
    ...overrides,
  };
}

describe("VibeReportAbuseService", () => {
  const service = new VibeReportAbuseService();

  it("allows a contribution below every limit", () => {
    expect(() =>
      service.assertAllowed([report()], placeId, candidate, limits, now),
    ).not.toThrow();
  });

  it("blocks identical contributions before applying cooldown", () => {
    expect(() =>
      service.assertAllowed(
        [
          report({
            noise: 2,
            placeId,
            privacy: 4,
            seatAvailability: "normal",
            shortNote: "  YÊN TĨNH ",
            visitMode: "work",
            visitedAt: new Date("2026-08-22T02:05:00.000Z"),
            workability: 5,
          }),
        ],
        placeId,
        candidate,
        limits,
        now,
      ),
    ).toThrow(VibeReportDuplicateError);
  });

  it("blocks burst, daily and same-place limits with retry metadata", () => {
    expect(() =>
      service.assertAllowed(
        [report(), report(), report()],
        placeId,
        candidate,
        limits,
        now,
      ),
    ).toThrow(VibeReportRateLimitError);

    expect(() =>
      service.assertAllowed(
        Array.from({ length: 10 }, (_, index) =>
          report({
            submittedAt: new Date(
              now.getTime() - (index + 1) * 60 * 60 * 1_000,
            ),
          }),
        ),
        placeId,
        candidate,
        limits,
        now,
      ),
    ).toThrow(VibeReportRateLimitError);

    try {
      service.assertAllowed(
        [report({ placeId, submittedAt: new Date(now.getTime() - 60_000) })],
        placeId,
        candidate,
        limits,
        now,
      );
      throw new Error("Expected cooldown to reject the report");
    } catch (error) {
      expect(error).toMatchObject({
        reason: "place_cooldown",
        retryAfterSeconds: 21_540,
      });
    }
  });
});
