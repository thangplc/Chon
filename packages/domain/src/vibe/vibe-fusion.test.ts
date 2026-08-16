import { describe, expect, it } from "vitest";

import type { VibeSnapshot } from "./vibe-snapshot";
import { fuseVibeSnapshots } from "./vibe-fusion";

const context = {
  dayType: "weekday" as const,
  placeAreaId: null,
  placeId: "place-1",
  timeBucket: "morning" as const,
};

const contribution: VibeSnapshot = {
  aggregationVersion: "v1",
  component: "contribution",
  confidenceLevel: "medium",
  confidenceScore: 0.6,
  dayType: "weekday",
  isSimulated: false,
  lastReportAt: new Date("2026-08-15T02:00:00Z"),
  placeAreaId: null,
  placeId: "place-1",
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
  timeBucket: "morning",
};

const providerSignal = {
  confidenceScore: 0.5,
  isSimulated: false,
  observedAt: new Date("2026-08-16T02:00:00Z"),
  provider: "foursquare_places",
  providerProduct: "places_premium",
  retrievedAt: new Date("2026-08-16T03:00:00Z"),
  scores: {
    crowd: 4,
    lighting: null,
    noise: 3,
    privacy: null,
    socialEnergy: null,
    workability: null,
  },
};

describe("vibe fusion", () => {
  it("returns one canonical result and keeps provider provenance separate", () => {
    const result = fuseVibeSnapshots(contribution, [providerSignal], context);

    expect(result).toMatchObject({
      component: "canonical",
      confidenceLevel: "medium",
      dayType: "weekday",
      isSimulated: false,
      placeId: "place-1",
      providerSignalCount: 1,
      reportCount: 3,
      sourceDataTypes: ["community"],
      sourceProviders: ["foursquare_places"],
      timeBucket: "morning",
    });
    expect(result?.scores.crowd).toBeGreaterThan(2);
    expect(result?.scores.noise).toBeGreaterThan(1);
  });

  it("does not mix synthetic contribution with provider evidence", () => {
    const result = fuseVibeSnapshots(
      { ...contribution, isSimulated: true, sourceDataTypes: ["synthetic"] },
      [providerSignal],
      context,
    );

    expect(result?.scores).toEqual(contribution.scores);
    expect(result?.providerSignalCount).toBe(0);
    expect(result?.sourceProviders).toEqual([]);
    expect(result?.isSimulated).toBe(true);
  });

  it("can produce a provider-only result when provider dimensions are allowed", () => {
    const result = fuseVibeSnapshots(null, [providerSignal], context);

    expect(result).toMatchObject({
      component: "canonical",
      confidenceLevel: "medium",
      providerSignalCount: 1,
      reportCount: 0,
      sourceDataTypes: [],
      sourceProviders: ["foursquare_places"],
    });
    expect(result?.scores.crowd).toBe(4);
  });

  it("keeps provider support below high confidence without enough reports", () => {
    const result = fuseVibeSnapshots(
      { ...contribution, confidenceScore: 0.6 },
      [{ ...providerSignal, confidenceScore: 1 }],
      context,
    );

    expect(result).toMatchObject({
      confidenceLevel: "medium",
      confidenceScore: 0.68,
      providerSignalCount: 1,
      reportCount: 3,
    });
  });

  it("ignores provider signals without usable evidence", () => {
    const result = fuseVibeSnapshots(
      contribution,
      [
        { ...providerSignal, confidenceScore: 0 },
        { ...providerSignal, isSimulated: true, provider: "google_places" },
        {
          ...providerSignal,
          provider: "yelp_places",
          scores: {
            crowd: null,
            lighting: null,
            noise: null,
            privacy: null,
            socialEnergy: null,
            workability: null,
          },
        },
      ],
      context,
    );

    expect(result).toMatchObject({
      providerSignalCount: 0,
      sourceProviders: [],
    });
    expect(result?.scores).toEqual(contribution.scores);
  });

  it("returns no canonical result when neither component has scores", () => {
    const result = fuseVibeSnapshots(
      null,
      [
        {
          ...providerSignal,
          scores: {
            crowd: null,
            lighting: null,
            noise: null,
            privacy: null,
            socialEnergy: null,
            workability: null,
          },
        },
      ],
      context,
    );

    expect(result).toBeNull();
  });

  it("rejects invalid provider weights", () => {
    expect(() =>
      fuseVibeSnapshots(contribution, [], context, { providerWeight: 1.1 }),
    ).toThrow("providerWeight must be between 0 and 1");
  });
});
