import { z } from "zod";

export const vibeReportVisitModeSchema = z.enum([
  "work",
  "study",
  "solo",
  "date",
  "friends",
  "business_meeting",
  "relax",
  "late_night",
]);

export type VibeReportVisitMode = z.infer<typeof vibeReportVisitModeSchema>;

export const vibeReportDimensionSchema = z.enum([
  "noise",
  "crowd",
  "lighting",
  "privacy",
  "workability",
  "socialEnergy",
]);

export type VibeReportDimension = z.infer<typeof vibeReportDimensionSchema>;

export const locationEvidenceSchema = z
  .object({
    accuracyMeters: z.number().finite().min(0).max(5_000),
    capturedAt: z.string().datetime({ offset: true }),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  })
  .strict();

const scoreSchema = z.number().int().min(1).max(5);

const scoresSchema = z
  .object({
    crowd: scoreSchema.optional(),
    lighting: scoreSchema.optional(),
    noise: scoreSchema.optional(),
    privacy: scoreSchema.optional(),
    socialEnergy: scoreSchema.optional(),
    workability: scoreSchema.optional(),
  })
  .strict()
  .superRefine((scores, context) => {
    const answered = Object.values(scores).filter(
      (value) => typeof value === "number",
    ).length;
    if (answered < 3) {
      context.addIssue({
        code: "custom",
        message: "At least three vibe dimensions are required",
        path: [],
      });
    }
  });

export const communityVibeReportInputSchema = z
  .object({
    locationEvidence: locationEvidenceSchema.optional(),
    seatAvailability: z
      .enum(["easy", "normal", "difficult", "unknown"])
      .optional(),
    scores: scoresSchema,
    shortNote: z.string().trim().min(1).max(140).optional(),
    visitMode: vibeReportVisitModeSchema,
    visitedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type CommunityVibeReportInput = z.infer<
  typeof communityVibeReportInputSchema
>;

export const vibeReportSubmissionResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    locationVerification: z.enum(["none", "approximate", "verified"]),
    moderationStatus: z.literal("pending"),
    placeId: z.string().uuid(),
    submittedAt: z.coerce.date(),
  }),
});

export type VibeReportSubmissionResponse = z.infer<
  typeof vibeReportSubmissionResponseSchema
>;
