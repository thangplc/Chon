import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  foreignKey,
  index,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  dayTypeEnum,
  providerSignalStoragePolicyEnum,
  timeBucketEnum,
} from "./enums";
import { places } from "./places";
import { placeSources } from "./place-sources";

export type ProviderSignalValue = Readonly<Record<string, unknown>>;

export const providerVibeSignals = pgTable(
  "provider_vibe_signals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    placeSourceId: uuid("place_source_id").notNull(),
    providerProduct: varchar("provider_product", { length: 64 }).notNull(),
    providerSignalId: varchar("provider_signal_id", {
      length: 255,
    }).notNull(),
    signalType: varchar("signal_type", { length: 64 }).notNull(),
    signalValue: jsonb("signal_value").$type<ProviderSignalValue>(),
    rawData: jsonb("raw_data").$type<ProviderSignalValue>(),
    noise: doublePrecision("noise"),
    crowd: doublePrecision("crowd"),
    lighting: doublePrecision("lighting"),
    privacy: doublePrecision("privacy"),
    workability: doublePrecision("workability"),
    socialEnergy: doublePrecision("social_energy"),
    mappingVersion: varchar("mapping_version", { length: 64 }),
    dayType: dayTypeEnum("day_type"),
    timeBucket: timeBucketEnum("time_bucket"),
    confidenceScore: doublePrecision("confidence_score").notNull(),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    sourceUrl: varchar("source_url", { length: 2_048 }),
    attributionText: varchar("attribution_text", { length: 512 }),
    storagePolicy: providerSignalStoragePolicyEnum("storage_policy").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.placeSourceId, table.placeId],
      foreignColumns: [placeSources.id, placeSources.placeId],
      name: "provider_vibe_signals_place_source_same_place_fkey",
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    unique("provider_vibe_signals_source_signal_unique").on(
      table.placeSourceId,
      table.providerProduct,
      table.signalType,
      table.providerSignalId,
    ),
    index("provider_vibe_signals_place_type_idx").on(
      table.placeId,
      table.signalType,
    ),
    index("provider_vibe_signals_place_time_idx").on(
      table.placeId,
      table.dayType,
      table.timeBucket,
    ),
    index("provider_vibe_signals_expires_at_idx")
      .on(table.expiresAt)
      .where(sql`${table.expiresAt} IS NOT NULL`),
    check(
      "provider_vibe_signals_provider_product_format_check",
      sql`${table.providerProduct} ~ '^[a-z0-9][a-z0-9_]{1,63}$'`,
    ),
    check(
      "provider_vibe_signals_signal_type_format_check",
      sql`${table.signalType} ~ '^[a-z0-9][a-z0-9_]{1,63}$'`,
    ),
    check(
      "provider_vibe_signals_signal_id_not_blank_check",
      sql`btrim(${table.providerSignalId}) <> ''`,
    ),
    check(
      "provider_vibe_signals_scores_range_check",
      sql`(${table.noise} IS NULL OR ${table.noise} BETWEEN 1 AND 5)
        AND (${table.crowd} IS NULL OR ${table.crowd} BETWEEN 1 AND 5)
        AND (${table.lighting} IS NULL OR ${table.lighting} BETWEEN 1 AND 5)
        AND (${table.privacy} IS NULL OR ${table.privacy} BETWEEN 1 AND 5)
        AND (${table.workability} IS NULL OR ${table.workability} BETWEEN 1 AND 5)
        AND (${table.socialEnergy} IS NULL OR ${table.socialEnergy} BETWEEN 1 AND 5)`,
    ),
    check(
      "provider_vibe_signals_confidence_range_check",
      sql`${table.confidenceScore} BETWEEN 0 AND 1`,
    ),
    check(
      "provider_vibe_signals_mapping_contract_check",
      sql`(
        ${table.noise} IS NULL
        AND ${table.crowd} IS NULL
        AND ${table.lighting} IS NULL
        AND ${table.privacy} IS NULL
        AND ${table.workability} IS NULL
        AND ${table.socialEnergy} IS NULL
        AND ${table.mappingVersion} IS NULL
      ) OR (
        (
          ${table.noise} IS NOT NULL
          OR ${table.crowd} IS NOT NULL
          OR ${table.lighting} IS NOT NULL
          OR ${table.privacy} IS NOT NULL
          OR ${table.workability} IS NOT NULL
          OR ${table.socialEnergy} IS NOT NULL
        )
        AND ${table.mappingVersion} IS NOT NULL
        AND btrim(${table.mappingVersion}) <> ''
      )`,
    ),
    check(
      "provider_vibe_signals_time_context_check",
      sql`(${table.dayType} IS NULL AND ${table.timeBucket} IS NULL)
        OR (${table.dayType} IS NOT NULL AND ${table.timeBucket} IS NOT NULL)`,
    ),
    check(
      "provider_vibe_signals_source_url_not_blank_check",
      sql`${table.sourceUrl} IS NULL OR btrim(${table.sourceUrl}) <> ''`,
    ),
    check(
      "provider_vibe_signals_attribution_not_blank_check",
      sql`${table.attributionText} IS NULL OR btrim(${table.attributionText}) <> ''`,
    ),
    check(
      "provider_vibe_signals_storage_policy_contract_check",
      sql`(
        ${table.storagePolicy} = 'reference_only'
        AND ${table.signalValue} IS NULL
        AND ${table.rawData} IS NULL
        AND ${table.noise} IS NULL
        AND ${table.crowd} IS NULL
        AND ${table.lighting} IS NULL
        AND ${table.privacy} IS NULL
        AND ${table.workability} IS NULL
        AND ${table.socialEnergy} IS NULL
        AND ${table.mappingVersion} IS NULL
        AND ${table.expiresAt} IS NULL
      ) OR (
        ${table.storagePolicy} = 'ttl_cache'
        AND ${table.signalValue} IS NOT NULL
        AND ${table.expiresAt} IS NOT NULL
        AND ${table.expiresAt} > ${table.retrievedAt}
      ) OR (
        ${table.storagePolicy} = 'persist_allowed'
        AND ${table.signalValue} IS NOT NULL
        AND (
          ${table.expiresAt} IS NULL
          OR ${table.expiresAt} > ${table.retrievedAt}
        )
      )`,
    ),
  ],
);
