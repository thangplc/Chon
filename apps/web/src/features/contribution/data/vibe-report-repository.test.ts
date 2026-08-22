import { afterEach, describe, expect, it, vi } from "vitest";

import {
  submitCommunityVibeReport,
  VibeReportSubmissionError,
} from "./vibe-report-repository";

const input = {
  scores: { noise: 2, privacy: 4, workability: 5 },
  visitEvidenceMode: "recalled" as const,
  visitMode: "work" as const,
  visitedAt: "2026-08-22T02:00:00.000Z",
};

describe("vibe report repository", () => {
  afterEach(() => vi.restoreAllMocks());

  it("preserves structured retry details from a rate-limit response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "vibe_report_rate_limited",
          detail:
            "Bạn vừa góp vibe cho địa điểm này. Hãy thử lại sau 8 phút.",
          retryAfterSeconds: 480,
          status: 429,
        }),
        { status: 429 },
      ),
    );

    try {
      await submitCommunityVibeReport("goc-may-01", input);
      throw new Error("Expected rate limit response to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(VibeReportSubmissionError);
      expect(error).toMatchObject({
        code: "vibe_report_rate_limited",
        message:
          "Bạn vừa góp vibe cho địa điểm này. Hãy thử lại sau 8 phút.",
        retryAfterSeconds: 480,
      });
    }
  });
});
