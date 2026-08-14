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
import { placeAreas, placeMedia, places } from "../database/schema";

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
      currency: place.currency,
      description: place.description,
      district: place.district,
      estimatedCapacity: place.estimatedCapacity,
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
      openingHours: place.openingHours
        ? parsePlaceOpeningHours(place.openingHours)
        : null,
      priceLevel: parsePriceLevel(place.priceLevel),
      sizeCategory: place.sizeCategory,
      slug: place.slug,
      typicalSpendMax: place.typicalSpendMax,
      typicalSpendMin: place.typicalSpendMin,
    };
  }
}
