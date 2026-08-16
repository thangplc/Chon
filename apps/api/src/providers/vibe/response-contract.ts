import { z } from "zod";

import type { ProviderVibeProvider } from "./config";
import { asProviderPayload, type ProviderPayload } from "./adapters/common";

export const PROVIDER_VIBE_RESPONSE_CONTRACT_VERSION = "v1" as const;

const boundedRating = z.number().finite().min(0).max(5);
const boundedPopularity = z.number().finite().min(0).max(1);
const nonNegativeNumber = z.number().finite().nonnegative();
const nonEmptyString = z.string().trim().min(1);
const stringArray = z.array(nonEmptyString).max(100);
const objectOrArray = z.union([
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);

const foursquareResponseSchema = z
  .object({
    amenities: stringArray.optional(),
    hours_popular: objectOrArray.optional(),
    popularity: boundedPopularity.optional(),
    price: z.union([z.number().int().min(1).max(4), nonEmptyString]).optional(),
    rating: boundedRating.optional(),
    tastes: stringArray.optional(),
  })
  .passthrough();

const googleResponseSchema = z
  .object({
    amenities: stringArray.optional(),
    priceLevel: z
      .union([nonEmptyString, z.number().int().min(0).max(4)])
      .optional(),
    price_level: z
      .union([nonEmptyString, z.number().int().min(0).max(4)])
      .optional(),
    rating: boundedRating.optional(),
    userRatingCount: nonNegativeNumber.optional(),
    user_ratings_total: nonNegativeNumber.optional(),
  })
  .passthrough();

const yelpResponseSchema = z
  .object({
    price: nonEmptyString.optional(),
    rating: boundedRating.optional(),
    review_highlight_count: z.number().int().nonnegative().optional(),
  })
  .passthrough();

const tripadvisorResponseSchema = z
  .object({
    price: z.union([z.number().int().min(1).max(4), nonEmptyString]).optional(),
    ranking: nonNegativeNumber.optional(),
    rating: boundedRating.optional(),
    review_breakdown: objectOrArray.optional(),
    tripTypes: stringArray.optional(),
    trip_types: stringArray.optional(),
  })
  .passthrough();

const responseSchemas = {
  foursquare_places: foursquareResponseSchema,
  google_places: googleResponseSchema,
  tripadvisor: tripadvisorResponseSchema,
  yelp: yelpResponseSchema,
} as const;

export type ProviderVibeValidatedPayload = ProviderPayload;

export class ProviderVibeResponseValidationError extends Error {
  constructor(provider: ProviderVibeProvider, message: string) {
    super(
      `Invalid ${provider} response (${PROVIDER_VIBE_RESPONSE_CONTRACT_VERSION}): ${message}`,
    );
    this.name = "ProviderVibeResponseValidationError";
  }
}

export function parseProviderVibeResponse(
  provider: ProviderVibeProvider,
  payload: unknown,
): ProviderVibeValidatedPayload {
  try {
    asProviderPayload(payload);
  } catch (error) {
    throw new ProviderVibeResponseValidationError(
      provider,
      error instanceof Error ? error.message : "payload must be a JSON object",
    );
  }

  const result = responseSchemas[provider].safeParse(payload);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ProviderVibeResponseValidationError(
      provider,
      issue
        ? `${issue.path.join(".") || "payload"}: ${issue.message}`
        : "schema validation failed",
    );
  }
  return result.data as ProviderVibeValidatedPayload;
}
