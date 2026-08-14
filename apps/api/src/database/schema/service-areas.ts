// Canonical service-area and boundary schema.
import { sql } from "drizzle-orm";
import {
  AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { serviceAreaStatusEnum } from "./enums";
import { geometryMultiPolygon4326 } from "./postgis";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const serviceAreas = pgTable(
  "service_areas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 64 }).notNull().unique(),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    areaType: varchar("area_type", { length: 32 }).notNull(),
    timezone: varchar("timezone", { length: 64 }).notNull(),
    priority: integer("priority").default(0).notNull(),
    status: serviceAreaStatusEnum("status").default("draft").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => serviceAreas.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    ...timestamps,
  },
  (table) => [
    index("service_areas_status_priority_idx").on(table.status, table.priority),
    index("service_areas_parent_id_idx").on(table.parentId),
    check(
      "service_areas_code_format_check",
      sql`${table.code} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      "service_areas_display_name_not_blank_check",
      sql`btrim(${table.displayName}) <> ''`,
    ),
    check(
      "service_areas_area_type_not_blank_check",
      sql`btrim(${table.areaType}) <> ''`,
    ),
    check(
      "service_areas_timezone_not_blank_check",
      sql`btrim(${table.timezone}) <> ''`,
    ),
    check(
      "service_areas_parent_not_self_check",
      sql`${table.parentId} IS NULL OR ${table.parentId} <> ${table.id}`,
    ),
  ],
);

export const serviceAreaBoundaries = pgTable(
  "service_area_boundaries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    serviceAreaId: uuid("service_area_id")
      .notNull()
      .references(() => serviceAreas.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    version: integer("version").notNull(),
    boundary: geometryMultiPolygon4326("boundary").notNull(),
    sourceStorageKey: varchar("source_storage_key", {
      length: 512,
    }).notNull(),
    sourceName: varchar("source_name", { length: 120 }).notNull(),
    sourceRelationId: varchar("source_relation_id", { length: 64 }).notNull(),
    sourceUrl: varchar("source_url", { length: 2_048 }).notNull(),
    sourceLicense: varchar("source_license", { length: 120 }).notNull(),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
    checksum: varchar("checksum", { length: 128 }).notNull(),
    isCurrent: boolean("is_current").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("service_area_boundaries_area_version_unique").on(
      table.serviceAreaId,
      table.version,
    ),
    uniqueIndex("service_area_boundaries_one_current_unique")
      .on(table.serviceAreaId)
      .where(sql`${table.isCurrent} = true`),
    index("service_area_boundaries_boundary_gist_idx").using(
      "gist",
      table.boundary,
    ),
    index("service_area_boundaries_area_id_idx").on(table.serviceAreaId),
    check(
      "service_area_boundaries_version_positive_check",
      sql`${table.version} > 0`,
    ),
    check(
      "service_area_boundaries_source_storage_key_not_blank_check",
      sql`btrim(${table.sourceStorageKey}) <> ''`,
    ),
    check(
      "service_area_boundaries_source_name_not_blank_check",
      sql`btrim(${table.sourceName}) <> ''`,
    ),
    check(
      "service_area_boundaries_source_relation_id_not_blank_check",
      sql`btrim(${table.sourceRelationId}) <> ''`,
    ),
    check(
      "service_area_boundaries_source_url_not_blank_check",
      sql`btrim(${table.sourceUrl}) <> ''`,
    ),
    check(
      "service_area_boundaries_source_license_not_blank_check",
      sql`btrim(${table.sourceLicense}) <> ''`,
    ),
    check(
      "service_area_boundaries_checksum_not_blank_check",
      sql`btrim(${table.checksum}) <> ''`,
    ),
    check(
      "service_area_boundaries_geometry_valid_check",
      sql`NOT ST_IsEmpty(${table.boundary}) AND ST_IsValid(${table.boundary})`,
    ),
  ],
);
