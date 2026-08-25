import { Inject, Injectable } from "@nestjs/common";
import { and, asc, count, desc, eq } from "drizzle-orm";

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

export class CollectionNotFoundError extends Error {}
export class DefaultCollectionMutationError extends Error {}

@Injectable()
export class CollectionsService {
  constructor(@Inject(DATABASE) private readonly db: ChonDatabase) {}

  async listCollections(user: AuthUser) {
    await this.ensureDefaultCollection(user);
    return this.db
      .select({
        description: collections.description,
        id: collections.id,
        isDefault: collections.isDefault,
        name: collections.name,
        ownerType: collections.ownerType,
        placeCount: count(collectionPlaces.placeId).mapWith(Number),
        publishedAt: collections.publishedAt,
        slug: collections.slug,
        status: collections.status,
        visibility: collections.visibility,
      })
      .from(collections)
      .leftJoin(
        collectionPlaces,
        eq(collectionPlaces.collectionId, collections.id),
      )
      .where(
        and(eq(collections.userId, user.id), eq(collections.ownerType, "user")),
      )
      .groupBy(collections.id)
      .orderBy(desc(collections.isDefault), asc(collections.createdAt));
  }

  private async ensureDefaultCollection(user: AuthUser) {
    await this.db
      .insert(collections)
      .values({
        isDefault: true,
        name: "Đã lưu",
        ownerType: "user",
        slug: "saved-places",
        userId: user.id,
        visibility: "private",
      })
      .onConflictDoNothing();
  }

  async createCollection(
    user: AuthUser,
    input: {
      name: string;
      description?: string | null;
      visibility: "private" | "public";
    },
  ) {
    const base = slugify(input.name) || "collection";
    for (let suffix = 0; suffix < 100; suffix += 1) {
      const slug = suffix === 0 ? base : `${base}-${suffix + 1}`;
      const [created] = await this.db
        .insert(collections)
        .values({
          description: input.description || null,
          name: input.name.trim(),
          ownerType: "user",
          slug,
          userId: user.id,
          visibility: input.visibility,
        })
        .onConflictDoNothing()
        .returning();
      if (created) return this.readCollectionPlaces(created);
    }
    throw new Error("Unable to allocate collection slug");
  }

  async readOwnedCollection(user: AuthUser, slug: string) {
    const [collection] = await this.db
      .select()
      .from(collections)
      .where(
        and(
          eq(collections.userId, user.id),
          eq(collections.ownerType, "user"),
          eq(collections.slug, slug),
        ),
      )
      .limit(1);
    if (!collection) throw new CollectionNotFoundError();
    return this.readCollectionPlaces(collection);
  }

  async readPublicCollection(id: string) {
    const [collection] = await this.db
      .select()
      .from(collections)
      .where(
        and(
          eq(collections.id, id),
          eq(collections.visibility, "public"),
          eq(collections.status, "published"),
        ),
      )
      .limit(1);
    if (!collection) throw new CollectionNotFoundError();
    return this.readCollectionPlaces(collection);
  }

  private async readCollectionPlaces(
    collection: typeof collections.$inferSelect,
  ) {
    const rows = await this.db
      .select({
        address: places.address,
        district: places.district,
        name: places.name,
        note: collectionPlaces.note,
        savedAt: collectionPlaces.createdAt,
        slug: places.slug,
      })
      .from(collectionPlaces)
      .innerJoin(places, eq(collectionPlaces.placeId, places.id))
      .where(
        and(
          eq(collectionPlaces.collectionId, collection.id),
          eq(places.status, "published"),
        ),
      )
      .orderBy(
        asc(collectionPlaces.position),
        desc(collectionPlaces.createdAt),
      );
    return {
      description: collection.description,
      id: collection.id,
      isDefault: collection.isDefault,
      name: collection.name,
      ownerType: collection.ownerType,
      placeCount: rows.length,
      places: rows,
      publishedAt: collection.publishedAt,
      slug: collection.slug,
      status: collection.status,
      visibility: collection.visibility,
    };
  }

  async updateCollection(
    user: AuthUser,
    slug: string,
    input: {
      name: string;
      description?: string | null;
      visibility: "private" | "public";
    },
  ) {
    const [current] = await this.db
      .select()
      .from(collections)
      .where(
        and(
          eq(collections.userId, user.id),
          eq(collections.ownerType, "user"),
          eq(collections.slug, slug),
        ),
      )
      .limit(1);
    if (!current) throw new CollectionNotFoundError();
    if (current.isDefault) throw new DefaultCollectionMutationError();
    const [updated] = await this.db
      .update(collections)
      .set({
        description: input.description || null,
        name: input.name.trim(),
        updatedAt: new Date(),
        visibility: input.visibility,
      })
      .where(eq(collections.id, current.id))
      .returning();
    return this.readCollectionPlaces(updated!);
  }

  async deleteCollection(user: AuthUser, slug: string) {
    const [current] = await this.db
      .select()
      .from(collections)
      .where(
        and(
          eq(collections.userId, user.id),
          eq(collections.ownerType, "user"),
          eq(collections.slug, slug),
        ),
      )
      .limit(1);
    if (!current) return;
    if (current.isDefault) throw new DefaultCollectionMutationError();
    await this.db.delete(collections).where(eq(collections.id, current.id));
  }

  async addPlaceToCollection(
    user: AuthUser,
    collectionSlug: string,
    placeSlug: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [collection] = await tx
        .select({ id: collections.id })
        .from(collections)
        .where(
          and(
            eq(collections.userId, user.id),
            eq(collections.ownerType, "user"),
            eq(collections.slug, collectionSlug),
          ),
        )
        .limit(1);
      const [place] = await tx
        .select({ id: places.id })
        .from(places)
        .where(and(eq(places.slug, placeSlug), eq(places.status, "published")))
        .limit(1);
      if (!collection || !place) throw new CollectionNotFoundError();
      await tx
        .insert(collectionPlaces)
        .values({ collectionId: collection.id, placeId: place.id })
        .onConflictDoNothing();
      return { collectionSlug, placeSlug, saved: true as const };
    });
  }

  async removePlaceFromCollection(
    user: AuthUser,
    collectionSlug: string,
    placeSlug: string,
  ) {
    const [collection] = await this.db
      .select({ id: collections.id })
      .from(collections)
      .where(
        and(
          eq(collections.userId, user.id),
          eq(collections.ownerType, "user"),
          eq(collections.slug, collectionSlug),
        ),
      )
      .limit(1);
    if (!collection) throw new CollectionNotFoundError();
    await this.db
      .delete(collectionPlaces)
      .where(
        and(
          eq(collectionPlaces.collectionId, collection.id),
          eq(
            collectionPlaces.placeId,
            this.db
              .select({ id: places.id })
              .from(places)
              .where(eq(places.slug, placeSlug)),
          ),
        ),
      );
    return { collectionSlug, placeSlug, saved: false as const };
  }

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
          eq(collections.ownerType, "user"),
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
          eq(collections.ownerType, "user"),
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
          ownerType: "user",
          slug: "saved-places",
          userId: user.id,
          visibility: "private",
        })
        .onConflictDoNothing();

      const [collection] = await tx
        .select({ id: collections.id })
        .from(collections)
        .where(
          and(
            eq(collections.userId, user.id),
            eq(collections.ownerType, "user"),
            eq(collections.isDefault, true),
          ),
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
                eq(collections.ownerType, "user"),
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

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 140);
}
