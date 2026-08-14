// Canonical media schema owned by the backend application.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  mediaRightsStatusEnum,
  mediaSourceTypeEnum,
  mediaTypeEnum,
  moderationStatusEnum,
} from "./enums";
import { placeAreas, places } from "./places";

export const placeMedia = pgTable(
  "place_media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    internalId: varchar("internal_id", { length: 64 }).notNull().unique(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    placeAreaId: uuid("place_area_id"),
    mediaType: mediaTypeEnum("media_type").default("image").notNull(),
    storageKey: varchar("storage_key", { length: 512 }),
    sourceUrl: varchar("source_url", { length: 2_048 }),
    thumbnailKey: varchar("thumbnail_key", { length: 512 }),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sourceType: mediaSourceTypeEnum("source_type").notNull(),
    sourceReference: varchar("source_reference", { length: 255 }),
    rightsStatus: mediaRightsStatusEnum("rights_status").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    uploadedBy: varchar("uploaded_by", { length: 128 }),
    altText: varchar("alt_text", { length: 240 }).notNull(),
    sortOrder: integer("sort_order").notNull(),
    moderationStatus: moderationStatusEnum("moderation_status").notNull(),
    isSimulated: boolean("is_simulated").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.placeAreaId, table.placeId],
      foreignColumns: [placeAreas.id, placeAreas.placeId],
      name: "place_media_place_area_same_place_fkey",
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    unique("place_media_place_sort_order_unique").on(
      table.placeId,
      table.sortOrder,
    ),
    index("place_media_place_id_idx").on(table.placeId),
    check(
      "place_media_internal_id_format_check",
      sql`${table.internalId} ~ '^[a-z0-9_]{3,64}$'`,
    ),
    check(
      "place_media_exactly_one_location_check",
      sql`(${table.storageKey} IS NOT NULL) <> (${table.sourceUrl} IS NOT NULL)`,
    ),
    check(
      "place_media_dimensions_positive_check",
      sql`${table.width} > 0 AND ${table.height} > 0`,
    ),
    check(
      "place_media_sort_order_range_check",
      sql`${table.sortOrder} BETWEEN 0 AND 4`,
    ),
    check(
      "place_media_alt_text_not_blank_check",
      sql`btrim(${table.altText}) <> ''`,
    ),
    check(
      "place_media_synthetic_contract_check",
      sql`${table.sourceType} <> 'synthetic' OR (
        ${table.isSimulated} = true
        AND ${table.storageKey} IS NOT NULL
        AND ${table.rightsStatus} = 'verified'
      )`,
    ),
  ],
);
