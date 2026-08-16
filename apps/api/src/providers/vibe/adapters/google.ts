import type { ProviderVibeAdapter } from "../registry";
import {
  normalizeProviderVibeSignal,
  type ProviderVibeNormalizationContext,
} from "../normalizer";
import { parseProviderVibeResponse } from "../response-contract";
import { readNumber, readStringArray, signalId } from "./common";

export function createGoogleAdapter(): ProviderVibeAdapter {
  return {
    normalize(payload: unknown, context: ProviderVibeNormalizationContext) {
      const record = parseProviderVibeResponse("google_places", payload);
      const signals = [];
      const providerProduct = "places_api_new";
      const confidenceScore = 0.4;
      const providerPlaceId = context.providerPlaceId;

      for (const [signalType, key] of [
        ["rating", "rating"],
        ["rating_count", "user_ratings_total"],
      ] as const) {
        if (readNumber(record, key) === undefined) continue;
        signals.push(
          normalizeProviderVibeSignal(
            "google_places",
            {
              confidenceScore,
              providerProduct,
              providerSignalId: signalId(providerPlaceId, signalType),
              signalType,
            },
            context,
          ),
        );
      }

      if (
        readNumber(record, "userRatingCount") !== undefined &&
        readNumber(record, "user_ratings_total") === undefined
      ) {
        signals.push(
          normalizeProviderVibeSignal(
            "google_places",
            {
              confidenceScore,
              providerProduct,
              providerSignalId: signalId(providerPlaceId, "rating_count"),
              signalType: "rating_count",
            },
            context,
          ),
        );
      }

      if (
        readNumber(record, "price_level") !== undefined ||
        readNumber(record, "priceLevel") !== undefined ||
        typeof record.price_level === "string" ||
        typeof record.priceLevel === "string"
      ) {
        signals.push(
          normalizeProviderVibeSignal(
            "google_places",
            {
              confidenceScore,
              providerProduct,
              providerSignalId: signalId(providerPlaceId, "price_level"),
              signalType: "price_level",
            },
            context,
          ),
        );
      }

      if (readStringArray(record, "amenities").length > 0) {
        signals.push(
          normalizeProviderVibeSignal(
            "google_places",
            {
              confidenceScore,
              providerProduct,
              providerSignalId: signalId(providerPlaceId, "amenity"),
              signalType: "amenity",
            },
            context,
          ),
        );
      }
      return signals;
    },
    provider: "google_places",
  };
}
