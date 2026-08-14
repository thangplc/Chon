import { Inject, Injectable } from "@nestjs/common";

import { DATABASE } from "../database/database.constants";
import type { ChonDatabase } from "../database/database.module";
import { VibeSnapshotBuildRunner } from "./vibe-snapshot-builder-core";

@Injectable()
export class VibeSnapshotBuilder extends VibeSnapshotBuildRunner {
  constructor(@Inject(DATABASE) db: ChonDatabase) {
    super(db);
  }
}
