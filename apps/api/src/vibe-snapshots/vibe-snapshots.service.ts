import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import {
  fuseVibeSnapshots,
  type CanonicalVibeSnapshot,
  type VibeProviderSignalForFusion,
} from "../../../../packages/domain/src/vibe/vibe-fusion";
import type {
  DayType,
  TimeBucket,
  VibeSnapshot,
} from "../../../../packages/domain/src/vibe/vibe-snapshot";

import type { ApiEnvironment } from "../config/api-environment";
import { DATABASE } from "../database/database.constants";
import type { ChonDatabase } from "../database/database.module";
import {
  placeSources,
  places,
  providerVibeSignals,
  vibeSnapshots,
} from "../database/schema";
import { PROVIDER_VIBE_ALLOWLISTS } from "../providers/vibe/allowlist";
import { readProviderVibeConfig } from "../providers/vibe/config";
import type { VibeSnapshotQuery } from "./vibe-snapshot-query";

const simulatedEnvironments = new Set(["local", "ci", "staging"]);

export type VibeSnapshotApiItem = Readonly<{
  aggregationVersion: string;
  component: "canonical";
  confidence: Readonly<{
    level: "low" | "medium" | "high";
    score: number;
  }>;
  dayType: "weekday" | "friday" | "weekend";
  generatedAt: Date;
  isSimulated: boolean;
  lastReportAt: Date;
  placeAreaId: string | null;
  placeId: string;
  providerSignalCount: number;
  reportCount: number;
  scores: Readonly<{
    crowd: number | null;
    lighting: number | null;
    noise: number | null;
    privacy: number | null;
    socialEnergy: number | null;
    workability: number | null;
  }>;
  sourceDataTypes: readonly (
    "synthetic" | "research" | "editorial" | "community"
  )[];
  sourceProviders: readonly string[];
  timeBucket: "morning" | "midday" | "afternoon" | "evening" | "late";
}>;

export type VibeSnapshotApiResponse = Readonly<{
  placeId: string;
  snapshots: readonly VibeSnapshotApiItem[];
}>;

export type VibeSnapshotApiIndex = ReadonlyMap<
  string,
  readonly VibeSnapshotApiItem[]
