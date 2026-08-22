import { describe, expect, it } from "vitest";

import {
  communityVibeReportInputSchema,
  vibeReportSubmissionResponseSchema,
} from "./vibe-report";

const validInput = {
  scores: { noise: 1, privacy: 4, workability: 5 },
  shortNote: "Buổi sáng khá yên tĩnh.",
  visitEvidenceMode: "on_site" as const,
  visitMode: "work" as const,
  visitedAt: "2026-08-17T02:00:00.000Z",
};

describe("community vibe report contract", () => {
  it("accepts a three-dimension report", () => {
    expect(communityVibeReportInputSchema.parse(validInput)).toMatchObject({
      visitMode: "work",
    });
  });

  it("accepts recalled visits but rejects current GPS evidence for them", () => {
    expect(
      communityVibeReportInputSchema.parse({
        ...validInput,
        visitEvidenceMode: "recalled",
      }),
    ).toMatchObject({ visitEvidenceMode: "recalled" });

    expect(() =>
      communityVibeReportInputSchema.parse({
        ...validInput,
        locationEvidence: {
          accuracyMeters: 30,
          capturedAt: "2026-08-17T02:00:00.000Z",
          latitude: 10.78,
          longitude: 106.7,
        },
        visitEvidenceMode: "recalled",
      }),
    ).toThrow("Recalled visits cannot include current location evidence");
  });

  it("requires at least three dimensions and bounds each score", () => {
    expect(() =>
      communityVibeReportInputSchema.parse({
        ...validInput,
        scores: { noise: 1, privacy: 4 },
      }),
    ).toThrow("At least three vibe dimensions are required");

    expect(() =>
      communityVibeReportInputSchema.parse({
        ...validInput,
        scores: { crowd: 0, noise: 1, privacy: 4 },
      }),
    ).toThrow();
  });

  it("accepts a published submission response", () => {
    expect(
      vibeReportSubmissionResponseSchema.parse({
        data: {
          id: "11111111-1111-4111-8111-111111111111",
          locationVerification: "verified",
          moderationStatus: "approved",
          placeId: "22222222-2222-4222-8222-222222222222",
          submittedAt: "2026-08-17T02:00:00.000Z",
        },
      }).data,
    ).toMatchObject({
      locationVerification: "verified",
      moderationStatus: "approved",
    });
  });
});
