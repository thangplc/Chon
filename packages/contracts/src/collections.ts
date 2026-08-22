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