>;

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

    const rankingProducts = getRankingProviderProducts();
    const providerRows =
      rankingProducts.length === 0
        ? []
        : await this.db
            .select({
              confidenceScore: providerVibeSignals.confidenceScore,
              crowd: providerVibeSignals.crowd,
              dayType: providerVibeSignals.dayType,
              expiresAt: providerVibeSignals.expiresAt,
              lighting: providerVibeSignals.lighting,
              noise: providerVibeSignals.noise,
              observedAt: providerVibeSignals.observedAt,
              privacy: providerVibeSignals.privacy,
              placeId: providerVibeSignals.placeId,
              provider: placeSources.provider,
              providerProduct: providerVibeSignals.providerProduct,
              retrievedAt: providerVibeSignals.retrievedAt,
              socialEnergy: providerVibeSignals.socialEnergy,
              storagePolicy: providerVibeSignals.storagePolicy,
              timeBucket: providerVibeSignals.timeBucket,
              workability: providerVibeSignals.workability,
            })
            .from(providerVibeSignals)
            .innerJoin(
              placeSources,
              eq(providerVibeSignals.placeSourceId, placeSources.id),
            )
            .where(
              and(
                eq(providerVibeSignals.placeId, place.id),
                eq(placeSources.placeId, place.id),
                inArray(providerVibeSignals.providerProduct, rankingProducts),
                or(
                  isNull(providerVibeSignals.expiresAt),
                  gt(providerVibeSignals.expiresAt, new Date()),
                ),
              ),
            );

    const contributionSnapshots = rows.map(toContributionSnapshot);
    const snapshots = contributionSnapshots.flatMap((contribution) => {
      const signals = providerRows
        .filter((row) =>
          matchesContext(row, contribution.dayType, contribution.timeBucket),
        )
        .map(toProviderSignal);
      const fused = fuseVibeSnapshots(
        contribution,
        place.isSimulated ? [] : signals,
        {
          dayType: contribution.dayType,
          placeAreaId: contribution.placeAreaId,
          placeId: contribution.placeId,
          timeBucket: contribution.timeBucket,
        },
      );
      return fused ? [toApiItem(fused)] : [];
    });

    if (contributionSnapshots.length === 0 && !place.isSimulated) {
      snapshots.push(
        ...fuseProviderOnlySnapshots(place.id, providerRows, query),
      );
    }

    return { placeId: place.id, snapshots };
  }

  async findByPlaceIds(
    placeIds: readonly string[],
    environment: ApiEnvironment["DATA_IMPORT_TARGET_ENVIRONMENT"],
    query: VibeSnapshotQuery = {},
  ): Promise<VibeSnapshotApiIndex> {
    const uniquePlaceIds = [...new Set(placeIds)];
    if (uniquePlaceIds.length === 0) return new Map();

    const placeRows = await this.db
      .select({ id: places.id, isSimulated: places.isSimulated })
      .from(places)
      .where(
        and(eq(places.status, "published"), inArray(places.id, uniquePlaceIds)),
      );
    const visiblePlaces = placeRows.filter(
      (place) => !place.isSimulated || simulatedEnvironments.has(environment),
    );
    if (visiblePlaces.length === 0) return new Map();

    const visiblePlaceIds = visiblePlaces.map(({ id }) => id);
    const snapshotConditions = [
      inArray(vibeSnapshots.placeId, visiblePlaceIds),
      eq(vibeSnapshots.component, "contribution"),
    ];
    if (query.dayType)
      snapshotConditions.push(eq(vibeSnapshots.dayType, query.dayType));
    if (query.timeBucket)
      snapshotConditions.push(eq(vibeSnapshots.timeBucket, query.timeBucket));
    if (query.placeAreaId)
      snapshotConditions.push(eq(vibeSnapshots.placeAreaId, query.placeAreaId));

    const contributionRows = await this.db
      .select()
      .from(vibeSnapshots)
      .where(and(...snapshotConditions));
    const rankingProducts = getRankingProviderProducts();
    const realPlaceIds = visiblePlaces
      .filter(({ isSimulated }) => !isSimulated)
      .map(({ id }) => id);
    const providerRows =
      rankingProducts.length === 0 || realPlaceIds.length === 0
        ? []
        : await this.db
            .select({
              confidenceScore: providerVibeSignals.confidenceScore,
              crowd: providerVibeSignals.crowd,
              dayType: providerVibeSignals.dayType,
              expiresAt: providerVibeSignals.expiresAt,
              lighting: providerVibeSignals.lighting,
              noise: providerVibeSignals.noise,
              observedAt: providerVibeSignals.observedAt,
              privacy: providerVibeSignals.privacy,
              provider: placeSources.provider,
              providerProduct: providerVibeSignals.providerProduct,
              placeId: providerVibeSignals.placeId,
              retrievedAt: providerVibeSignals.retrievedAt,
              socialEnergy: providerVibeSignals.socialEnergy,
              storagePolicy: providerVibeSignals.storagePolicy,
              timeBucket: providerVibeSignals.timeBucket,
              workability: providerVibeSignals.workability,
            })
            .from(providerVibeSignals)
            .innerJoin(
              placeSources,
              eq(providerVibeSignals.placeSourceId, placeSources.id),
            )
            .where(
              and(
                inArray(providerVibeSignals.placeId, realPlaceIds),
                inArray(placeSources.placeId, realPlaceIds),
                inArray(providerVibeSignals.providerProduct, rankingProducts),
                or(
                  isNull(providerVibeSignals.expiresAt),
                  gt(providerVibeSignals.expiresAt, new Date()),
                ),
              ),
            );

    const index = new Map<string, readonly VibeSnapshotApiItem[]>();
    for (const place of visiblePlaces) {
      const contributions = contributionRows
        .filter(
          (row) =>
            row.placeId === place.id && row.isSimulated === place.isSimulated,
        )
        .map(toContributionSnapshot);
      const signals = providerRows.filter(
        ({ placeId }) => placeId === place.id,
      );
      const snapshots = contributions.flatMap((contribution) => {
        const contextSignals = signals
          .filter((signal) =>
            matchesContext(
              signal,
              contribution.dayType,
              contribution.timeBucket,
            ),
          )
          .map(toProviderSignal);
        const fused = fuseVibeSnapshots(
          contribution,
          place.isSimulated ? [] : contextSignals,
          {
            dayType: contribution.dayType,
            placeAreaId: contribution.placeAreaId,
            placeId: contribution.placeId,
            timeBucket: contribution.timeBucket,
          },
        );
        return fused ? [toApiItem(fused)] : [];
      });

      if (contributions.length === 0 && !place.isSimulated) {
        snapshots.push(...fuseProviderOnlySnapshots(place.id, signals, query));
      }
      index.set(place.id, snapshots);
    }

    return index;
  }
}

