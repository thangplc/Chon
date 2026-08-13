import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { places } from "./places";

export type ProviderRawData = Readonly<Record<string, unknown>>;

export const placeSources = pgTable(
  "place_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    provider: varchar("provider", { length: 64 }).notNull(),
    providerPlaceId: varchar("provider_place_id", { length: 255 }).notNull(),
    lastSyncedAt: timestamp("last_synced_at", {
      withTimezone: true,
    }).notNull(),
    sourceUrl: varchar("source_url", { length: 2_048 }),
    rawData: jsonb("raw_data").$type<ProviderRawData>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("place_sources_provider_external_id_unique").on(
      table.provider,
      table.providerPlaceId,
    ),
    unique("place_sources_place_provider_unique").on(
      table.placeId,
      table.provider,
    ),
    unique("place_sources_id_place_unique").on(table.id, table.placeId),
    index("place_sources_place_id_idx").on(table.placeId),
    check(
      "place_sources_provider_format_check",
      sql`${table.provider} ~ '^[a-z0-9][a-z0-9_]{1,63}$'`,
    ),
    check(
      "place_sources_provider_place_id_not_blank_check",
      sql`btrim(${table.providerPlaceId}) <> ''`,
    ),
    check(
      "place_sources_source_url_not_blank_check",
      sql`${table.sourceUrl} IS NULL OR btrim(${table.sourceUrl}) <> ''`,
    ),
  ],
);
