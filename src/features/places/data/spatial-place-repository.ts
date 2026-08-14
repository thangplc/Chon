import "server-only";

import { getDatabaseConnection } from "@/db/client";

import type { SpatialPlaceQuery } from "../domain/spatial-query";
import {
  executeSpatialPlaceQuery,
  type SpatialPlacePage,
} from "./spatial-place-query";

export async function findPlacesBySpatialQuery(
  query: SpatialPlaceQuery,
): Promise<SpatialPlacePage> {
  return executeSpatialPlaceQuery(query, getDatabaseConnection().pool);
}
