import { z } from "zod";

const timeBucketSchema = z.enum([
  "morning",
  "midday",
  "afternoon",
  "evening",
  "late",
]);
const vibeScoresSchema = z.object({
  crowd: z.number().min(1).max(5),
  lighting: z.number().min(1).max(5),
  noise: z.number().min(1).max(5),
  privacy: z.number().min(1).max(5),
  socialEnergy: z.number().min(1).max(5),
  workability: z.number().min(1).max(5),
});

const exploreDatasetSchema = z.object({
  places: z.array(
    z.object({
      address: z.string(),
      currency: z.string().length(3),
      district: z.enum(["Quận 1", "Quận 3", "Bình Thạnh"]),
      id: z.string().uuid(),
      latitude: z.number(),
      longitude: z.number(),
      name: z.string(),
      slug: z.string(),
      typicalSpendMax: z.number().int().nonnegative().nullable(),
      typicalSpendMin: z.number().int().nonnegative().nullable(),
    }),
  ),
  reports: z.array(
    z.object({
      id: z.string(),
      placeId: z.string().uuid(),
      scores: vibeScoresSchema,
      timeBucket: timeBucketSchema,
    }),
  ),
  source: z.literal("database_simulated_csv"),
});

export const exploreDatasetResponseSchema = z.object({
  data: exploreDatasetSchema,
});

const placeDetailMediaSchema = z.object({
  altText: z.string(),
  height: z.number().int().positive(),
  id: z.string().uuid(),
  isSimulated: z.boolean(),
  sortOrder: z.number().int().min(0).max(4),
  sourceLabel: z.string(),
  sourceReference: z.string().nullable(),
  url: z.string(),
  width: z.number().int().positive(),
});

export const placeDetailResponseSchema = z.object({
  data: z.object({
    address: z.string(),
    description: z.string().nullable(),
    district: z.string(),
    id: z.string().uuid(),
    isSimulated: z.boolean(),
    latitude: z.number(),
    longitude: z.number(),
    media: z.array(placeDetailMediaSchema).max(5),
    name: z.string(),
    slug: z.string(),
  }),
});
