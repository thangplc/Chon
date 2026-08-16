import type { ProviderVibeProvider } from "./config";

export type ProviderVibeStoragePolicy =
  "reference_only" | "ttl_cache" | "persist_allowed";

export type ProviderVibeAllowlistEntry = Readonly<{
  allowedStoragePolicies: readonly ProviderVibeStoragePolicy[];
  defaultStoragePolicy: ProviderVibeStoragePolicy;
  dimensionMappingAllowed: boolean;
  provider: ProviderVibeProvider;
  providerProduct: string;
  rawDataAllowed: boolean;
  signalTypes: readonly string[];
  ttlSeconds?: number;
}>;

export const PROVIDER_VIBE_ALLOWLISTS: readonly ProviderVibeAllowlistEntry[] = [
  {
    allowedStoragePolicies: ["reference_only", "persist_allowed"],
    defaultStoragePolicy: "reference_only",
    dimensionMappingAllowed: false,
    provider: "foursquare_places",
    providerProduct: "places_premium",
    rawDataAllowed: false,
    signalTypes: [
      "amenity",
      "hours_popular",
      "popularity",
      "price",
      "rating",
      "tastes",
    ],
  },
  {
    allowedStoragePolicies: ["reference_only"],
    defaultStoragePolicy: "reference_only",
    dimensionMappingAllowed: false,
    provider: "google_places",
    providerProduct: "places_api_new",
    rawDataAllowed: false,
    signalTypes: ["amenity", "price_level", "rating", "rating_count"],
  },
  {
    allowedStoragePolicies: ["ttl_cache"],
    defaultStoragePolicy: "ttl_cache",
    dimensionMappingAllowed: false,
    provider: "yelp",
    providerProduct: "places",
    rawDataAllowed: false,
    signalTypes: ["price", "rating", "review_highlight"],
    ttlSeconds: 24 * 60 * 60,
  },
  {
    allowedStoragePolicies: ["reference_only", "ttl_cache"],
    defaultStoragePolicy: "reference_only",
    dimensionMappingAllowed: false,
    provider: "tripadvisor",
    providerProduct: "content_api",
    rawDataAllowed: false,
    signalTypes: [
      "price",
      "ranking",
      "rating",
      "review_breakdown",
      "trip_type",
    ],
    ttlSeconds: 24 * 60 * 60,
  },
];

export function getProviderVibeAllowlist(
  provider: ProviderVibeProvider,
  providerProduct: string,
): ProviderVibeAllowlistEntry {
  const entry = PROVIDER_VIBE_ALLOWLISTS.find(
    (candidate) =>
      candidate.provider === provider &&
      candidate.providerProduct === providerProduct,
  );
  if (!entry) {
    throw new ProviderVibeNormalizationError(
      `Provider product is not allowlisted: ${provider}/${providerProduct}`,
    );
  }
  return entry;
}

export class ProviderVibeNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderVibeNormalizationError";
  }
}
