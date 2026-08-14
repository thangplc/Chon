import { describe, expect, it } from "vitest";

import { exploreTestDataset } from "../testing/explore-test-dataset";
import { getExplorePlaces } from "./explore";

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
});
