import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { VibeSnapshotsModule } from "../vibe-snapshots/vibe-snapshots.module";
import { PlacesController } from "./places.controller";
import { PlacesService } from "./places.service";

@Module({
  controllers: [PlacesController],
  imports: [DatabaseModule, VibeSnapshotsModule],
  providers: [PlacesService],
})
export class PlacesModule {}
