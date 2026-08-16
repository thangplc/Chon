import { describe, expect, it } from "vitest";

import {
  aggregateVibeReports,
  getConfidenceForReports,
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

  it("keeps missing dimensions null and groups by time context", () => {
    const snapshots = aggregateVibeReports([
      report({
        scores: { crowd: 2, noise: 2 },
      }),
      report({
        id: "report-2",
        scores: { crowd: 4, noise: null },
      }),
      report({
        id: "report-3",
        dayType: "weekend",
        timeBucket: "evening",
        scores: { crowd: 5, workability: 3 },
      }),
    ]);

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]).toMatchObject({
      dayType: "weekday",
      reportCount: 2,
      scores: {
        crowd: 3,
        lighting: null,
        noise: 2,
        privacy: null,
        socialEnergy: null,
        workability: null,
      },
      timeBucket: "morning",
    });
    expect(snapshots[1]).toMatchObject({
      dayType: "weekend",
      reportCount: 1,
      timeBucket: "evening",
    });
  });

  it("marks a group simulated only when every report is simulated", () => {
    const snapshots = aggregateVibeReports([
      report(),
      report({ id: "report-2", dataType: "community", isSimulated: false }),
    ]);

    expect(snapshots[0]).toMatchObject({
      isSimulated: false,
      sourceDataTypes: ["community", "synthetic"],
    });
  });

  it("returns low confidence for small samples", () => {
    expect(getConfidenceForReports([])).toEqual({ level: "low", score: 0 });
    expect(getConfidenceForReports([report()])).toEqual({
      level: "low",
      score: 0.39,
    });
    expect(
      getConfidenceForReports([report(), report({ id: "report-2" })]),
    ).toEqual({
      level: "low",
      score: 0.48,
    });
  });

  it("requires agreement before marking a large sample high confidence", () => {
    const agreeingReports = Array.from({ length: 8 }, (_, index) =>
      report({ id: `agree-${index}` }),
    );
    const disagreeingReports = Array.from({ length: 8 }, (_, index) =>
      report({
        id: `disagree-${index}`,
        scores: {
          crowd: index % 2 === 0 ? 1 : 5,
          lighting: index % 2 === 0 ? 1 : 5,
          noise: index % 2 === 0 ? 1 : 5,
          privacy: index % 2 === 0 ? 1 : 5,
          socialEnergy: index % 2 === 0 ? 1 : 5,
          workability: index % 2 === 0 ? 1 : 5,
        },
      }),
    );

    expect(getConfidenceForReports(agreeingReports)).toEqual({
      level: "high",
      score: 1,
    });
    expect(getConfidenceForReports(disagreeingReports)).toEqual({
      level: "medium",
      score: 0.7,
    });
  });

  it("rejects invalid local clock values", () => {
    expect(() => getTimeBucketForLocalTime(24, 0)).toThrow(RangeError);
    expect(() => getTimeBucketForLocalTime(12, 60)).toThrow(RangeError);
    expect(() => getTimeBucketForLocalTime(12.5, 0)).toThrow(RangeError);
  });
});
