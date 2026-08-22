import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  type ExploreCommunityReport,
  type ExploreDataset,
  type ExploreServiceArea,
  type ExploreSourcePlace,
  type ExploreVibeSnapshot,
  type TimeBucket,
  type VibeScores,
} from "../../../../packages/domain/src/explore/explore-contract";
import {
  parsePlaceOpeningHours,
  parsePriceLevel,
} from "../../../../packages/domain/src/place-detail/place-detail";
import { and, count, eq, inArray, isNotNull, sql } from "drizzle-orm";

import type { ApiEnvironment } from "../config/api-environment";
import { DATABASE } from "../database/database.constants";
import type { ChonDatabase } from "../database/database.module";
import {
  placeMetadataOverlays,
  places,
  placeServiceAreas,
  serviceAreaBoundaries,
  serviceAreas,
  vibeReports,
} from "../database/schema";
import {
  type VibeSnapshotApiItem,
  VibeSnapshotsService,
} from "../vibe-snapshots/vibe-snapshots.service";
import {
  resolvePlaceMetadata,
  type SyntheticPlaceMetadata,
} from "../places/place-metadata-resolver";
import {
  emptyExploreDatasetQuery,
  matchesExploreMetadataQuery,
  type ExploreDatasetQuery,
} from "./explore-query";

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
  constructor(
    @Inject(DATABASE) private readonly db: ChonDatabase,
    @Inject(VibeSnapshotsService)
    private readonly vibeSnapshotsService: VibeSnapshotsService,
  ) {}

  async listServiceAreas(): Promise<readonly ExploreServiceArea[]> {
    const rows = await this.db
      .select({
        areaType: serviceAreas.areaType,
        code: serviceAreas.code,
        displayName: serviceAreas.displayName,
        east: sql<number>`ST_XMax(Box3D(${serviceAreaBoundaries.boundary}))`,
        north: sql<number>`ST_YMax(Box3D(${serviceAreaBoundaries.boundary}))`,
        placeCount: count(placeServiceAreas.placeId),
        south: sql<number>`ST_YMin(Box3D(${serviceAreaBoundaries.boundary}))`,
        west: sql<number>`ST_XMin(Box3D(${serviceAreaBoundaries.boundary}))`,
      })
      .from(serviceAreas)
      .innerJoin(
        serviceAreaBoundaries,
        and(
          eq(serviceAreaBoundaries.serviceAreaId, serviceAreas.id),
          eq(serviceAreaBoundaries.isCurrent, true),
        ),
      )
      .leftJoin(
        placeServiceAreas,
        and(
          eq(placeServiceAreas.serviceAreaId, serviceAreas.id),
          eq(placeServiceAreas.isPrimary, true),
        ),
      )
      .where(eq(serviceAreas.status, "active"))
      .groupBy(serviceAreas.id, serviceAreaBoundaries.boundary)
      .orderBy(serviceAreas.priority, serviceAreas.displayName);

    return rows.map((row) => ({
      areaType: row.areaType,
      bounds: {
        east: Number(row.east),
        north: Number(row.north),
        south: Number(row.south),
        west: Number(row.west),
      },
      code: row.code,
      displayName: row.displayName,
      placeCount: Number(row.placeCount),
    }));
  }

  async getDataset(
    environment: ApiEnvironment["DATA_IMPORT_TARGET_ENVIRONMENT"],
    placeDataMode: ApiEnvironment["EXPLORE_PLACE_DATA_MODE"],
    metadataMode: ApiEnvironment["EXPLORE_PLACE_METADATA_MODE"] = "real",
    query: ExploreDatasetQuery = emptyExploreDatasetQuery,
  ): Promise<ExploreDataset> {
    if (!simulatedEnvironments.has(environment)) {
      throw new NotFoundException();
    }

    const placeConditions = [eq(places.status, "published")];
    if (placeDataMode === "synthetic") {
      placeConditions.push(eq(places.isSimulated, true));
    } else if (placeDataMode === "real") {
      placeConditions.push(eq(places.isSimulated, false));
    }

    const reportConditions = [
      eq(places.status, "published"),
      eq(vibeReports.dataType, "community"),
      eq(vibeReports.moderationStatus, "approved"),
      isNotNull(vibeReports.timeBucket),
    ];
    if (placeDataMode === "synthetic") {
      reportConditions.push(eq(places.isSimulated, true));
      reportConditions.push(eq(vibeReports.isSimulated, true));
    } else if (placeDataMode === "real") {
      reportConditions.push(eq(places.isSimulated, false));
      reportConditions.push(eq(vibeReports.isSimulated, false));
    }

    const [placeRows, reportRows] = await Promise.all([
      this.db
        .select({
          address: places.address,
          currency: places.currency,
          district: places.district,
          estimatedCapacity: places.estimatedCapacity,
          id: places.id,
          isSimulated: places.isSimulated,
          location: places.location,
          name: places.name,
          openingHours: places.openingHours,
          priceLevel: places.priceLevel,
          serviceAreaCode: serviceAreas.code,
          serviceAreaName: serviceAreas.displayName,
          sizeCategory: places.sizeCategory,
          slug: places.slug,
          typicalSpendMax: places.typicalSpendMax,
          typicalSpendMin: places.typicalSpendMin,
        })
        .from(places)
        .innerJoin(
          placeServiceAreas,
          and(
            eq(placeServiceAreas.placeId, places.id),
            eq(placeServiceAreas.isPrimary, true),
          ),
        )
        .innerJoin(
          serviceAreas,
          and(
            eq(serviceAreas.id, placeServiceAreas.serviceAreaId),
            eq(serviceAreas.status, "active"),
          ),
        )
        .where(and(...placeConditions))
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
        .innerJoin(
          placeServiceAreas,
          and(
            eq(placeServiceAreas.placeId, places.id),
            eq(placeServiceAreas.isPrimary, true),
          ),
        )
        .innerJoin(
          serviceAreas,
          and(
            eq(serviceAreas.id, placeServiceAreas.serviceAreaId),
            eq(serviceAreas.status, "active"),
          ),
        )
        .where(and(...reportConditions))
        .orderBy(vibeReports.visitedAt),
    ]);

    const vibeIndex = await this.vibeSnapshotsService.findByPlaceIds(
      placeRows.map(({ id }) => id),
      environment,
    );
    const vibes = placeRows.flatMap(({ id }) =>
      (vibeIndex.get(id) ?? [])
        .filter(({ placeAreaId }) => placeAreaId === null)
        .map(toExploreVibeSnapshot),
    );

    const realPlaceIds = placeRows
      .filter(({ isSimulated }) => !isSimulated)
      .map(({ id }) => id);
    const overlayRows =
      metadataMode === "real" || realPlaceIds.length === 0
        ? []
        : await this.db
            .select({
              amenities: placeMetadataOverlays.amenities,
              currency: placeMetadataOverlays.currency,
              estimatedCapacity: placeMetadataOverlays.estimatedCapacity,
              openingHours: placeMetadataOverlays.openingHours,
              placeId: placeMetadataOverlays.placeId,
              priceLevel: placeMetadataOverlays.priceLevel,
              sizeCategory: placeMetadataOverlays.sizeCategory,
              spaceNote: placeMetadataOverlays.spaceNote,
              typicalSpendMax: placeMetadataOverlays.typicalSpendMax,
              typicalSpendMin: placeMetadataOverlays.typicalSpendMin,
            })
            .from(placeMetadataOverlays)
            .where(
              and(
                eq(placeMetadataOverlays.environment, environment),
                inArray(placeMetadataOverlays.placeId, realPlaceIds),
              ),
            );
    const overlaysByPlaceId = new Map(
      overlayRows.map((row) => [row.placeId, row]),
    );

    const mappedPlaces: ExploreSourcePlace[] = placeRows.map((row) => {
      const overlay = overlaysByPlaceId.get(row.id);
      const resolved = resolvePlaceMetadata(
        {
          currency: row.currency,
          estimatedCapacity: row.estimatedCapacity,
          openingHours: row.openingHours
            ? parsePlaceOpeningHours(row.openingHours)
            : null,
          priceLevel: parsePriceLevel(row.priceLevel),
          sizeCategory: row.sizeCategory,
          typicalSpendMax: row.typicalSpendMax,
          typicalSpendMin: row.typicalSpendMin,
        },
        row.isSimulated || !overlay
          ? null
          : ({
              ...overlay,
              openingHours: overlay.openingHours
                ? parsePlaceOpeningHours(overlay.openingHours)
                : null,
              priceLevel: parsePriceLevel(overlay.priceLevel),
            } as SyntheticPlaceMetadata),
        metadataMode,
      );

      return {
        address: row.address,
        amenities: resolved.amenities,
        currency: resolved.currency,
        district: row.district,
        estimatedCapacity: resolved.estimatedCapacity,
        id: row.id,
        latitude: row.location.latitude,
        longitude: row.location.longitude,
        metadata: resolved.metadata,
        name: row.name,
        priceLevel: resolved.priceLevel,
        serviceAreaCode: row.serviceAreaCode,
        serviceAreaName: row.serviceAreaName,
        sizeCategory: resolved.sizeCategory,
        slug: row.slug,
        typicalSpendMax: resolved.typicalSpendMax,
        typicalSpendMin: resolved.typicalSpendMin,
      };
    });
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

    const filteredPlaces = mappedPlaces.filter((place) =>
      matchesExploreMetadataQuery(place, query),
    );
    const filteredPlaceIds = new Set(filteredPlaces.map(({ id }) => id));

    return {
      places: filteredPlaces,
      reports: mappedReports.filter(({ placeId }) =>
        filteredPlaceIds.has(placeId),
      ),
      vibes: vibes.filter(({ placeId }) => filteredPlaceIds.has(placeId)),
      source:
        placeDataMode === "real"
          ? "database_real"
          : placeDataMode === "mixed"
            ? "database_mixed"
            : "database_simulated_csv",
    };
  }
}

function toExploreVibeSnapshot(
  snapshot: VibeSnapshotApiItem,
): ExploreVibeSnapshot {
  return {
    confidence: snapshot.confidence,
    dayType: snapshot.dayType,
    isSimulated: snapshot.isSimulated,
    placeId: snapshot.placeId,
    providerSignalCount: snapshot.providerSignalCount,
    reportCount: snapshot.reportCount,
    scores: snapshot.scores,
    sourceDataTypes: snapshot.sourceDataTypes,
    sourceProviders: snapshot.sourceProviders,
    timeBucket: snapshot.timeBucket,
  };
}
