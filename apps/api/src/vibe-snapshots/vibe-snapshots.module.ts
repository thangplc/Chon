import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { VibeSnapshotsService } from "./vibe-snapshots.service";
import { VibeSnapshotBuilder } from "./vibe-snapshot-builder";

@Module({
  exports: [VibeSnapshotBuilder, VibeSnapshotsService],
  imports: [DatabaseModule],
  providers: [VibeSnapshotBuilder, VibeSnapshotsService],
})
export class VibeSnapshotsModule {}
