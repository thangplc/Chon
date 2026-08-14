import "server-only";

import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { getDatabaseConnection } from "@/db/client";
import { places, vibeReports } from "@/db/schema";

import {
  exploreDistricts,
  type ExploreCommunityReport,
  type ExploreDataset,
  type ExploreDistrict,
  type ExploreSourcePlace,
  type TimeBucket,
  type VibeScores,
} from "../domain/explore-contract";

const simulatedEnvironments = new Set(["local", "ci", "staging"]);

function assertSimulatedDatasetAllowed(): void {
  const environment = process.env.DATA_IMPORT_TARGET_ENVIRONMENT?.trim();

  if (!environment || !simulatedEnvironments.has(environment)) {
    throw new Error(
      "Simulated Explore data is available only when DATA_IMPORT_TARGET_ENVIRONMENT is local, ci or staging",
    );
  }
}

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

export async function getSimulatedExploreDataset(): Promise<ExploreDataset> {
  assertSimulatedDatasetAllowed();
  const { db } = getDatabaseConnection();
  const [placeRows, reportRows] = await Promise.all([
    db
      .select({
        address: places.address,
        currency: places.currency,
        district: places.district,
        id: places.id,
        location: places.location,
        name: places.name,
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
    db
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
    typicalSpendMax: row.typicalSpendMax,
    typicalSpendMin: row.typicalSpendMin,
  }));
  const mappedReports: ExploreCommunityReport[] = reportRows.flatMap((row) => {
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
  });

  return {
    places: mappedPlaces,
    reports: mappedReports,
    source: "database_simulated_csv",
  };
}
