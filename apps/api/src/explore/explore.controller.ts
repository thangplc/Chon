import { Controller, Get, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

import type { ApiEnvironment } from "../config/api-environment";
import { ExploreService } from "./explore.service";

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
  @Get("simulated")
  async readSimulatedDataset() {
    const dataset = await this.exploreService.getDataset(
      this.config.get("DATA_IMPORT_TARGET_ENVIRONMENT", { infer: true }),
      this.config.get("EXPLORE_PLACE_DATA_MODE", { infer: true }),
      this.config.get("EXPLORE_PLACE_METADATA_MODE", { infer: true }),
    );

    return { data: dataset };
  }
}
