import { customType } from "drizzle-orm/pg-core";
import { parseEWKB } from "drizzle-orm/pg-core/columns/postgis_extension/utils";

export type Point4326 = Readonly<{
  latitude: number;
  longitude: number;
}>;

export const geometryPoint4326 = customType<{
  data: Point4326;
  driverData: string;
}>({
  dataType: () => "geometry(Point,4326)",
  fromDriver: (value) => {
    const [longitude, latitude] = parseEWKB(value);

    return { latitude, longitude };
  },
  toDriver: ({ latitude, longitude }) =>
    `SRID=4326;POINT(${longitude} ${latitude})`,
});

// Boundary reads should use ST_AsGeoJSON/ST_AsEWKT explicitly. Keeping the
// raw driver payload here avoids pretending Drizzle's point-only EWKB parser
// can deserialize arbitrary MultiPolygon geometry.
export const geometryMultiPolygon4326 = customType<{
  data: string;
  driverData: string;
}>({
  dataType: () => "geometry(MultiPolygon,4326)",
});
