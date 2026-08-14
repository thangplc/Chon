import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  exploreDistricts,
  type ExploreCommunityReport,
  type ExploreDataset,
  type ExploreDistrict,
  type ExploreSourcePlace,
  type TimeBucket,
  type VibeScores,
} from "../../../../packages/domain/src/explore/explore-contract";
import { and, eq, inArray, isNotNull } from "drizzle-orm";

import type { ApiEnvironment } from "../config/api-environment";
import { DATABASE } from "../database/database.constants";
import type { ChonDatabase } from "../database/database.module";
import { places, vibeReports } from "../database/schema";

const simulatedEnvironments = new Set(["local", "ci", "staging"]);

function hasCompleteScores(row: {
  crowd: number | null;
  lighting: number | null;
  noise: number | null;
  privacy: number | null;
  socialEnergy: number | null;
  workability: number | null;
}): row is VibeScores {
  return (
    row.crowd !== null &&
    row.lighting !== null &&
    row.noise !== null &&
    row.privacy !== null &&
    row.socialEnergy !== null &&
    row.workability !== null
  );
}

@Injectable()
export class ExploreService {
  constructor(@Inject(DATABASE) private readonly db: ChonDatabase) {}

  async getSimulatedDataset(
    environment: ApiEnvironment["DATA_IMPORT_TARGET_ENVIRONMENT"],
  ): Promise<ExploreDataset> {
    if (!simulatedEnvironments.has(environment)) {
      throw new NotFoundException();
    }

    const [placeRows, reportRows] = await Promise.all([
      this.db
        .select({
          address: places.address,
          currency: places.currency,
          district: places.district,
          id: places.id,
          location: places.location,
          name: places.name,
          slug: places.slug,
          typicalSpendMax: places.typicalSpendMax,
          typicalSpendMin: places.typicalSpendMin,
        })
        .from(places)
        .where(
          and(
            eq(places.isSimulated, true),
            eq(places.status, "published"),
            inArray(places.district, exploreDistricts),
          ),
        )
        .orderBy(places.name),
      this.db
        .select({
          crowd: vibeReports.crowd,
          id: vibeReports.internalId,
          lighting: vibeReports.lighting,
          noise: vibeReports.noise,
          placeId: places.id,
          privacy: vibeReports.privacy,
          socialEnergy: vibeReports.socialEnergy,
          timeBucket: vibeReports.timeBucket,
          workability: vibeReports.workability,
        })
        .from(vibeReports)
        .innerJoin(places, eq(vibeReports.placeId, places.id))
        .where(
          and(
            eq(places.isSimulated, true),
            eq(places.status, "published"),
            inArray(places.district, exploreDistricts),
            eq(vibeReports.dataType, "community"),
            eq(vibeReports.isSimulated, true),
            eq(vibeReports.moderationStatus, "approved"),
            isNotNull(vibeReports.timeBucket),
          ),
        )
        .orderBy(vibeReports.visitedAt),
    ]);

    const mappedPlaces: ExploreSourcePlace[] = placeRows.map((row) => ({
      address: row.address,
      currency: row.currency,
      district: row.district as ExploreDistrict,
      id: row.id,
      latitude: row.location.latitude,
      longitude: row.location.longitude,
      name: row.name,
      slug: row.slug,
      typicalSpendMax: row.typicalSpendMax,
      typicalSpendMin: row.typicalSpendMin,
    }));
    const mappedReports: ExploreCommunityReport[] = reportRows.flatMap(
      (row) => {
        if (!row.timeBucket || !hasCompleteScores(row)) return [];
        return [
          {
            id: row.id,
            placeId: row.placeId,
            scores: {
              crowd: row.crowd,
              lighting: row.lighting,
              noise: row.noise,
              privacy: row.privacy,
              socialEnergy: row.socialEnergy,
              workability: row.workability,
            },
            timeBucket: row.timeBucket as TimeBucket,
          },
        ];
      },
    );

    return {
      places: mappedPlaces,
      reports: mappedReports,
      source: "database_simulated_csv",
    };
  }
}
