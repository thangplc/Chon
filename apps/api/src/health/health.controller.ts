import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Pool } from "pg";

import { PG_POOL } from "../database/database.constants";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @ApiOkResponse({ description: "API and database are ready" })
  @Get()
  async readHealth(): Promise<{
    database: "ready";
    service: "chon-api";
    status: "ready";
  }> {
    await this.pool.query("SELECT 1");

    return { database: "ready", service: "chon-api", status: "ready" };
  }
}
