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
  ApiTags,
} from "@nestjs/swagger";
import {
  parseSpatialPlaceQuery,
  SpatialQueryValidationError,
} from "../../../../packages/domain/src/places/spatial-query";

import type { ApiEnvironment } from "../config/api-environment";
import { PlacesService } from "./places.service";

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
    );

    if (!place) throw new NotFoundException();
    return { data: place };
  }
}
