import "server-only";

import {
  exploreDatasetResponseSchema,
  exploreServiceAreasResponseSchema,
} from "@chon/contracts/backend";
import { fetchBackendJson } from "@/lib/backend-api";

import type {
  ExploreDataset,
  ExploreServiceArea,
} from "../domain/explore-contract";

export async function getExploreDataset(): Promise<ExploreDataset> {
  const response = await fetchBackendJson(
    "/v1/explore/simulated",
    exploreDatasetResponseSchema,
  );
  return response.data;
}

export async function getExploreServiceAreas(): Promise<
  readonly ExploreServiceArea[]
> {
  const response = await fetchBackendJson(
    "/v1/explore/service-areas",
    exploreServiceAreasResponseSchema,
  );
  return response.data;
}
