import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { VibeReportRateLimitError } from "./vibe-report-abuse.service";
import { VibeReportsController } from "./vibe-reports.controller";

describe("VibeReportsController", () => {
  it("maps an abuse limit to HTTP 429 and Retry-After", async () => {
    const createForPlaceSlug = vi
      .fn()
      .mockRejectedValue(new VibeReportRateLimitError(480, "place_cooldown"));
    const controller = new VibeReportsController({
      createForPlaceSlug,
    } as never);
    const setHeader = vi.fn();

    try {
      await controller.create(
        "goc-may-01",
        {},
        {
          authUser: {
            avatarUrl: null,
            displayName: "Chốn User",
            email: "user@example.com",
            id: "11111111-1111-4111-8111-111111111111",
            provider: "google",
            status: "active",
          },
        } as never,
        { setHeader },
      );
      throw new Error("Expected controller to reject the request");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as HttpException).getResponse()).toMatchObject({
        code: "vibe_report_rate_limited",
        retryAfterSeconds: 480,
      });
    }

    expect(setHeader).toHaveBeenCalledWith("Retry-After", 480);
  });
});
