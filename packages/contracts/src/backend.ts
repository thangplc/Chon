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

const openingHoursPeriodSchema = z
  .object({
    closes: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u),
    opens: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u),
  })
  .strict();

const openingHoursSchema = z
  .object({
    timezone: z.literal("Asia/Ho_Chi_Minh"),
    weekly: z
      .object({
        friday: z.array(openingHoursPeriodSchema).max(4),
        monday: z.array(openingHoursPeriodSchema).max(4),
        saturday: z.array(openingHoursPeriodSchema).max(4),
        sunday: z.array(openingHoursPeriodSchema).max(4),
        thursday: z.array(openingHoursPeriodSchema).max(4),
        tuesday: z.array(openingHoursPeriodSchema).max(4),
        wednesday: z.array(openingHoursPeriodSchema).max(4),
      })
      .strict(),
  })
  .strict()
  .superRefine(({ weekly }, context) => {
    for (const [weekday, periods] of Object.entries(weekly)) {
      let previousClose = -1;
      periods.forEach((period, index) => {
        const [openHour, openMinute] = period.opens.split(":").map(Number);
        const [closeHour, closeMinute] = period.closes.split(":").map(Number);
        const opens = openHour * 60 + openMinute;
        const closes = closeHour * 60 + closeMinute;
        if (closes <= opens || opens < previousClose) {
          context.addIssue({
            code: "custom",
            message:
              "opening periods must be ordered, non-overlapping and same-day",
            path: ["weekly", weekday, index],
          });
        }
        previousClose = closes;
      });
    }
  });

const placeDetailAreaSchema = z
  .object({
    description: z.string().nullable(),
    id: z.string().uuid(),
    isSimulated: z.boolean(),
    name: z.string().min(1),
  })
  .strict();

export const placeDetailResponseSchema = z.object({
  data: z.object({
    address: z.string(),
    areas: z.array(placeDetailAreaSchema).max(20),
    currency: z.string().length(3),
    description: z.string().nullable(),
    district: z.string(),
    estimatedCapacity: z.number().int().positive().nullable(),
    id: z.string().uuid(),
    isSimulated: z.boolean(),
    latitude: z.number(),
    longitude: z.number(),
    media: z.array(placeDetailMediaSchema).max(5),
    name: z.string(),
    openingHours: openingHoursSchema.nullable(),
    priceLevel: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
      .nullable(),
    sizeCategory: z.enum(["small", "medium", "large", "unknown"]),
    slug: z.string(),
    typicalSpendMax: z.number().int().nonnegative().nullable(),
    typicalSpendMin: z.number().int().nonnegative().nullable(),
  }),
});
