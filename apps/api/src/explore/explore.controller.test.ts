import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiEnvironment } from "../config/api-environment";
import type { ConfigService } from "@nestjs/config";
import { ExploreController } from "./explore.controller";
import type { ExploreService } from "./explore.service";

const getDataset = vi.fn();
const listServiceAreas = vi.fn();
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
    listServiceAreas.mockReset();
    listServiceAreas.mockResolvedValue([]);
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
      listServiceAreas,
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

  it("returns dynamic active service areas", async () => {
    listServiceAreas.mockResolvedValue([
      {
        areaType: "ward",
        bounds: { east: 109.27, north: 13.81, south: 13.75, west: 109.19 },
        code: "gia-lai-quy-nhon",
        displayName: "Phường Quy Nhơn",
        placeCount: 35,
      },
    ]);
    const controller = new ExploreController(config, {
      getDataset,
      listServiceAreas,
    } as unknown as ExploreService);

    await expect(controller.readServiceAreas()).resolves.toEqual({
      data: [expect.objectContaining({ code: "gia-lai-quy-nhon" })],
    });
  });
});
