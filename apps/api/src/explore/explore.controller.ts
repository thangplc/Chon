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
    description: "Simulated Explore dataset for non-production",
  })
  @Get("simulated")
  async readSimulatedDataset() {
    const dataset = await this.exploreService.getSimulatedDataset(
      this.config.get("DATA_IMPORT_TARGET_ENVIRONMENT", { infer: true }),
    );

    return { data: dataset };
  }
}
