export const POI_PROVIDER = "vietmap_maps" as const;
export const POI_PROVIDER_PRODUCT = "maps_search_v4" as const;

export type PoiProvider = typeof POI_PROVIDER;
export type PoiSourceKind = "live" | "synthetic_fixture";

export type PoiBoundary = Readonly<{
  fullName: string | null;
  id: string;
  name: string | null;
  prefix: string | null;
  type: number;
}>;

export type PoiSearchArea = Readonly<{
  category?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  text: string;
}>;

export type NormalizedPoi = Readonly<{
  address: string;
  addressCurrent: string | null;
  addressLegacy: string | null;
  boundaries: readonly PoiBoundary[];
  categories: readonly string[];
  display: string | null;
  distanceKilometers: number | null;
  isSimulated: boolean;
  latitude: number;
  longitude: number;
  name: string;
  provider: PoiProvider;
  providerPlaceId: string;
  providerProduct: typeof POI_PROVIDER_PRODUCT;
  rawData: Readonly<Record<string, unknown>>;
  retrievedAt: Date;
  sourceUrl: string;
}>;

export type PoiProviderAdapter = Readonly<{
  provider: PoiProvider;
  search(area: PoiSearchArea): Promise<readonly NormalizedPoi[]>;
}>;
