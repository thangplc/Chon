import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import type { AnalyticsEventPayload } from "../../../../../packages/contracts/src/analytics";

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventName: varchar("event_name", { length: 64 }).notNull(),
    sessionId: varchar("session_id", { length: 64 }).notNull(),
    payload: jsonb("payload").$type<AnalyticsEventPayload>().notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("analytics_events_event_name_occurred_at_idx").on(
      table.eventName,
      table.occurredAt.desc(),
    ),
    index("analytics_events_session_id_idx").on(table.sessionId),
    check(
      "analytics_events_event_name_check",
      sql`${table.eventName} IN ('explore_filter_changed', 'explore_results_viewed', 'explore_share_clicked', 'place_save_succeeded', 'collection_share_clicked', 'directions_opened')`,
    ),
    check(
      "analytics_events_session_id_check",
      sql`${table.sessionId} ~ '^[a-zA-Z0-9_-]{8,64}$'`,
    ),
    check(
      "analytics_events_payload_object_check",
      sql`jsonb_typeof(${table.payload}) = 'object'`,
    ),
  ],
);
