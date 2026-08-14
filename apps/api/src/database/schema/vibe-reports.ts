// Canonical first-party vibe report schema.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  dataTypeEnum,
  dayTypeEnum,
  locationVerificationEnum,
  moderationStatusEnum,
  seatAvailabilityEnum,
  timeBucketEnum,
  visitModeEnum,
} from "./enums";
import { placeAreas, places } from "./places";

export const vibeReports = pgTable(
  "vibe_reports",
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
    userId: varchar("user_id", { length: 128 }),
    participantId: varchar("participant_id", { length: 64 }),
    verifiedBy: varchar("verified_by", { length: 128 }),
    visitedAt: timestamp("visited_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    noise: integer("noise"),
    crowd: integer("crowd"),
    lighting: integer("lighting"),
    privacy: integer("privacy"),
    workability: integer("workability"),
    socialEnergy: integer("social_energy"),
    visitMode: visitModeEnum("visit_mode").notNull(),
    seatAvailability: seatAvailabilityEnum("seat_availability")
      .default("unknown")
      .notNull(),
    locationVerification: locationVerificationEnum(
      "location_verification",
    ).notNull(),
    dataType: dataTypeEnum("data_type").notNull(),
    isSimulated: boolean("is_simulated").default(false).notNull(),
    moderationStatus: moderationStatusEnum("moderation_status")
      .default("pending")
      .notNull(),
    dayType: dayTypeEnum("day_type"),
    timeBucket: timeBucketEnum("time_bucket"),
    consentRecorded: boolean("consent_recorded"),
    shortNote: varchar("short_note", { length: 140 }),
    sourceNote: varchar("source_note", { length: 240 }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
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
      name: "vibe_reports_place_area_same_place_fkey",
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    index("vibe_reports_place_visited_at_idx").on(
      table.placeId,
      table.visitedAt.desc(),
    ),
    index("vibe_reports_moderation_status_idx").on(table.moderationStatus),
    index("vibe_reports_data_type_idx").on(table.dataType),
    check(
      "vibe_reports_scores_range_check",
      sql`(${table.noise} IS NULL OR ${table.noise} BETWEEN 1 AND 5)
        AND (${table.crowd} IS NULL OR ${table.crowd} BETWEEN 1 AND 5)
        AND (${table.lighting} IS NULL OR ${table.lighting} BETWEEN 1 AND 5)
        AND (${table.privacy} IS NULL OR ${table.privacy} BETWEEN 1 AND 5)
        AND (${table.workability} IS NULL OR ${table.workability} BETWEEN 1 AND 5)
        AND (${table.socialEnergy} IS NULL OR ${table.socialEnergy} BETWEEN 1 AND 5)`,
    ),
    check(
      "vibe_reports_internal_id_format_check",
      sql`${table.internalId} ~ '^[a-z0-9_]{3,64}$'`,
    ),
    check(
      "vibe_reports_at_least_three_scores_check",
      sql`(
        CASE WHEN ${table.noise} IS NULL THEN 0 ELSE 1 END
        + CASE WHEN ${table.crowd} IS NULL THEN 0 ELSE 1 END
        + CASE WHEN ${table.lighting} IS NULL THEN 0 ELSE 1 END
        + CASE WHEN ${table.privacy} IS NULL THEN 0 ELSE 1 END
        + CASE WHEN ${table.workability} IS NULL THEN 0 ELSE 1 END
        + CASE WHEN ${table.socialEnergy} IS NULL THEN 0 ELSE 1 END
      ) >= 3`,
    ),
    check(
      "vibe_reports_submission_after_visit_check",
      sql`${table.submittedAt} >= ${table.visitedAt}`,
    ),
    check(
      "vibe_reports_verification_after_visit_check",
      sql`${table.verifiedAt} IS NULL OR ${table.verifiedAt} >= ${table.visitedAt}`,
    ),
    check(
      "vibe_reports_short_note_not_blank_check",
      sql`${table.shortNote} IS NULL OR btrim(${table.shortNote}) <> ''`,
    ),
    check(
      "vibe_reports_source_note_not_blank_check",
      sql`${table.sourceNote} IS NULL OR btrim(${table.sourceNote}) <> ''`,
    ),
    check(
      "vibe_reports_synthetic_contract_check",
      sql`${table.dataType} <> 'synthetic' OR (
        ${table.isSimulated} = true
        AND ${table.locationVerification} = 'none'
        AND ${table.dayType} IS NOT NULL
        AND ${table.timeBucket} IS NOT NULL
      )`,
    ),
    check(
      "vibe_reports_research_contract_check",
      sql`${table.dataType} <> 'research' OR (
        ${table.isSimulated} = true
        OR (
          ${table.participantId} IS NOT NULL
          AND btrim(${table.participantId}) <> ''
          AND ${table.consentRecorded} = true
        )
      )`,
    ),
    check(
      "vibe_reports_editorial_contract_check",
      sql`${table.dataType} <> 'editorial' OR (
        ${table.isSimulated} = true
        OR (
          ${table.verifiedBy} IS NOT NULL
          AND btrim(${table.verifiedBy}) <> ''
          AND ${table.verifiedAt} IS NOT NULL
          AND ${table.sourceNote} IS NOT NULL
          AND ${table.locationVerification} = 'verified'
          AND ${table.moderationStatus} = 'approved'
        )
      )`,
    ),
    check(
      "vibe_reports_community_contract_check",
      sql`${table.dataType} <> 'community' OR (
        ${table.userId} IS NOT NULL
        AND btrim(${table.userId}) <> ''
      )`,
    ),
  ],
);
