import { z } from "zod";

const purposeSchema = z.enum([
  "work",
  "study",
  "solo",
  "date",
  "friends",
  "business_meeting",
  "relax",
  "late_night",
]);
const dayTypeSchema = z.enum(["weekday", "friday", "weekend"]);
const timeBucketSchema = z.enum([
  "morning",
  "midday",
  "afternoon",
  "evening",
  "late",
]);
const districtSchema = z.string().min(1).max(64);
const priceRangeSchema = z.enum([
  "any",
  "under-50",
  "50-100",
  "100-200",
  "over-200",
]);

const exploreContextSchema = z
  .object({
    dayType: dayTypeSchema,
    district: districtSchema.nullable(),
    durationMinutes: z.number().int().min(15).max(720),
    priceLevelCount: z.number().int().min(0).max(4),
    priceRangeId: priceRangeSchema,
    purpose: purposeSchema,
    resultCount: z.number().int().nonnegative().max(10_000),
    sizeCount: z.number().int().min(0).max(4),
    amenityCount: z.number().int().min(0).max(100),
    timeBucket: timeBucketSchema,
  })
  .strict();

const sessionIdSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{8,64}$/u, "invalid anonymous session id");

const placeSlugSchema = z
  .string()
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);

const placeSavePayloadSchema = z
  .object({
    collectionType: z.enum(["default", "custom"]),
    placeSlug: placeSlugSchema,
    surface: z.enum(["explore", "place_detail"]),
  })
  .strict();

const collectionSharePayloadSchema = z
  .object({
    collectionId: z.string().uuid(),
    ownerType: z.enum(["user", "editorial"]),
    placeCount: z.number().int().nonnegative().max(10_000),
  })
  .strict();

const directionsPayloadSchema = z
  .object({
    placeSlug: placeSlugSchema,
    provider: z.literal("openstreetmap"),
    surface: z.enum(["place_detail", "public_collection"]),
  })
  .strict();

export const analyticsEventSchema = z.discriminatedUnion("eventName", [
  z.object({
    eventName: z.literal("explore_filter_changed"),
    payload: exploreContextSchema,
    sessionId: sessionIdSchema,
  }),
  z.object({
    eventName: z.literal("explore_results_viewed"),
    payload: exploreContextSchema,
    sessionId: sessionIdSchema,
  }),
  z.object({
    eventName: z.literal("explore_share_clicked"),
    payload: exploreContextSchema,
    sessionId: sessionIdSchema,
  }),
  z.object({
    eventName: z.literal("place_save_succeeded"),
    payload: placeSavePayloadSchema,
    sessionId: sessionIdSchema,
  }),
  z.object({
    eventName: z.literal("collection_share_clicked"),
    payload: collectionSharePayloadSchema,
    sessionId: sessionIdSchema,
  }),
  z.object({
    eventName: z.literal("directions_opened"),
    payload: directionsPayloadSchema,
    sessionId: sessionIdSchema,
  }),
]);

export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;
export type AnalyticsEventPayload = AnalyticsEvent["payload"];
export type AnalyticsEventName = AnalyticsEvent["eventName"];
export type AnalyticsPayloadFor<TName extends AnalyticsEventName> = Extract<
  AnalyticsEvent,
  { eventName: TName }
>["payload"];
