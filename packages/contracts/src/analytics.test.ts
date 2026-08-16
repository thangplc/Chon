import { describe, expect, it } from "vitest";

import { analyticsEventSchema } from "./analytics";

const payload = {
  amenityCount: 1,
  dayType: "weekday" as const,
  district: "Quận 3" as const,
  durationMinutes: 120,
  priceLevelCount: 0,
  priceRangeId: "any" as const,
  purpose: "work" as const,
  resultCount: 3,
  sizeCount: 0,
  timeBucket: "morning" as const,
};

describe("analytics contract", () => {
  it("accepts privacy-safe Explore events", () => {
    expect(
      analyticsEventSchema.parse({
        eventName: "explore_filter_changed",
        payload,
        sessionId: "anon_1234567890",
      }),
    ).toMatchObject({ eventName: "explore_filter_changed" });
  });

  it("rejects free-form or sensitive fields", () => {
    expect(() =>
      analyticsEventSchema.parse({
        eventName: "explore_results_viewed",
        payload: { ...payload, query: "Nguyễn Huệ" },
        sessionId: "anon_1234567890",
      }),
    ).toThrow();
  });
});
