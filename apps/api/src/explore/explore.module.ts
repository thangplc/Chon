import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { VibeSnapshotsModule } from "../vibe-snapshots/vibe-snapshots.module";
import { ExploreController } from "./explore.controller";
import { ExploreService } from "./explore.service";

@Module({
  controllers: [ExploreController],
  imports: [DatabaseModule, VibeSnapshotsModule],
  providers: [ExploreService],
})
export class ExploreModule {}
