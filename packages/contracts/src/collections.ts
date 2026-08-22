import { z } from "zod";

export const savedPlaceSchema = z.object({
  address: z.string(),
  district: z.string(),
  name: z.string(),
  savedAt: z.string().datetime(),
  slug: z.string(),
});

export const savedPlaceListResponseSchema = z.object({
  data: z.array(savedPlaceSchema),
});

export const savedPlaceStatusResponseSchema = z.object({
  data: z.object({
    saved: z.boolean(),
    savedAt: z.string().datetime().nullable(),
    slug: z.string(),
  }),
});

export type SavedPlace = z.infer<typeof savedPlaceSchema>;
export type SavedPlaceListResponse = z.infer<
  typeof savedPlaceListResponseSchema
>;
export type SavedPlaceStatusResponse = z.infer<
  typeof savedPlaceStatusResponseSchema
>;

export const collectionVisibilitySchema = z.enum(["private", "public"]);
export const collectionOwnerTypeSchema = z.enum(["user", "editorial"]);
export const collectionStatusSchema = z.enum(["draft", "published"]);

export const collectionSummarySchema = z.object({
  description: z.string().nullable(),
  id: z.string().uuid(),
  isDefault: z.boolean(),
  name: z.string(),
  ownerType: collectionOwnerTypeSchema,
  placeCount: z.number().int().nonnegative(),
  publishedAt: z.string().datetime().nullable(),
  slug: z.string(),
  status: collectionStatusSchema,
  visibility: collectionVisibilitySchema,
});

export const collectionPlaceSchema = savedPlaceSchema.extend({
  note: z.string().nullable(),
});

export const collectionDetailSchema = collectionSummarySchema.extend({
  places: z.array(collectionPlaceSchema),
});

export const collectionListResponseSchema = z.object({
  data: z.array(collectionSummarySchema),
});
export const collectionDetailResponseSchema = z.object({
  data: collectionDetailSchema,
});
export const collectionMutationSchema = z.object({
  description: z.string().trim().max(500).nullable().optional(),
  name: z.string().trim().min(1).max(120),
  visibility: collectionVisibilitySchema,
});

export type CollectionSummary = z.infer<typeof collectionSummarySchema>;
export type CollectionDetail = z.infer<typeof collectionDetailSchema>;
export type CollectionMutation = z.infer<typeof collectionMutationSchema>;
