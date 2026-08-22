import { Controller, Get, Inject, Req } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";

import type { ApiEnvironment } from "../config/api-environment";
import { parseExploreDatasetQuery } from "./explore-query";
import { ExploreService } from "./explore.service";

type RequestWithUrl = Readonly<{
  originalUrl?: string;
  url: string;
}>;

@ApiTags("explore")
@Controller("explore")
export class ExploreController {
  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService<ApiEnvironment, true>,
    @Inject(ExploreService)
    private readonly exploreService: ExploreService,
  ) {}

  @ApiOkResponse({
    description: "Explore dataset for non-production environments",
  })
  @ApiQuery({ name: "amenities", required: false })
  @ApiQuery({ name: "price_levels", required: false })
  @ApiQuery({ name: "price_range", required: false })
  @ApiQuery({ name: "size", required: false })
  @Get("simulated")
  async readSimulatedDataset(@Req() request: RequestWithUrl) {
    const requestUrl = request.originalUrl ?? request.url;
    const query = parseExploreDatasetQuery(
      new URL(requestUrl, "http://chon-api.local").searchParams,
    );
    const dataset = await this.exploreService.getDataset(
      this.config.get("DATA_IMPORT_TARGET_ENVIRONMENT", { infer: true }),
      this.config.get("EXPLORE_PLACE_DATA_MODE", { infer: true }),
      this.config.get("EXPLORE_PLACE_METADATA_MODE", { infer: true }),
      query,
    );

    return { data: dataset };
  }

  @ApiOkResponse({ description: "Active service areas available in Explore" })
  @Get("service-areas")
  async readServiceAreas() {
    return { data: await this.exploreService.listServiceAreas() };
  }
}
