import type { ProviderVibeAdapter } from "../registry";
import {
  normalizeProviderVibeSignal,
  type ProviderVibeNormalizationContext,
} from "../normalizer";
import { parseProviderVibeResponse } from "../response-contract";
import { hasValue, readNumber, readStringArray, signalId } from "./common";

export function createFoursquareAdapter(): ProviderVibeAdapter {
  return {
    normalize(payload: unknown, context: ProviderVibeNormalizationContext) {
      const record = parseProviderVibeResponse("foursquare_places", payload);
      const signals = [];
      const providerProduct = "places_premium";
      const confidenceScore = 0.5;
      const providerPlaceId = context.providerPlaceId;

      for (const [signalType, key] of [
        ["popularity", "popularity"],
        ["rating", "rating"],
      ] as const) {
        if (readNumber(record, key) === undefined) continue;
        signals.push(
          normalizeProviderVibeSignal(
            "foursquare_places",
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

      if (hasValue(record, "price")) {
        signals.push(
          normalizeProviderVibeSignal(
            "foursquare_places",
            {
              confidenceScore,
              providerProduct,
              providerSignalId: signalId(providerPlaceId, "price"),
              signalType: "price",
            },
            context,
          ),
        );
      }

      if (readStringArray(record, "tastes").length > 0) {
        signals.push(
          normalizeProviderVibeSignal(
            "foursquare_places",
            {
              confidenceScore,
              providerProduct,
              providerSignalId: signalId(providerPlaceId, "tastes"),
              signalType: "tastes",
            },
            context,
          ),
        );
      }
      if (record.hours_popular !== undefined) {
        signals.push(
          normalizeProviderVibeSignal(
            "foursquare_places",
            {
              confidenceScore,
              providerProduct,
              providerSignalId: signalId(providerPlaceId, "hours_popular"),
              signalType: "hours_popular",
            },
            context,
          ),
        );
      }
      if (readStringArray(record, "amenities").length > 0) {
        signals.push(
          normalizeProviderVibeSignal(
            "foursquare_places",
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
    provider: "foursquare_places",
  };
}
