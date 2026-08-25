import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import {
  CollectionsController,
  OwnedCollectionsController,
  PublicCollectionsController,
} from "./collections.controller";
import { CollectionsService } from "./collections.service";

@Module({
  controllers: [
    CollectionsController,
    OwnedCollectionsController,
    PublicCollectionsController,
  ],
  imports: [AuthModule, DatabaseModule],
  providers: [CollectionsService],
})
export class CollectionsModule {}
