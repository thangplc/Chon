import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { VibeReportsController } from "./vibe-reports.controller";
import { VibeReportsService } from "./vibe-reports.service";

@Module({
  controllers: [VibeReportsController],
  imports: [AuthModule, DatabaseModule],
  providers: [VibeReportsService],
})
export class VibeReportsModule {}
