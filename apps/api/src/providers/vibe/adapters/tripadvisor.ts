import type { ProviderVibeAdapter } from "../registry";
import {
  normalizeProviderVibeSignal,
  type ProviderVibeNormalizationContext,
} from "../normalizer";
import { parseProviderVibeResponse } from "../response-contract";
import { hasValue, readNumber, readStringArray, signalId } from "./common";

export function createTripadvisorAdapter(): ProviderVibeAdapter {
  return {
    normalize(payload: unknown, context: ProviderVibeNormalizationContext) {
      const record = parseProviderVibeResponse("tripadvisor", payload);
      const signals = [];
      const providerProduct = "content_api";
      const confidenceScore = 0.3;
      const providerPlaceId = context.providerPlaceId;

      for (const [signalType, key] of [
        ["rating", "rating"],
        ["ranking", "ranking"],
      ] as const) {
        if (readNumber(record, key) === undefined) continue;
        signals.push(
          normalizeProviderVibeSignal(
            "tripadvisor",
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
            "tripadvisor",
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

      if (record.review_breakdown !== undefined) {
        signals.push(
          normalizeProviderVibeSignal(
            "tripadvisor",
            {
              confidenceScore,
              providerProduct,
              providerSignalId: signalId(providerPlaceId, "review_breakdown"),
              signalType: "review_breakdown",
            },
            context,
          ),
        );
      }
      if (
        readStringArray(record, "trip_types").length > 0 ||
        readStringArray(record, "tripTypes").length > 0
      ) {
        signals.push(
          normalizeProviderVibeSignal(
            "tripadvisor",
            {
              confidenceScore,
              providerProduct,
              providerSignalId: signalId(providerPlaceId, "trip_type"),
              signalType: "trip_type",
            },
            context,
          ),
        );
      }
      return signals;
    },
    provider: "tripadvisor",
  };
}
