import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";

import type { ApiEnvironment } from "../config/api-environment";
import { DATABASE } from "../database/database.constants";
import type { ChonDatabase } from "../database/database.module";
import { places, vibeSnapshots } from "../database/schema";
import type { VibeSnapshotQuery } from "./vibe-snapshot-query";

const simulatedEnvironments = new Set(["local", "ci", "staging"]);

export type VibeSnapshotApiItem = Readonly<{
  aggregationVersion: string;
  component: "contribution" | "provider";
  confidence: Readonly<{
    level: "low" | "medium" | "high";
    score: number;
  }>;
  dayType: "weekday" | "friday" | "weekend";
  generatedAt: Date;
  isSimulated: boolean;
  lastReportAt: Date;
  placeAreaId: string | null;
  reportCount: number;
  scores: Readonly<{
    crowd: number | null;
    lighting: number | null;
    noise: number | null;
    privacy: number | null;
    socialEnergy: number | null;
    workability: number | null;
  }>;
  sourceDataTypes: readonly string[];
  timeBucket: "morning" | "midday" | "afternoon" | "evening" | "late";
}>;

export type VibeSnapshotApiResponse = Readonly<{
  placeId: string;
  snapshots: readonly VibeSnapshotApiItem[];
}>;

@Injectable()
export class VibeSnapshotsService {
  constructor(@Inject(DATABASE) private readonly db: ChonDatabase) {}

  async findByPlaceSlug(
    slug: string,
    environment: ApiEnvironment["DATA_IMPORT_TARGET_ENVIRONMENT"],
    query: VibeSnapshotQuery,
  ): Promise<VibeSnapshotApiResponse | null> {
    const [place] = await this.db
      .select({ id: places.id, isSimulated: places.isSimulated })
      .from(places)
      .where(and(eq(places.slug, slug), eq(places.status, "published")))
      .limit(1);

    if (
      !place ||
      (place.isSimulated && !simulatedEnvironments.has(environment))
    ) {
      return null;
    }

    const conditions = [
      eq(vibeSnapshots.placeId, place.id),
      eq(vibeSnapshots.component, "contribution"),
      eq(vibeSnapshots.isSimulated, place.isSimulated),
    ];
    if (query.dayType)
      conditions.push(eq(vibeSnapshots.dayType, query.dayType));
    if (query.timeBucket)
      conditions.push(eq(vibeSnapshots.timeBucket, query.timeBucket));
    if (query.placeAreaId)
      conditions.push(eq(vibeSnapshots.placeAreaId, query.placeAreaId));

    const rows = await this.db
      .select()
      .from(vibeSnapshots)
      .where(and(...conditions))
      .orderBy(
        asc(vibeSnapshots.dayType),
        asc(vibeSnapshots.timeBucket),
        asc(vibeSnapshots.placeAreaId),
      );

    return {
      placeId: place.id,
      snapshots: rows.map((row) => ({
        aggregationVersion: row.aggregationVersion,
        component: row.component,
        confidence: {
          level: row.confidenceLevel,
          score: row.confidenceScore,
        },
        dayType: row.dayType,
        generatedAt: row.generatedAt,
        isSimulated: row.isSimulated,
        lastReportAt: row.lastReportAt,
        placeAreaId: row.placeAreaId,
        reportCount: row.reportCount,
        scores: {
          crowd: row.crowd,
          lighting: row.lighting,
          noise: row.noise,
          privacy: row.privacy,
          socialEnergy: row.socialEnergy,
          workability: row.workability,
        },
        sourceDataTypes: row.sourceDataTypes ?? [],
        timeBucket: row.timeBucket,
      })),
    };
  }
}
