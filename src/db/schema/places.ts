import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { placeStatusEnum, sizeCategoryEnum } from "./enums";
import { geometryPoint4326 } from "./postgis";

export type OpeningHours = Readonly<Record<string, unknown>>;

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const places = pgTable(
  "places",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    internalId: varchar("internal_id", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    description: text("description"),
    location: geometryPoint4326("location").notNull(),
    address: varchar("address", { length: 240 }).notNull(),
    district: varchar("district", { length: 120 }).notNull(),
    priceLevel: integer("price_level"),
    typicalSpendMin: integer("typical_spend_min"),
    typicalSpendMax: integer("typical_spend_max"),
    currency: varchar("currency", { length: 3 }).default("VND").notNull(),
    sizeCategory: sizeCategoryEnum("size_category")
      .default("unknown")
      .notNull(),
    estimatedCapacity: integer("estimated_capacity"),
    openingHours: jsonb("opening_hours").$type<OpeningHours>(),
    status: placeStatusEnum("status").default("draft").notNull(),
    isSimulated: boolean("is_simulated").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    index("places_location_gist_idx").using("gist", table.location),
    index("places_location_geography_gist_idx").using(
      "gist",
      sql`(${table.location}::geography)`,
    ),
    index("places_status_idx").on(table.status),
    index("places_district_idx").on(table.district),
    check("places_name_not_blank_check", sql`btrim(${table.name}) <> ''`),
    check(
      "places_internal_id_format_check",
      sql`${table.internalId} ~ '^[a-z0-9_]{3,64}$'`,
    ),
    check(
      "places_slug_format_check",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check("places_address_not_blank_check", sql`btrim(${table.address}) <> ''`),
    check(
      "places_district_not_blank_check",
      sql`btrim(${table.district}) <> ''`,
    ),
    check(
      "places_price_level_range_check",
      sql`${table.priceLevel} IS NULL OR ${table.priceLevel} BETWEEN 1 AND 4`,
    ),
    check(
      "places_typical_spend_min_check",
      sql`${table.typicalSpendMin} IS NULL OR ${table.typicalSpendMin} >= 0`,
    ),
    check(
      "places_typical_spend_max_check",
      sql`${table.typicalSpendMax} IS NULL OR ${table.typicalSpendMax} >= 0`,
    ),
    check(
      "places_typical_spend_order_check",
      sql`${table.typicalSpendMin} IS NULL OR ${table.typicalSpendMax} IS NULL OR ${table.typicalSpendMax} >= ${table.typicalSpendMin}`,
    ),
    check(
      "places_currency_format_check",
      sql`${table.currency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      "places_estimated_capacity_positive_check",
      sql`${table.estimatedCapacity} IS NULL OR ${table.estimatedCapacity} > 0`,
    ),
    check(
      "places_location_valid_check",
      sql`NOT ST_IsEmpty(${table.location}) AND ST_X(${table.location}) BETWEEN -180 AND 180 AND ST_Y(${table.location}) BETWEEN -90 AND 90`,
    ),
  ],
);

export const placeAreas = pgTable(
  "place_areas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    internalId: varchar("internal_id", { length: 64 }).notNull().unique(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    name: varchar("name", { length: 80 }).notNull(),
    description: varchar("description", { length: 240 }),
    isSimulated: boolean("is_simulated").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("place_areas_place_name_unique").on(table.placeId, table.name),
    unique("place_areas_id_place_unique").on(table.id, table.placeId),
    index("place_areas_place_id_idx").on(table.placeId),
    check("place_areas_name_not_blank_check", sql`btrim(${table.name}) <> ''`),
    check(
      "place_areas_internal_id_format_check",
      sql`${table.internalId} ~ '^[a-z0-9_]{3,64}$'`,
    ),
    check(
      "place_areas_description_not_blank_check",
      sql`${table.description} IS NULL OR btrim(${table.description}) <> ''`,
    ),
  ],
);
