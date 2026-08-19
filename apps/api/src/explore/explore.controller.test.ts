import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiEnvironment } from "../config/api-environment";
import type { ConfigService } from "@nestjs/config";
import { ExploreController } from "./explore.controller";
import type { ExploreService } from "./explore.service";

const getDataset = vi.fn();
const config = {
  get: vi.fn((key: keyof ApiEnvironment) => {
    const values: Record<string, string> = {
      DATA_IMPORT_TARGET_ENVIRONMENT: "local",
      EXPLORE_PLACE_DATA_MODE: "synthetic",
      EXPLORE_PLACE_METADATA_MODE: "synthetic",
    };
    return values[key];
  }),
} as unknown as ConfigService<ApiEnvironment, true>;

describe("ExploreController", () => {
  beforeEach(() => {
    getDataset.mockReset();
    getDataset.mockResolvedValue({
      places: [],
      reports: [],
      source: "database_simulated_csv",
      vibes: [],
    });
  });

  it("forwards Apply metadata filters to the dataset service", async () => {
    const controller = new ExploreController(config, {
      getDataset,
    } as unknown as ExploreService);

    await expect(
      controller.readSimulatedDataset({
        url: "/v1/explore/simulated?size=small&price_range=under-50",
      }),
    ).resolves.toEqual({
      data: {
        places: [],
        reports: [],
        source: "database_simulated_csv",
        vibes: [],
      },
    });

    expect(getDataset).toHaveBeenCalledWith("local", "synthetic", "synthetic", {
      amenities: [],
      priceLevels: [],
      priceMax: 50_000,
      priceMin: null,
      sizeCategories: ["small"],
    });
  });
});
