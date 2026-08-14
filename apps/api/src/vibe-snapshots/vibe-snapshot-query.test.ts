import { describe, expect, it } from "vitest";

import {
  parseVibeSnapshotQuery,
  VibeSnapshotQueryValidationError,
} from "./vibe-snapshot-query";

describe("vibe snapshot query", () => {
  it("parses optional API filters", () => {
    expect(
      parseVibeSnapshotQuery(
        new URLSearchParams({
          area_id: "11111111-1111-4111-8111-111111111111",
          day_type: "friday",
          time_bucket: "evening",
        }),
      ),
    ).toEqual({
      dayType: "friday",
      placeAreaId: "11111111-1111-4111-8111-111111111111",
      timeBucket: "evening",
    });
  });

  it("rejects unknown buckets and malformed area ids", () => {
    expect(() =>
      parseVibeSnapshotQuery(
        new URLSearchParams({
          area_id: "not-a-uuid",
          time_bucket: "night",
        }),
      ),
    ).toThrow(VibeSnapshotQueryValidationError);
  });
});
