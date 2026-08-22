import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";

import type { AuthUser } from "../../../../packages/contracts/src/auth";
import { DATABASE } from "../database/database.constants";
import type { ChonDatabase } from "../database/database.module";
import { collectionPlaces, collections, places } from "../database/schema";

export class SavedPlaceNotFoundError extends Error {
  constructor() {
    super("Place is not publicly available");
    this.name = "SavedPlaceNotFoundError";
  }
}

@Injectable()
export class CollectionsService {
  constructor(@Inject(DATABASE) private readonly db: ChonDatabase) {}

  async listSavedPlaces(user: AuthUser) {
    return this.db
      .select({
        address: places.address,
        district: places.district,
        name: places.name,
        savedAt: collectionPlaces.createdAt,
        slug: places.slug,
      })
      .from(collectionPlaces)
      .innerJoin(collections, eq(collectionPlaces.collectionId, collections.id))
      .innerJoin(places, eq(collectionPlaces.placeId, places.id))
      .where(
        and(
          eq(collections.userId, user.id),
          eq(collections.isDefault, true),
          eq(places.status, "published"),
        ),
      )
      .orderBy(desc(collectionPlaces.createdAt));
  }

  async readSavedPlaceStatus(user: AuthUser, slug: string) {
    const [saved] = await this.db
      .select({ savedAt: collectionPlaces.createdAt })
      .from(collectionPlaces)
      .innerJoin(collections, eq(collectionPlaces.collectionId, collections.id))
      .innerJoin(places, eq(collectionPlaces.placeId, places.id))
      .where(
        and(
          eq(collections.userId, user.id),
          eq(collections.isDefault, true),
          eq(places.slug, slug),
          eq(places.status, "published"),
        ),
      )
      .limit(1);

    return { saved: Boolean(saved), savedAt: saved?.savedAt ?? null, slug };
  }

  async savePlace(user: AuthUser, slug: string) {
    if (user.status !== "active") throw new SavedPlaceNotFoundError();

    return this.db.transaction(async (tx) => {
      const [place] = await tx
        .select({ id: places.id })
        .from(places)
        .where(and(eq(places.slug, slug), eq(places.status, "published")))
        .limit(1);
      if (!place) throw new SavedPlaceNotFoundError();

      await tx
        .insert(collections)
        .values({
          isDefault: true,
          name: "Đã lưu",
          slug: "saved-places",
          userId: user.id,
          visibility: "private",
        })
        .onConflictDoNothing();

      const [collection] = await tx
        .select({ id: collections.id })
        .from(collections)
        .where(
          and(eq(collections.userId, user.id), eq(collections.isDefault, true)),
        )
        .limit(1);
      if (!collection) throw new Error("Default saved collection unavailable");

      const [created] = await tx
        .insert(collectionPlaces)
        .values({ collectionId: collection.id, placeId: place.id })
        .onConflictDoNothing()
        .returning({ savedAt: collectionPlaces.createdAt });

      const savedAt =
        created?.savedAt ??
        (
          await tx
            .select({ savedAt: collectionPlaces.createdAt })
            .from(collectionPlaces)
            .where(
              and(
                eq(collectionPlaces.collectionId, collection.id),
                eq(collectionPlaces.placeId, place.id),
              ),
            )
            .limit(1)
        )[0]?.savedAt;

      return { saved: true as const, savedAt: savedAt ?? new Date(), slug };
    });
  }

  async removeSavedPlace(user: AuthUser, slug: string) {
    await this.db.delete(collectionPlaces).where(
      and(
        eq(
          collectionPlaces.collectionId,
          this.db
            .select({ id: collections.id })
            .from(collections)
            .where(
              and(
                eq(collections.userId, user.id),
                eq(collections.isDefault, true),
              ),
            ),
        ),
        eq(
          collectionPlaces.placeId,
          this.db
            .select({ id: places.id })
            .from(places)
            .where(eq(places.slug, slug)),
        ),
      ),
    );
    return { saved: false as const, savedAt: null, slug };
  }
}
