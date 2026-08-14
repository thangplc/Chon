import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { ExploreController } from "./explore.controller";
import { ExploreService } from "./explore.service";

@Module({
  controllers: [ExploreController],
  imports: [DatabaseModule],
  providers: [ExploreService],
})
export class ExploreModule {}
