import type { ProviderVibeAdapter } from "../registry";
import {
  normalizeProviderVibeSignal,
  type ProviderVibeNormalizationContext,
} from "../normalizer";
import { parseProviderVibeResponse } from "../response-contract";
import { readNumber, readString, signalId } from "./common";

export function createYelpAdapter(): ProviderVibeAdapter {
  return {
    normalize(payload: unknown, context: ProviderVibeNormalizationContext) {
      const record = parseProviderVibeResponse("yelp", payload);
      const signals = [];
      const providerProduct = "places";
      const confidenceScore = 0.35;
      const providerPlaceId = context.providerPlaceId;
      const expiresAt = new Date(
        context.retrievedAt.getTime() + 24 * 60 * 60 * 1_000,
      );

      const rating = readNumber(record, "rating");
      if (rating !== undefined) {
        signals.push(
          normalizeProviderVibeSignal(
            "yelp",
            {
              confidenceScore,
              expiresAt,
              providerProduct,
              providerSignalId: signalId(providerPlaceId, "rating"),
              signalType: "rating",
              signalValue: { rating },
              storagePolicy: "ttl_cache",
            },
            context,
          ),
        );
      }

      const price = readString(record, "price");
      if (price !== undefined) {
        signals.push(
          normalizeProviderVibeSignal(
            "yelp",
            {
              confidenceScore,
              expiresAt,
              providerProduct,
              providerSignalId: signalId(providerPlaceId, "price"),
              signalType: "price",
              signalValue: { price },
              storagePolicy: "ttl_cache",
            },
            context,
          ),
        );
      }

      const reviewHighlightCount = readNumber(record, "review_highlight_count");
      if (reviewHighlightCount !== undefined) {
        signals.push(
          normalizeProviderVibeSignal(
            "yelp",
            {
              confidenceScore,
              expiresAt,
              providerProduct,
              providerSignalId: signalId(providerPlaceId, "review_highlight"),
              signalType: "review_highlight",
              signalValue: { count: reviewHighlightCount },
              storagePolicy: "ttl_cache",
            },
            context,
          ),
        );
      }

      return signals;
    },
    provider: "yelp",
  };
}
