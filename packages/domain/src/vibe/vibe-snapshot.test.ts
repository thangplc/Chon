import { describe, expect, it } from "vitest";

import {
  aggregateVibeReports,
  getDayTypeForDate,
  getTimeBucketForDate,
  getTimeBucketForLocalTime,
  type VibeReportForAggregation,
} from "./vibe-snapshot";

const report = (
  overrides: Partial<VibeReportForAggregation> = {},
): VibeReportForAggregation => ({
  dataType: "synthetic",
  dayType: "weekday",
  id: "report-1",
  isSimulated: true,
  placeAreaId: null,
  placeId: "place-1",
  scores: {
    crowd: 2,
    lighting: 3,
    noise: 1,
    privacy: 4,
    socialEnergy: 2,
    workability: 5,
  },
  timeBucket: "morning",
  visitedAt: new Date("2026-08-10T02:00:00.000Z"),
  ...overrides,
});

describe("vibe snapshot domain", () => {
  it("maps the documented local time ranges", () => {
    expect(getTimeBucketForLocalTime(5, 59)).toBe("late");
    expect(getTimeBucketForLocalTime(6, 0)).toBe("morning");
    expect(getTimeBucketForLocalTime(10, 59)).toBe("morning");
    expect(getTimeBucketForLocalTime(11, 0)).toBe("midday");
    expect(getTimeBucketForLocalTime(14, 0)).toBe("afternoon");
    expect(getTimeBucketForLocalTime(18, 0)).toBe("evening");
    expect(getTimeBucketForLocalTime(22, 0)).toBe("late");
  });

  it("uses the place timezone when deriving day and time context", () => {
    const date = new Date("2026-08-13T23:30:00.000Z");

    expect(getDayTypeForDate(date, "Asia/Ho_Chi_Minh")).toBe("friday");
    expect(getTimeBucketForDate(date, "Asia/Ho_Chi_Minh")).toBe("morning");
  });

  it("aggregates grouped reports with median scores and provenance", () => {
    const snapshots = aggregateVibeReports([
      report(),
      report({
        id: "report-2",
        scores: {
          crowd: 4,
          lighting: 3,
          noise: 3,
          privacy: 2,
          socialEnergy: 4,
          workability: 3,
        },
      }),
      report({
        dataType: "community",
        id: "report-3",
      }),
    ]);

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      confidenceLevel: "medium",
      dayType: "weekday",
      placeAreaId: null,
      reportCount: 3,
      scores: {
        crowd: 2,
        lighting: 3,
        noise: 1,
        privacy: 4,
        socialEnergy: 2,
        workability: 5,
      },
      sourceDataTypes: ["community", "synthetic"],
      timeBucket: "morning",
    });
  });
});
