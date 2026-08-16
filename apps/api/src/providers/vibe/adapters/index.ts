import type { ProviderVibeProvider } from "../config";
import type { ProviderVibeAdapterFactory } from "../registry";
import { createFoursquareAdapter } from "./foursquare";
import { createGoogleAdapter } from "./google";
import { createTripadvisorAdapter } from "./tripadvisor";
import { createYelpAdapter } from "./yelp";

export function createProviderVibeAdapterFactories(): Readonly<
  Partial<Record<ProviderVibeProvider, ProviderVibeAdapterFactory>>
> {
  return {
    foursquare_places: () => createFoursquareAdapter(),
    google_places: () => createGoogleAdapter(),
    tripadvisor: () => createTripadvisorAdapter(),
    yelp: () => createYelpAdapter(),
  };
}

export * from "./foursquare";
export * from "./google";
export * from "./tripadvisor";
export * from "./yelp";
