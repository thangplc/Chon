import { describe, expect, it } from "vitest";

import { purposes } from "./explore-contract";
import { purposePreferences } from "./purpose-preferences";

const dimensions = [
  "crowd",
  "lighting",
  "noise",
  "privacy",
  "socialEnergy",
  "workability",
] as const;

describe("purposePreferences", () => {
  it("defines a complete normalized preference for every purpose", () => {
    expect(Object.keys(purposePreferences).sort()).toEqual(
      purposes.map(({ id }) => id).sort(),
    );

    for (const purpose of purposes) {
      const preference = purposePreferences[purpose.id];
      expect(
        dimensions.every(
          (dimension) =>
            preference.targets[dimension] >= 1 &&
            preference.targets[dimension] <= 5 &&
            preference.weights[dimension] >= 0,
        ),
      ).toBe(true);
      expect(
        dimensions.reduce(
          (total, dimension) => total + preference.weights[dimension],
          0,
        ),
      ).toBe(100);
    }
  });
});
