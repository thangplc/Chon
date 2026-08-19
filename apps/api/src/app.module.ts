import path from "node:path";

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { validateApiEnvironment } from "./config/api-environment";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AuthModule } from "./auth/auth.module";
import { ExploreModule } from "./explore/explore.module";
import { HealthModule } from "./health/health.module";
import { PlacesModule } from "./places/places.module";
import { VibeReportsModule } from "./vibe-reports/vibe-reports.module";

const apiEnvironmentPath = path.resolve(process.cwd(), ".env");

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: apiEnvironmentPath,
      isGlobal: true,
      validate: validateApiEnvironment,
    }),
    AnalyticsModule,
    AuthModule,
    ExploreModule,
    HealthModule,
    PlacesModule,
    VibeReportsModule,
  ],
})
export class AppModule {}
