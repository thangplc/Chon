type ServiceAreaBoundaryDefinitionBase = Readonly<{
  code: string;
  displayName: string;
  osmName: string;
  priority: number;
  sourceLicense: "ODbL-1.0";
  sourceName: "OpenStreetMap via Nominatim";
  sourceRelationId: string;
  sourceStorageKey: string;
  sourceUrl: string;
  status: "active";
  timezone: "Asia/Ho_Chi_Minh";
  version: number;
}>;

type HistoricDistrictBoundaryDefinition = ServiceAreaBoundaryDefinitionBase &
  Readonly<{
    areaType: "historic_district";
    osmEndDate: string;
    osmFeatureType: "historic";
  }>;

type WardBoundaryDefinition = ServiceAreaBoundaryDefinitionBase &
  Readonly<{
    areaType: "ward";
    osmAdminLevel: string;
    osmFeatureType: "administrative";
  }>;

export type ServiceAreaBoundaryDefinition =
  HistoricDistrictBoundaryDefinition | WardBoundaryDefinition;

export const serviceAreaBoundarySimplifyToleranceDegrees = 0.00005;

export const serviceAreaBoundaries = [
  {
    areaType: "historic_district",
    code: "hcm-q1",
    displayName: "Quận 1",
    osmEndDate: "2025-06-30",
    osmFeatureType: "historic",
    osmName: "Quận 1",
    priority: 0,
    sourceLicense: "ODbL-1.0",
    sourceName: "OpenStreetMap via Nominatim",
    sourceRelationId: "2587287",
    sourceStorageKey: "boundaries/osm/hcm-q1/v1/boundary.geojson",
    sourceUrl: "https://www.openstreetmap.org/relation/2587287",
    status: "active",
    timezone: "Asia/Ho_Chi_Minh",
    version: 1,
  },
  {
    areaType: "historic_district",
    code: "hcm-q3",
    displayName: "Quận 3",
    osmEndDate: "2025-06-30",
    osmFeatureType: "historic",
    osmName: "Quận 3",
    priority: 0,
    sourceLicense: "ODbL-1.0",
    sourceName: "OpenStreetMap via Nominatim",
    sourceRelationId: "3819816",
    sourceStorageKey: "boundaries/osm/hcm-q3/v2/boundary.geojson",
    sourceUrl: "https://www.openstreetmap.org/relation/3819816",
    status: "active",
    timezone: "Asia/Ho_Chi_Minh",
    version: 2,
  },
  {
    areaType: "historic_district",
    code: "hcm-binh-thanh",
    displayName: "Bình Thạnh",
    osmEndDate: "2025-06-30",
    osmFeatureType: "historic",
    osmName: "Quận Bình Thạnh",
    priority: 0,
    sourceLicense: "ODbL-1.0",
    sourceName: "OpenStreetMap via Nominatim",
    sourceRelationId: "3797166",
    sourceStorageKey: "boundaries/osm/hcm-binh-thanh/v2/boundary.geojson",
    sourceUrl: "https://www.openstreetmap.org/relation/3797166",
    status: "active",
    timezone: "Asia/Ho_Chi_Minh",
    version: 2,
  },
  {
    areaType: "ward",
    code: "gia-lai-quy-nhon",
    displayName: "Phường Quy Nhơn",
    osmAdminLevel: "6",
    osmFeatureType: "administrative",
    osmName: "Phường Quy Nhơn",
    priority: 0,
    sourceLicense: "ODbL-1.0",
    sourceName: "OpenStreetMap via Nominatim",
    sourceRelationId: "19372380",
    sourceStorageKey: "boundaries/osm/gia-lai-quy-nhon/v1/boundary.geojson",
    sourceUrl: "https://www.openstreetmap.org/relation/19372380",
    status: "active",
    timezone: "Asia/Ho_Chi_Minh",
    version: 1,
  },
  {
    areaType: "ward",
    code: "gia-lai-quy-nhon-dong",
    displayName: "Phường Quy Nhơn Đông",
    osmAdminLevel: "6",
    osmFeatureType: "administrative",
    osmName: "Phường Quy Nhơn Đông",
    priority: 0,
    sourceLicense: "ODbL-1.0",
    sourceName: "OpenStreetMap via Nominatim",
    sourceRelationId: "19372378",
    sourceStorageKey:
      "boundaries/osm/gia-lai-quy-nhon-dong/v1/boundary.geojson",
    sourceUrl: "https://www.openstreetmap.org/relation/19372378",
    status: "active",
    timezone: "Asia/Ho_Chi_Minh",
    version: 1,
  },
  {
    areaType: "ward",
    code: "gia-lai-quy-nhon-tay",
    displayName: "Phường Quy Nhơn Tây",
    osmAdminLevel: "6",
    osmFeatureType: "administrative",
    osmName: "Phường Quy Nhơn Tây",
    priority: 0,
    sourceLicense: "ODbL-1.0",
    sourceName: "OpenStreetMap via Nominatim",
    sourceRelationId: "19372376",
    sourceStorageKey: "boundaries/osm/gia-lai-quy-nhon-tay/v1/boundary.geojson",
    sourceUrl: "https://www.openstreetmap.org/relation/19372376",
    status: "active",
    timezone: "Asia/Ho_Chi_Minh",
    version: 1,
  },
  {
    areaType: "ward",
    code: "gia-lai-quy-nhon-nam",
    displayName: "Phường Quy Nhơn Nam",
    osmAdminLevel: "6",
    osmFeatureType: "administrative",
    osmName: "Phường Quy Nhơn Nam",
    priority: 0,
    sourceLicense: "ODbL-1.0",
    sourceName: "OpenStreetMap via Nominatim",
    sourceRelationId: "19372377",
    sourceStorageKey: "boundaries/osm/gia-lai-quy-nhon-nam/v1/boundary.geojson",
    sourceUrl: "https://www.openstreetmap.org/relation/19372377",
    status: "active",
    timezone: "Asia/Ho_Chi_Minh",
    version: 1,
  },
  {
    areaType: "ward",
    code: "gia-lai-quy-nhon-bac",
    displayName: "Phường Quy Nhơn Bắc",
    osmAdminLevel: "6",
    osmFeatureType: "administrative",
    osmName: "Phường Quy Nhơn Bắc",
    priority: 0,
    sourceLicense: "ODbL-1.0",
    sourceName: "OpenStreetMap via Nominatim",
    sourceRelationId: "19372379",
    sourceStorageKey: "boundaries/osm/gia-lai-quy-nhon-bac/v1/boundary.geojson",
    sourceUrl: "https://www.openstreetmap.org/relation/19372379",
    status: "active",
    timezone: "Asia/Ho_Chi_Minh",
    version: 1,
  },
] as const satisfies readonly ServiceAreaBoundaryDefinition[];

export function createNominatimBoundaryLookupUrl(): URL {
  const url = new URL("https://nominatim.openstreetmap.org/lookup");

  url.searchParams.set(
    "osm_ids",
    serviceAreaBoundaries
      .map(({ sourceRelationId }) => `R${sourceRelationId}`)
      .join(","),
  );
  url.searchParams.set("format", "geojson");
  url.searchParams.set("polygon_geojson", "1");
  url.searchParams.set(
    "polygon_threshold",
    String(serviceAreaBoundarySimplifyToleranceDegrees),
  );
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("namedetails", "1");

  return url;
}
