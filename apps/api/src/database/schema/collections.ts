import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { places } from "./places";
import { users } from "./users";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    visibility: varchar("visibility", { length: 16 })
      .default("private")
      .notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("collections_user_slug_unique").on(table.userId, table.slug),
    uniqueIndex("collections_user_default_unique")
      .on(table.userId)
      .where(sql`${table.isDefault} = true`),
    index("collections_user_id_idx").on(table.userId),
    check("collections_name_not_blank_check", sql`btrim(${table.name}) <> ''`),
    check(
      "collections_slug_format_check",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      "collections_visibility_check",
      sql`${table.visibility} IN ('private', 'public')`,
    ),
    check(
      "collections_default_private_check",
      sql`NOT ${table.isDefault} OR ${table.visibility} = 'private'`,
    ),
  ],
);

export const collectionPlaces = pgTable(
  "collection_places",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    note: text("note"),
    position: integer("position").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.placeId] }),
    index("collection_places_collection_position_idx").on(
      table.collectionId,
      table.position,
    ),
    index("collection_places_place_id_idx").on(table.placeId),
    check(
      "collection_places_position_nonnegative_check",
      sql`${table.position} >= 0`,
    ),
    check(
      "collection_places_note_length_check",
      sql`${table.note} IS NULL OR char_length(${table.note}) <= 500`,
    ),
  ],
);
