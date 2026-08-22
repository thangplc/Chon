import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";

@Module({
  controllers: [AuthController],
  exports: [AuthGuard, AuthService],
  imports: [DatabaseModule],
  providers: [AuthGuard, AuthService],
})
export class AuthModule {}
