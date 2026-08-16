// Synthetic metadata overlays are isolated from canonical provider/editorial data.
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { PlaceOpeningHours } from "../../../../../packages/domain/src/place-detail/place-detail";

import { sizeCategoryEnum } from "./enums";
import { places } from "./places";

export type PlaceMetadataOverlayAmenities = readonly string[];

export const placeMetadataOverlays = pgTable(
  "place_metadata_overlays",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    environment: varchar("environment", { length: 16 }).notNull(),
    openingHours: jsonb("opening_hours").$type<PlaceOpeningHours>(),
    priceLevel: integer("price_level"),
    typicalSpendMin: integer("typical_spend_min"),
    typicalSpendMax: integer("typical_spend_max"),
    currency: varchar("currency", { length: 3 }).default("VND").notNull(),
    sizeCategory: sizeCategoryEnum("size_category")
      .default("unknown")
      .notNull(),
    estimatedCapacity: integer("estimated_capacity"),
    amenities: jsonb("amenities")
      .$type<PlaceMetadataOverlayAmenities>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    spaceNote: varchar("space_note", { length: 240 }),
    sourceNote: varchar("source_note", { length: 240 }),
    updatedBy: varchar("updated_by", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("place_metadata_overlays_place_environment_unique").on(
      table.placeId,
      table.environment,
    ),
    index("place_metadata_overlays_place_id_idx").on(table.placeId),
    check(
      "place_metadata_overlays_environment_check",
      sql`${table.environment} IN ('local', 'ci', 'staging')`,
    ),
    check(
      "place_metadata_overlays_price_level_range_check",
      sql`${table.priceLevel} IS NULL OR ${table.priceLevel} BETWEEN 1 AND 4`,
    ),
    check(
      "place_metadata_overlays_typical_spend_min_check",
      sql`${table.typicalSpendMin} IS NULL OR ${table.typicalSpendMin} >= 0`,
    ),
    check(
      "place_metadata_overlays_typical_spend_max_check",
      sql`${table.typicalSpendMax} IS NULL OR ${table.typicalSpendMax} >= 0`,
    ),
    check(
      "place_metadata_overlays_typical_spend_order_check",
      sql`${table.typicalSpendMin} IS NULL OR ${table.typicalSpendMax} IS NULL OR ${table.typicalSpendMax} >= ${table.typicalSpendMin}`,
    ),
    check(
      "place_metadata_overlays_currency_format_check",
      sql`${table.currency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      "place_metadata_overlays_capacity_positive_check",
      sql`${table.estimatedCapacity} IS NULL OR ${table.estimatedCapacity} > 0`,
    ),
    check(
      "place_metadata_overlays_amenities_array_check",
      sql`jsonb_typeof(${table.amenities}) = 'array'`,
    ),
    check(
      "place_metadata_overlays_updated_by_not_blank_check",
      sql`btrim(${table.updatedBy}) <> ''`,
    ),
  ],
);
