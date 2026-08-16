import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

@Module({
  controllers: [AnalyticsController],
  imports: [DatabaseModule],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
