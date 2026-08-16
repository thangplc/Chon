import {
  Controller,
  Get,
  HttpException,
  Inject,
  NotFoundException,
  Param,
  Req,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import {
  parseSpatialPlaceQuery,
  SpatialQueryValidationError,
} from "../../../../packages/domain/src/places/spatial-query";

import type { ApiEnvironment } from "../config/api-environment";
import { PlacesService } from "./places.service";
import {
  parseVibeSnapshotQuery,
  VibeSnapshotQueryValidationError,
} from "../vibe-snapshots/vibe-snapshot-query";
import { VibeSnapshotsService } from "../vibe-snapshots/vibe-snapshots.service";

type RequestWithUrl = Readonly<{
  originalUrl?: string;
  url: string;
}>;

@ApiTags("places")
@Controller("places")
export class PlacesController {
  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService<ApiEnvironment, true>,
    @Inject(PlacesService)
    private readonly placesService: PlacesService,
    @Inject(VibeSnapshotsService)
    private readonly vibeSnapshotsService: VibeSnapshotsService,
  ) {}

  @ApiOperation({ summary: "Query published places by bbox or radius" })
  @ApiOkResponse({ description: "Spatial place page" })
  @Get()
  async findSpatial(@Req() request: RequestWithUrl) {
    try {
      const requestUrl = request.originalUrl ?? request.url;
      const searchParams = new URL(requestUrl, "http://chon-api.local")
        .searchParams;
      const query = parseSpatialPlaceQuery(searchParams);
      const page = await this.placesService.findSpatial(query);

      return {
        data: page.places,
        meta: {
          count: page.places.length,
          hasMore: page.hasMore,
          query,
        },
      };
    } catch (error) {
      if (error instanceof SpatialQueryValidationError) {
        throw new HttpException(
          {
            code: error.code,
            detail: error.message,
            status: 400,
            title: "Invalid spatial query",
            type: "about:blank",
          },
          400,
        );
      }

      console.error("Spatial place query failed", error);
      throw new HttpException(
        {
          code: "spatial_query_unavailable",
          detail: "The spatial place query is temporarily unavailable",
          status: 503,
          title: "Spatial query unavailable",
          type: "about:blank",
        },
        503,
      );
    }
  }

  @ApiOperation({ summary: "Read canonical fused vibe snapshots for a place" })
  @ApiOkResponse({ description: "Time-context Chốn vibe snapshots" })
  @ApiQuery({ name: "day_type", required: false })
  @ApiQuery({ name: "time_bucket", required: false })
  @ApiQuery({ name: "area_id", required: false })
  @ApiParam({ name: "slug" })
  @Get(":slug/vibe")
  async findVibeSnapshots(
    @Param("slug") slug: string,
    @Req() request: RequestWithUrl,
  ) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new NotFoundException();
    }

    try {
      const requestUrl = request.originalUrl ?? request.url;
      const query = parseVibeSnapshotQuery(
        new URL(requestUrl, "http://chon-api.local").searchParams,
      );
      const response = await this.vibeSnapshotsService.findByPlaceSlug(
        slug,
        this.config.get("DATA_IMPORT_TARGET_ENVIRONMENT", { infer: true }),
        query,
      );
      if (!response) throw new NotFoundException();
      return { data: response };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof VibeSnapshotQueryValidationError) {
        throw new HttpException(
          {
            code: error.code,
            detail: error.message,
            status: 400,
            title: "Invalid vibe snapshot query",
            type: "about:blank",
          },
          400,
        );
      }
      throw error;
    }
  }

  @ApiNotFoundResponse({ description: "Place is not publicly available" })
  @ApiOkResponse({ description: "Published place detail" })
  @ApiParam({ name: "slug" })
  @Get(":slug")
  async findBySlug(@Param("slug") slug: string) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new NotFoundException();
    }

    const place = await this.placesService.findDetailBySlug(
      slug,
      this.config.get("DATA_IMPORT_TARGET_ENVIRONMENT", { infer: true }),
      this.config.get("EXPLORE_PLACE_METADATA_MODE", { infer: true }),
    );

    if (!place) throw new NotFoundException();
    return { data: place };
  }
}
