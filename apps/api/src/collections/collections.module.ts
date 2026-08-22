import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { CollectionsController } from "./collections.controller";
import { CollectionsService } from "./collections.service";

@Module({
  controllers: [CollectionsController],
  imports: [AuthModule, DatabaseModule],
  providers: [CollectionsService],
})
export class CollectionsModule {}
