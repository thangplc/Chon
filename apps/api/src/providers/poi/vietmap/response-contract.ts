import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);
const optionalString = z.string().trim().optional();

const boundarySchema = z
  .object({
    full_name: nonEmptyString.optional(),
    id: z.union([z.string(), z.number().int()]),
    name: nonEmptyString.optional(),
    prefix: nonEmptyString.optional(),
    type: z.number().int().min(0).max(10),
  })
  .passthrough();

const entryPointSchema = z
  .object({
    name: nonEmptyString,
    ref_id: nonEmptyString,
  })
  .passthrough();

const locationVariantSchema = z
  .object({
    address: nonEmptyString.optional(),
    boundaries: z.array(boundarySchema).max(20).optional(),
    display: nonEmptyString.optional(),
  })
  .passthrough();

const reverseLocationVariantSchema = locationVariantSchema
  .extend({
    distance: z.number().finite().nonnegative().optional(),
    lat: z.number().finite().min(-90).max(90).optional(),
    lng: z.number().finite().min(-180).max(180).optional(),
    name: optionalString,
  })
  .passthrough();

const poiResultSchema = z
  .object({
    address: nonEmptyString.optional(),
    boundaries: z.array(boundarySchema).max(20).default([]),
    categories: z.array(nonEmptyString).max(100).default([]),
    data_new: locationVariantSchema.nullable().optional(),
    data_old: locationVariantSchema.nullable().optional(),
    display: nonEmptyString.optional(),
    distance: z.number().finite().nonnegative().optional(),
    entry_points: z.array(entryPointSchema).max(100).default([]),
    lat: z.number().finite().min(-90).max(90).optional(),
    lng: z.number().finite().min(-180).max(180).optional(),
    name: nonEmptyString,
    ref_id: nonEmptyString,
  })
  .passthrough()
  .superRefine((value, context) => {
    if (!value.address && !value.display) {
      context.addIssue({
        code: "custom",
        message: "address or display is required",
        path: ["address"],
      });
    }
  });

export const vietmapSearchResponseSchema = z.array(poiResultSchema);

const placeResponseSchema = z
  .object({
    address: optionalString,
    city: optionalString,
    district: optionalString,
    display: optionalString,
    hs_num: optionalString,
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180),
    name: optionalString,
    street: optionalString,
    ward: optionalString,
  })
  .passthrough();

const reverseResultSchema = z
  .object({
    address: optionalString,
    boundaries: z.array(boundarySchema).max(20).default([]),
    data_new: reverseLocationVariantSchema.nullable().optional(),
    data_old: reverseLocationVariantSchema.nullable().optional(),
    display: optionalString,
    distance: z.number().finite().nonnegative().optional(),
    entry_points: z.array(entryPointSchema).max(100).nullable().optional(),
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180),
    name: optionalString,
    ref_id: nonEmptyString,
  })
  .passthrough();

export type VietmapSearchResult = z.output<typeof poiResultSchema>;
export type VietmapPlaceResponse = z.output<typeof placeResponseSchema>;
export type VietmapReverseResult = z.output<typeof reverseResultSchema>;

export class VietmapResponseValidationError extends Error {
  constructor(message: string) {
    super(`Invalid VIETMAP search response: ${message}`);
    this.name = "VietmapResponseValidationError";
  }
}

export function parseVietmapSearchResponse(
  payload: unknown,
): readonly VietmapSearchResult[] {
  const result = vietmapSearchResponseSchema.safeParse(payload);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  throw new VietmapResponseValidationError(
    issue
      ? `${issue.path.join(".") || "payload"}: ${issue.message}`
      : "payload must be an array of POI results",
  );
}

export function parseVietmapPlaceResponse(
  payload: unknown,
): VietmapPlaceResponse {
  const result = placeResponseSchema.safeParse(payload);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  throw new VietmapResponseValidationError(
    issue
      ? `place.${issue.path.join(".") || "payload"}: ${issue.message}`
      : "place payload must include numeric lat and lng",
  );
}

export function parseVietmapReverseResponse(
  payload: unknown,
): readonly VietmapReverseResult[] {
  const result = z.array(reverseResultSchema).max(100).safeParse(payload);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  throw new VietmapResponseValidationError(
    issue
      ? `reverse.${issue.path.join(".") || "payload"}: ${issue.message}`
      : "reverse payload must be an array of results",
  );
}
