import { HttpException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiEnvironment } from "../config/api-environment";
import { PlacesController } from "./places.controller";
import type { PlacesService } from "./places.service";

const findDetailBySlug = vi.fn();
const findSpatial = vi.fn();
const findByPlaceSlug = vi.fn();
const config = {
  get: vi.fn(() => "local"),
} as unknown as ConfigService<ApiEnvironment, true>;
const service = {
  findDetailBySlug,
  findSpatial,
  findByPlaceSlug,
} as unknown as PlacesService;

describe("PlacesController", () => {
  beforeEach(() => {
    findDetailBySlug.mockReset();
    findSpatial.mockReset();
    findByPlaceSlug.mockReset();
  });

  it("preserves the spatial response contract", async () => {
    findSpatial.mockResolvedValue({ hasMore: false, places: [] });
    const controller = new PlacesController(config, service, {
      findByPlaceSlug,
    } as never);

    await expect(
      controller.findSpatial({
        url: "/v1/places?bbox=106.68,10.75,106.73,10.82&limit=2",
      }),
    ).resolves.toEqual({
      data: [],
      meta: {
        count: 0,
        hasMore: false,
        query: {
          east: 106.73,
          kind: "bbox",
          limit: 2,
          north: 10.82,
          south: 10.75,
          west: 106.68,
        },
      },
    });
  });

  it("maps spatial validation errors to problem details", async () => {
    const controller = new PlacesController(config, service, {
      findByPlaceSlug,
    } as never);
    const error = await controller
      .findSpatial({ url: "/v1/places?limit=2" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(400);
    expect((error as HttpException).getResponse()).toMatchObject({
      code: "spatial_query_required",
      status: 400,
    });
    expect(findSpatial).not.toHaveBeenCalled();
  });

  it("does not expose invalid or unavailable slugs", async () => {
    const controller = new PlacesController(config, service, {
      findByPlaceSlug,
    } as never);
    await expect(controller.findBySlug("INVALID SLUG")).rejects.toBeInstanceOf(
      NotFoundException,
    );

    findDetailBySlug.mockResolvedValue(null);
    await expect(controller.findBySlug("missing-place")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("returns canonical time-context vibe snapshots", async () => {
    findByPlaceSlug.mockResolvedValue({
      placeId: "22222222-2222-4222-8222-222222222222",
      snapshots: [],
    });
    const controller = new PlacesController(config, service, {
      findByPlaceSlug,
    } as never);

    await expect(
      controller.findVibeSnapshots("goc-test", {
        url: "/v1/places/goc-test/vibe?day_type=weekday&time_bucket=morning",
      }),
    ).resolves.toEqual({
      data: {
        placeId: "22222222-2222-4222-8222-222222222222",
        snapshots: [],
      },
    });
    expect(findByPlaceSlug).toHaveBeenCalledWith("goc-test", "local", {
      dayType: "weekday",
      timeBucket: "morning",
    });
  });

  it("maps invalid vibe filters to a problem detail", async () => {
    const controller = new PlacesController(config, service, {
      findByPlaceSlug,
    } as never);

    const error = await controller
      .findVibeSnapshots("goc-test", {
        url: "/v1/places/goc-test/vibe?time_bucket=night",
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(400);
    expect((error as HttpException).getResponse()).toMatchObject({
      code: "vibe_snapshot_query_invalid",
      status: 400,
    });
    expect(findByPlaceSlug).not.toHaveBeenCalled();
  });
});
