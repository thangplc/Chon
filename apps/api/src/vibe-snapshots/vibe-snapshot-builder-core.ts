import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  aggregateVibeReports,
  getDayTypeForDate,
  getTimeBucketForDate,
  type VibeReportForAggregation,
  type VibeSnapshot,
} from "../../../../packages/domain/src/vibe/vibe-snapshot";
import type { ApiEnvironment } from "../config/api-environment";
import * as schema from "../database/schema";
import { places, vibeReports, vibeSnapshots } from "../database/schema";

type VibeSnapshotDatabase = NodePgDatabase<typeof schema>;

export type VibeSnapshotBuildSummary = Readonly<{
  dryRun: boolean;
  environment: ApiEnvironment["DATA_IMPORT_TARGET_ENVIRONMENT"];
  eligibleReports: number;
  skippedReports: number;
  snapshots: number;
  simulatedSnapshots: number;
}>;

const productionDataTypes = ["editorial", "community"] as const;

export class VibeSnapshotBuildRunner {
  constructor(private readonly db: VibeSnapshotDatabase) {}

  async rebuildForPlace(
    placeId: string,
    environment: ApiEnvironment["DATA_IMPORT_TARGET_ENVIRONMENT"],
  ): Promise<number> {
    const conditions = [
      eq(places.id, placeId),
      eq(places.status, "published"),
      eq(vibeReports.moderationStatus, "approved"),
      isNotNull(vibeReports.dayType),
      isNotNull(vibeReports.timeBucket),
    ];
    if (environment === "production") {
      conditions.push(eq(vibeReports.isSimulated, false));
      conditions.push(inArray(vibeReports.dataType, productionDataTypes));
    }

    const rows = await this.selectReports(conditions);
    const reports = toAggregationReports(rows);
    const snapshots = aggregateVibeReports(reports);

    await this.db.transaction(async (transaction) => {
      await transaction
        .delete(vibeSnapshots)
        .where(
          and(
            eq(vibeSnapshots.component, "contribution"),
            eq(vibeSnapshots.placeId, placeId),
          ),
        );

      if (snapshots.length > 0) {
        await transaction
          .insert(vibeSnapshots)
          .values(snapshots.map((snapshot) => toInsertValues(snapshot)));
      }
    });

    return snapshots.length;
  }

  async rebuild(
    environment: ApiEnvironment["DATA_IMPORT_TARGET_ENVIRONMENT"],
    dryRun = false,
  ): Promise<VibeSnapshotBuildSummary> {
    const conditions = [
      eq(places.status, "published"),
      eq(vibeReports.moderationStatus, "approved"),
      isNotNull(vibeReports.dayType),
      isNotNull(vibeReports.timeBucket),
    ];
    if (environment === "production") {
      conditions.push(eq(vibeReports.isSimulated, false));
      conditions.push(inArray(vibeReports.dataType, productionDataTypes));
    }

    const rows = await this.selectReports(conditions);

    let skippedReports = 0;
    const reports = toAggregationReports(rows, () => {
      skippedReports += 1;
    });
    const snapshots = aggregateVibeReports(reports);

    if (!dryRun) {
      await this.db.transaction(async (transaction) => {
        await transaction
          .delete(vibeSnapshots)
          .where(eq(vibeSnapshots.component, "contribution"));

        if (snapshots.length > 0) {
          await transaction
            .insert(vibeSnapshots)
            .values(snapshots.map((snapshot) => toInsertValues(snapshot)));
        }
      });
    }

    return {
      dryRun,
      eligibleReports: reports.length,
      environment,
      skippedReports,
      simulatedSnapshots: snapshots.filter(({ isSimulated }) => isSimulated)
        .length,
      snapshots: snapshots.length,
    };
  }

  selectReports(conditions: Parameters<typeof and>) {
    return this.db
      .select({
        crowd: vibeReports.crowd,
        dataType: vibeReports.dataType,
        dayType: vibeReports.dayType,
        id: vibeReports.internalId,
        isSimulated: vibeReports.isSimulated,
        lighting: vibeReports.lighting,
        noise: vibeReports.noise,
        placeAreaId: vibeReports.placeAreaId,
        placeId: vibeReports.placeId,
        privacy: vibeReports.privacy,
        socialEnergy: vibeReports.socialEnergy,
        timeBucket: vibeReports.timeBucket,
        visitedAt: vibeReports.visitedAt,
        workability: vibeReports.workability,
        openingHours: places.openingHours,
      })
      .from(vibeReports)
      .innerJoin(places, eq(vibeReports.placeId, places.id))
      .where(and(...conditions));
  }
}

function toAggregationReports(
  rows: Awaited<ReturnType<VibeSnapshotBuildRunner["selectReports"]>>,
  onSkipped: () => void = () => undefined,
): VibeReportForAggregation[] {
  return rows.flatMap((row) => {
    const timezone = row.openingHours?.timezone;
    const dayType =
      row.dayType ??
      (timezone ? getDayTypeForDate(row.visitedAt, timezone) : undefined);
    const timeBucket =
      row.timeBucket ??
      (timezone ? getTimeBucketForDate(row.visitedAt, timezone) : undefined);
    if (!dayType || !timeBucket) {
      onSkipped();
      return [];
    }
    return [
      {
        dataType: row.dataType,
        dayType,
        id: row.id,
        isSimulated: row.isSimulated,
        placeAreaId: row.placeAreaId,
        placeId: row.placeId,
        scores: {
          crowd: row.crowd,
          lighting: row.lighting,
          noise: row.noise,
          privacy: row.privacy,
          socialEnergy: row.socialEnergy,
          workability: row.workability,
        },
        timeBucket,
        visitedAt: row.visitedAt,
      } satisfies VibeReportForAggregation,
    ];
  });
}

function toInsertValues(snapshot: VibeSnapshot) {
  return {
    aggregationVersion: snapshot.aggregationVersion,
    component: snapshot.component,
    confidenceLevel: snapshot.confidenceLevel,
    confidenceScore: snapshot.confidenceScore,
    crowd: snapshot.scores.crowd ?? null,
    dayType: snapshot.dayType,
    isSimulated: snapshot.isSimulated,
    lastReportAt: snapshot.lastReportAt,
    lighting: snapshot.scores.lighting ?? null,
    noise: snapshot.scores.noise ?? null,
    placeAreaId: snapshot.placeAreaId,
    placeId: snapshot.placeId,
    privacy: snapshot.scores.privacy ?? null,
    reportCount: snapshot.reportCount,
    socialEnergy: snapshot.scores.socialEnergy ?? null,
    sourceDataTypes: snapshot.sourceDataTypes,
    timeBucket: snapshot.timeBucket,
    workability: snapshot.scores.workability ?? null,
  };
}
