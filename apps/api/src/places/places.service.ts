import { Inject, Injectable } from "@nestjs/common";
import {
  mediaSourceLabel,
  parsePlaceOpeningHours,
  parsePriceLevel,
  type PlaceDetail,
  resolvePlaceMediaUrl,
} from "../../../../packages/domain/src/place-detail/place-detail";
import type { SpatialPlaceQuery } from "../../../../packages/domain/src/places/spatial-query";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Pool } from "pg";

import type { ApiEnvironment } from "../config/api-environment";
import { DATABASE, PG_POOL } from "../database/database.constants";
import type { ChonDatabase } from "../database/database.module";
import {
  executeSpatialPlaceQuery,
  type SpatialPlacePage,
} from "../database/queries/spatial-place-query";
import {
  placeAreas,
  placeMedia,
  placeMetadataOverlays,
  places,
} from "../database/schema";
import {
  resolvePlaceMetadata,
  type SyntheticPlaceMetadata,
} from "./place-metadata-resolver";

const simulatedEnvironments = new Set(["local", "ci", "staging"]);

@Injectable()
export class PlacesService {
  constructor(
    @Inject(DATABASE) private readonly db: ChonDatabase,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  findSpatial(query: SpatialPlaceQuery): Promise<SpatialPlacePage> {
    return executeSpatialPlaceQuery(query, this.pool);
  }

  async findDetailBySlug(
    slug: string,
    environment: ApiEnvironment["DATA_IMPORT_TARGET_ENVIRONMENT"],
    metadataMode: ApiEnvironment["EXPLORE_PLACE_METADATA_MODE"] = "real",
  ): Promise<PlaceDetail | null> {
    const [place] = await this.db
      .select({
        address: places.address,
        currency: places.currency,
        description: places.description,
        district: places.district,
        estimatedCapacity: places.estimatedCapacity,
        id: places.id,
        isSimulated: places.isSimulated,
        location: places.location,
        name: places.name,
        openingHours: places.openingHours,
        priceLevel: places.priceLevel,
        sizeCategory: places.sizeCategory,
        slug: places.slug,
        typicalSpendMax: places.typicalSpendMax,
        typicalSpendMin: places.typicalSpendMin,
      })
      .from(places)
      .where(and(eq(places.slug, slug), eq(places.status, "published")))
      .limit(1);

    if (
      !place ||
      (place.isSimulated && !simulatedEnvironments.has(environment))
    ) {
      return null;
    }

    let syntheticMetadata: SyntheticPlaceMetadata | null = null;
    if (metadataMode !== "real" && !place.isSimulated) {
      const [overlay] = await this.db
        .select({
          amenities: placeMetadataOverlays.amenities,
          currency: placeMetadataOverlays.currency,
          estimatedCapacity: placeMetadataOverlays.estimatedCapacity,
          openingHours: placeMetadataOverlays.openingHours,
          priceLevel: placeMetadataOverlays.priceLevel,
          sizeCategory: placeMetadataOverlays.sizeCategory,
          spaceNote: placeMetadataOverlays.spaceNote,
          typicalSpendMax: placeMetadataOverlays.typicalSpendMax,
          typicalSpendMin: placeMetadataOverlays.typicalSpendMin,
        })
        .from(placeMetadataOverlays)
        .where(
          and(
            eq(placeMetadataOverlays.placeId, place.id),
            eq(placeMetadataOverlays.environment, environment),
          ),
        )
        .limit(1);
      syntheticMetadata = overlay
        ? {
            ...overlay,
            openingHours: overlay.openingHours
              ? parsePlaceOpeningHours(overlay.openingHours)
              : null,
            priceLevel: parsePriceLevel(overlay.priceLevel),
          }
        : null;
    }

    const metadata = resolvePlaceMetadata(
      {
        currency: place.currency,
        estimatedCapacity: place.estimatedCapacity,
        openingHours: place.openingHours
          ? parsePlaceOpeningHours(place.openingHours)
          : null,
        priceLevel: parsePriceLevel(place.priceLevel),
        sizeCategory: place.sizeCategory,
        typicalSpendMax: place.typicalSpendMax,
        typicalSpendMin: place.typicalSpendMin,
      },
      syntheticMetadata,
      metadataMode,
    );

    const areaRows = await this.db
      .select({
        description: placeAreas.description,
        id: placeAreas.id,
        isSimulated: placeAreas.isSimulated,
        name: placeAreas.name,
      })
      .from(placeAreas)
      .where(
        and(
          eq(placeAreas.placeId, place.id),
          eq(placeAreas.isSimulated, place.isSimulated),
        ),
      )
      .orderBy(asc(placeAreas.name))
      .limit(20);

    const mediaRows = await this.db
      .select({
        altText: placeMedia.altText,
        height: placeMedia.height,
        id: placeMedia.id,
        isSimulated: placeMedia.isSimulated,
        sortOrder: placeMedia.sortOrder,
        sourceReference: placeMedia.sourceReference,
        sourceType: placeMedia.sourceType,
        sourceUrl: placeMedia.sourceUrl,
        storageKey: placeMedia.storageKey,
        width: placeMedia.width,
      })
      .from(placeMedia)
      .where(
        and(
          eq(placeMedia.placeId, place.id),
          eq(placeMedia.moderationStatus, "approved"),
          eq(placeMedia.isSimulated, place.isSimulated),
          inArray(placeMedia.rightsStatus, ["verified", "provider_allowed"]),
        ),
      )
      .orderBy(asc(placeMedia.sortOrder))
      .limit(5);

    return {
      address: place.address,
      areas: areaRows,
      amenities: metadata.amenities,
      currency: metadata.currency,
      description: place.description,
      district: place.district,
      estimatedCapacity: metadata.estimatedCapacity,
      id: place.id,
      isSimulated: place.isSimulated,
      latitude: place.location.latitude,
      longitude: place.location.longitude,
      media: mediaRows.map((media) => ({
        altText: media.altText,
        height: media.height,
        id: media.id,
        isSimulated: media.isSimulated,
        sortOrder: media.sortOrder,
        sourceLabel: mediaSourceLabel(media.sourceType),
        sourceReference: media.sourceReference,
        url: resolvePlaceMediaUrl(media),
        width: media.width,
      })),
      name: place.name,
      metadata: metadata.metadata,
      openingHours: metadata.openingHours,
      priceLevel: metadata.priceLevel,
      sizeCategory: metadata.sizeCategory,
      slug: place.slug,
      spaceNote: metadata.spaceNote,
      typicalSpendMax: metadata.typicalSpendMax,
      typicalSpendMin: metadata.typicalSpendMin,
    };
  }
}
