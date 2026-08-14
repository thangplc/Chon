import "server-only";

import { exploreDatasetResponseSchema } from "@chon/contracts/backend";
import { fetchBackendJson } from "@/lib/backend-api";

import { type ExploreDataset } from "../domain/explore-contract";

export async function getSimulatedExploreDataset(): Promise<ExploreDataset> {
  const response = await fetchBackendJson(
    "/v1/explore/simulated",
    exploreDatasetResponseSchema,
  );
  return response.data;
}