function getRankingProviderProducts(): string[] {
  const providerConfig = readProviderVibeConfig(process.env);
  return PROVIDER_VIBE_ALLOWLISTS.filter(
    ({ provider }) => providerConfig.providers[provider].rankingEnabled,
  ).map(({ providerProduct }) => providerProduct);
}

type ContributionSnapshotRow = typeof vibeSnapshots.$inferSelect;
type ProviderSignalRow = {
  confidenceScore: number;
  crowd: number | null;
  dayType: DayType | null;
  expiresAt: Date | null;
  lighting: number | null;
  noise: number | null;
  observedAt: Date | null;
  placeId: string;
  privacy: number | null;
  provider: string;
  providerProduct: string;
  retrievedAt: Date;
  socialEnergy: number | null;
  storagePolicy: "reference_only" | "ttl_cache" | "persist_allowed";
  timeBucket: TimeBucket | null;
  workability: number | null;
};

function toContributionSnapshot(row: ContributionSnapshotRow): VibeSnapshot {
  return {
    aggregationVersion: row.aggregationVersion,
    component: "contribution",
    confidenceLevel: row.confidenceLevel,
    confidenceScore: row.confidenceScore,
    dayType: row.dayType,
    isSimulated: row.isSimulated,
    lastReportAt: row.lastReportAt,
    placeAreaId: row.placeAreaId,
    placeId: row.placeId,
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
  };
}

function toProviderSignal(row: ProviderSignalRow): VibeProviderSignalForFusion {
  return {
    confidenceScore: row.confidenceScore,
    isSimulated: false,
    observedAt: row.observedAt,
    provider: row.provider,
    providerProduct: row.providerProduct,
    retrievedAt: row.retrievedAt,
    scores: {
      crowd: row.crowd,
      lighting: row.lighting,
      noise: row.noise,
      privacy: row.privacy,
      socialEnergy: row.socialEnergy,
      workability: row.workability,
    },
  };
}

function matchesContext(
  signal: Pick<ProviderSignalRow, "dayType" | "timeBucket">,
  dayType: DayType,
  timeBucket: TimeBucket,
): boolean {
  return (
    (signal.dayType === null || signal.dayType === dayType) &&
    (signal.timeBucket === null || signal.timeBucket === timeBucket)
  );
}

function toApiItem(snapshot: CanonicalVibeSnapshot): VibeSnapshotApiItem {
  return {
    aggregationVersion: snapshot.aggregationVersion,
    component: snapshot.component,
    confidence: {
      level: snapshot.confidenceLevel,
      score: snapshot.confidenceScore,
    },
    dayType: snapshot.dayType,
    generatedAt: new Date(),
    isSimulated: snapshot.isSimulated,
    lastReportAt: snapshot.lastReportAt,
    placeAreaId: snapshot.placeAreaId,
    placeId: snapshot.placeId,
    providerSignalCount: snapshot.providerSignalCount,
    reportCount: snapshot.reportCount,
    scores: {
      crowd: snapshot.scores.crowd ?? null,
      lighting: snapshot.scores.lighting ?? null,
      noise: snapshot.scores.noise ?? null,
      privacy: snapshot.scores.privacy ?? null,
      socialEnergy: snapshot.scores.socialEnergy ?? null,
      workability: snapshot.scores.workability ?? null,
    },
    sourceDataTypes: snapshot.sourceDataTypes,
    sourceProviders: snapshot.sourceProviders,
    timeBucket: snapshot.timeBucket,
  };
}

function fuseProviderOnlySnapshots(
  placeId: string,
  providerRows: readonly ProviderSignalRow[],
  query: VibeSnapshotQuery,
): VibeSnapshotApiItem[] {
  const groups = new Map<string, ProviderSignalRow[]>();
  for (const row of providerRows) {
    if (row.dayType === null || row.timeBucket === null) continue;
    if (query.dayType && row.dayType !== query.dayType) continue;
    if (query.timeBucket && row.timeBucket !== query.timeBucket) continue;
    const key = `${row.dayType}|${row.timeBucket}`;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  return [...groups.values()].flatMap((group) => {
    const first = group[0];
    if (!first.dayType || !first.timeBucket) return [];
    const fused = fuseVibeSnapshots(null, group.map(toProviderSignal), {
      dayType: first.dayType,
      placeAreaId: query.placeAreaId ?? null,
      placeId,
      timeBucket: first.timeBucket,
    });
    return fused ? [toApiItem(fused)] : [];
  });
}
