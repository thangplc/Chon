import foursquarePlacesPremium from "./v1/foursquare-places-premium.json";
import googlePlacesApiNew from "./v1/google-places-api-new.json";
import tripadvisorContentApi from "./v1/tripadvisor-content-api.json";
import yelpPlaces from "./v1/yelp-places.json";

import type { ProviderVibeProvider } from "../config";

export const PROVIDER_VIBE_FIXTURE_VERSION = "v1" as const;

export type ProviderVibeFixtureManifest = Readonly<{
  capturedAt: null;
  endpoint: null;
  isSynthetic: true;
  provider: ProviderVibeProvider;
  providerProduct: string;
  source: "synthetic_fixture";
  version: typeof PROVIDER_VIBE_FIXTURE_VERSION;
}>;

export const PROVIDER_VIBE_FIXTURE_MANIFEST: Readonly<
  Record<ProviderVibeProvider, ProviderVibeFixtureManifest>
> = {
  foursquare_places: {
    capturedAt: null,
    endpoint: null,
    isSynthetic: true,
    provider: "foursquare_places",
    providerProduct: "places_premium",
    source: "synthetic_fixture",
    version: PROVIDER_VIBE_FIXTURE_VERSION,
  },
  google_places: {
    capturedAt: null,
    endpoint: null,
    isSynthetic: true,
    provider: "google_places",
    providerProduct: "places_api_new",
    source: "synthetic_fixture",
    version: PROVIDER_VIBE_FIXTURE_VERSION,
  },
  tripadvisor: {
    capturedAt: null,
    endpoint: null,
    isSynthetic: true,
    provider: "tripadvisor",
    providerProduct: "content_api",
    source: "synthetic_fixture",
    version: PROVIDER_VIBE_FIXTURE_VERSION,
  },
  yelp: {
    capturedAt: null,
    endpoint: null,
    isSynthetic: true,
    provider: "yelp",
    providerProduct: "places",
    source: "synthetic_fixture",
    version: PROVIDER_VIBE_FIXTURE_VERSION,
  },
};

export const PROVIDER_VIBE_FIXTURE_PAYLOADS: Readonly<
  Record<ProviderVibeProvider, unknown>
> = {
  foursquare_places: foursquarePlacesPremium,
  google_places: googlePlacesApiNew,
  tripadvisor: tripadvisorContentApi,
  yelp: yelpPlaces,
};
