import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { VibeSnapshotsModule } from "../vibe-snapshots/vibe-snapshots.module";
import { VibeReportsController } from "./vibe-reports.controller";
import { VibeReportAbuseService } from "./vibe-report-abuse.service";
import { VibeReportsService } from "./vibe-reports.service";

@Module({
  controllers: [VibeReportsController],
  imports: [AuthModule, DatabaseModule, VibeSnapshotsModule],
  providers: [VibeReportAbuseService, VibeReportsService],
})
export class VibeReportsModule {}
