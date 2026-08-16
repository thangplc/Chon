import { describe, expect, it } from "vitest";

import { exploreTestDataset } from "../testing/explore-test-dataset";
import { getExplorePlaces, getExploreTimeContext } from "./explore";

describe("getExplorePlaces", () => {
  it("ranks only matching simulated community reports for the selected time", () => {
    const results = getExplorePlaces(exploreTestDataset, {
      district: "all",
      purpose: "work",
      timeBucket: "morning",
    });

    expect(results[0]).toMatchObject({
      matchScore: 100,
      name: "Góc Test 01",
      reportCount: 2,
    });
    expect(results.find(({ id }) => id === "test_place_001")).toMatchObject({
      confidence: "medium",
      reportCount: 2,
    });
  });

  it("keeps places visible with no fabricated vibe score", () => {
    const results = getExplorePlaces(exploreTestDataset, {
      district: "Quận 1",
      purpose: "date",
      timeBucket: "midday",
    });

    expect(results).toHaveLength(2);
    expect(
      results.every(
        ({ confidence, matchScore, vibe }) =>
          confidence === "insufficient" && matchScore === null && vibe === null,
      ),
    ).toBe(true);
  });

  it("prefers canonical snapshots and preserves evidence metadata", () => {
    const dataset = {
      ...exploreTestDataset,
      vibes: [
        {
          confidence: { level: "high" as const, score: 0.86 },
          dayType: "weekday" as const,
          isSimulated: false,
          placeId: "test_place_001",
          providerSignalCount: 2,
          reportCount: 8,
          scores: {
            crowd: 2,
            lighting: 3,
            noise: 1,
            privacy: 4,
            socialEnergy: 2,
            workability: 5,
          },
          sourceDataTypes: ["community" as const],
          sourceProviders: ["foursquare_places"],
          timeBucket: "morning" as const,
        },
      ],
    };

    expect(
      getExplorePlaces(dataset, {
        district: "all",
        purpose: "work",
        timeBucket: "morning",
      }).find(({ id }) => id === "test_place_001"),
    ).toMatchObject({
      confidence: "high",
      providerSignalCount: 2,
      reportCount: 8,
      vibeIsSimulated: false,
    });
  });

  it("filters by a spatial result set and exact time context", () => {
    const context = getExploreTimeContext("2026-08-14", "19:30");
    expect(context).toEqual({ dayType: "friday", timeBucket: "evening" });

    const results = getExplorePlaces(exploreTestDataset, {
      dayType: context?.dayType,
      district: "all",
      placeIds: new Set(["test_place_002"]),
      purpose: "friends",
      timeBucket: context?.timeBucket ?? "morning",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("test_place_002");
  });

  it("filters space size and requires every selected amenity", () => {
    const bySize = getExplorePlaces(exploreTestDataset, {
      district: "all",
      purpose: "work",
      sizeCategories: new Set(["small"]),
      timeBucket: "morning",
    });
    expect(bySize.map(({ id }) => id)).toEqual(["test_place_001"]);

    const byAmenities = getExplorePlaces(exploreTestDataset, {
      amenities: new Set(["Wi-Fi", "Ổ cắm điện"]),
      district: "all",
      purpose: "work",
      timeBucket: "morning",
    });
    expect(byAmenities.map(({ id }) => id)).toEqual(["test_place_001"]);
  });

  it("filters price levels and keeps overlapping price ranges", () => {
    const byLevel = getExplorePlaces(exploreTestDataset, {
      district: "all",
      priceLevels: new Set([3]),
      purpose: "work",
      timeBucket: "morning",
    });
    expect(byLevel.map(({ id }) => id)).toEqual(["test_place_003"]);

    const upToForty = getExplorePlaces(exploreTestDataset, {
      district: "all",
      priceMax: 40_000,
      purpose: "work",
      timeBucket: "morning",
    });
    expect(upToForty.map(({ id }) => id)).toEqual(["test_place_001"]);

    const overTwoHundred = getExplorePlaces(exploreTestDataset, {
      district: "all",
      priceMin: 200_000,
      purpose: "work",
      timeBucket: "morning",
    });
    expect(overTwoHundred).toHaveLength(0);
  });

  it("changes the ranking when the selected purpose changes", () => {
    const dataset = {
      ...exploreTestDataset,
      reports: [],
      source: "database_mixed" as const,
      vibes: [
        {
          confidence: { level: "high" as const, score: 1 },
          dayType: "weekday" as const,
          isSimulated: true,
          placeId: "test_place_001",
          providerSignalCount: 0,
          reportCount: 2,
          scores: {
            crowd: 2,
            lighting: 2,
            noise: 1,
            privacy: 4,
            socialEnergy: 1,
            workability: 5,
          },
          sourceDataTypes: ["synthetic" as const],
          sourceProviders: [],
          timeBucket: "morning" as const,
        },
        {
          confidence: { level: "high" as const, score: 1 },
          dayType: "weekday" as const,
          isSimulated: true,
          placeId: "test_place_002",
          providerSignalCount: 0,
          reportCount: 2,
          scores: {
            crowd: 4,
            lighting: 4,
            noise: 4,
            privacy: 2,
            socialEnergy: 5,
            workability: 1,
          },
          sourceDataTypes: ["synthetic" as const],
          sourceProviders: [],
          timeBucket: "morning" as const,
        },
      ],
    };

    const workResults = getExplorePlaces(dataset, {
      district: "all",
      purpose: "work",
      timeBucket: "morning",
    });
    const friendsResults = getExplorePlaces(dataset, {
      district: "all",
      purpose: "friends",
      timeBucket: "morning",
    });

    expect(workResults[0]).toMatchObject({
      id: "test_place_001",
      matchScore: 100,
    });
    expect(friendsResults[0]).toMatchObject({
      id: "test_place_002",
      matchScore: 100,
    });
  });
});
