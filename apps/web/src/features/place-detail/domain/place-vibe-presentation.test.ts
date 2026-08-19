import type { VibeSnapshotApiItem } from "@chon/contracts/backend";
import { describe, expect, it } from "vitest";

import {
  buildPlaceVibePresentation,
  type PlaceDetailIntent,
} from "./place-vibe-presentation";

const intent: PlaceDetailIntent = {
  dayType: "weekend",
  purpose: "work",
  purposeLabel: "Làm việc",
  timeBucket: "morning",
  timeLabel: "09:00",
};

function snapshot(
  overrides: Partial<VibeSnapshotApiItem> = {},
): VibeSnapshotApiItem {
  return {
    aggregationVersion: "fusion-v1",
    component: "canonical",
    confidence: { level: "medium", score: 0.6 },
    dayType: "weekday",
    generatedAt: new Date("2026-08-19T02:00:00Z"),
    isSimulated: false,
    lastReportAt: new Date("2026-08-19T02:00:00Z"),
    placeAreaId: null,
    placeId: "22222222-2222-4222-8222-222222222222",
    providerSignalCount: 0,
    reportCount: 3,
    scores: {
      crowd: 2,
      lighting: 3,
      noise: 1,
      privacy: 4,
      socialEnergy: 2,
      workability: 5,
    },
    sourceDataTypes: ["community"],
    sourceProviders: [],
    timeBucket: "morning",
    ...overrides,
  };
}

describe("buildPlaceVibePresentation", () => {
  it("selects the requested context and derives explainable ranking", () => {
    const weekend = snapshot({ dayType: "weekend", reportCount: 7 });
    const result = buildPlaceVibePresentation([snapshot(), weekend], intent);

    expect(result.snapshot).toBe(weekend);
    expect(result.matchScore).toBeTypeOf("number");
    expect(result.explanation.reasons.length).toBeGreaterThan(0);
  });

  it("keeps incomplete snapshots honest", () => {
    const result = buildPlaceVibePresentation(
      [snapshot({ scores: { ...snapshot().scores, noise: null } })],
      intent,
    );

    expect(result.matchScore).toBeNull();
    expect(result.scores).toBeNull();
    expect(result.explanation.reasons).toEqual([]);
  });
});
