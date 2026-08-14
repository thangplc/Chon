// Derived vibe snapshots used for fast time-context reads.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import type { VibeReportForAggregation } from "../../../../../packages/domain/src/vibe/vibe-snapshot";
import {
  dayTypeEnum,
  timeBucketEnum,
  vibeConfidenceLevelEnum,
  vibeSnapshotComponentEnum,
} from "./enums";
import { placeAreas, places } from "./places";

export const vibeSnapshots = pgTable(
  "vibe_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    placeAreaId: uuid("place_area_id"),
    component: vibeSnapshotComponentEnum("component").notNull(),
    dayType: dayTypeEnum("day_type").notNull(),
    timeBucket: timeBucketEnum("time_bucket").notNull(),
    noise: doublePrecision("noise"),
    crowd: doublePrecision("crowd"),
    lighting: doublePrecision("lighting"),
    privacy: doublePrecision("privacy"),
    workability: doublePrecision("workability"),
    socialEnergy: doublePrecision("social_energy"),
    reportCount: integer("report_count").notNull(),
    confidenceScore: doublePrecision("confidence_score").notNull(),
    confidenceLevel: vibeConfidenceLevelEnum("confidence_level").notNull(),
    lastReportAt: timestamp("last_report_at", {
      withTimezone: true,
    }).notNull(),
    sourceDataTypes:
      jsonb("source_data_types").$type<
        readonly VibeReportForAggregation["dataType"][]
      >(),
    isSimulated: boolean("is_simulated").default(false).notNull(),
    aggregationVersion: varchar("aggregation_version", {
      length: 32,
    }).notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.placeAreaId, table.placeId],
      foreignColumns: [placeAreas.id, placeAreas.placeId],
      name: "vibe_snapshots_place_area_same_place_fkey",
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    uniqueIndex("vibe_snapshots_place_level_unique")
      .on(table.placeId, table.component, table.dayType, table.timeBucket)
      .where(sql`${table.placeAreaId} IS NULL`),
    uniqueIndex("vibe_snapshots_area_level_unique")
      .on(
        table.placeId,
        table.placeAreaId,
        table.component,
        table.dayType,
        table.timeBucket,
      )
      .where(sql`${table.placeAreaId} IS NOT NULL`),
    index("vibe_snapshots_place_time_idx").on(
      table.placeId,
      table.dayType,
      table.timeBucket,
    ),
    index("vibe_snapshots_component_idx").on(table.component),
    check(
      "vibe_snapshots_scores_range_check",
      sql`(${table.noise} IS NULL OR ${table.noise} BETWEEN 1 AND 5)
        AND (${table.crowd} IS NULL OR ${table.crowd} BETWEEN 1 AND 5)
        AND (${table.lighting} IS NULL OR ${table.lighting} BETWEEN 1 AND 5)
        AND (${table.privacy} IS NULL OR ${table.privacy} BETWEEN 1 AND 5)
        AND (${table.workability} IS NULL OR ${table.workability} BETWEEN 1 AND 5)
        AND (${table.socialEnergy} IS NULL OR ${table.socialEnergy} BETWEEN 1 AND 5)`,
    ),
    check(
      "vibe_snapshots_report_count_positive_check",
      sql`${table.reportCount} > 0`,
    ),
    check(
      "vibe_snapshots_confidence_score_range_check",
      sql`${table.confidenceScore} BETWEEN 0 AND 1`,
    ),
    check(
      "vibe_snapshots_source_data_types_not_empty_check",
      sql`${table.sourceDataTypes} IS NOT NULL AND jsonb_array_length(${table.sourceDataTypes}) > 0`,
    ),
    check(
      "vibe_snapshots_aggregation_version_not_blank_check",
      sql`btrim(${table.aggregationVersion}) <> ''`,
    ),
  ],
);
