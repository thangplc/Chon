import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { PlacesController } from "./places.controller";
import { PlacesService } from "./places.service";

@Module({
  controllers: [PlacesController],
  imports: [DatabaseModule],
  providers: [PlacesService],
})
export class PlacesModule {}
