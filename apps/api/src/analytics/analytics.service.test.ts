import { describe, expect, it, vi } from "vitest";

import type { ChonDatabase } from "../database/database.module";
import {
  AnalyticsEventValidationError,
  AnalyticsService,
} from "./analytics.service";

const payload = {
  amenityCount: 0,
  dayType: "weekday" as const,
  district: null,
  durationMinutes: 120,
  priceLevelCount: 0,
  priceRangeId: "any" as const,
  purpose: "work" as const,
  resultCount: 3,
  sizeCount: 0,
  timeBucket: "morning" as const,
};

describe("AnalyticsService", () => {
  it("persists an accepted event without raw search text", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const service = new AnalyticsService({
      insert: vi.fn(() => ({ values })),
    } as unknown as ChonDatabase);

    await expect(
      service.recordEvent({
        eventName: "explore_results_viewed",
        payload,
        sessionId: "anon_1234567890",
      }),
    ).resolves.toEqual({ accepted: true });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "explore_results_viewed",
        payload,
        sessionId: "anon_1234567890",
      }),
    );
  });

  it("rejects invalid events before touching the database", async () => {
    const insert = vi.fn();
    const service = new AnalyticsService({ insert } as unknown as ChonDatabase);

    await expect(
      service.recordEvent({ eventName: "unknown" }),
    ).rejects.toBeInstanceOf(AnalyticsEventValidationError);
    expect(insert).not.toHaveBeenCalled();
  });
});
