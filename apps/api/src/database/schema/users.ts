import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { userStatusEnum } from "./enums";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }),
    displayName: varchar("display_name", { length: 120 }),
    avatarUrl: varchar("avatar_url", { length: 2048 }),
    status: userStatusEnum("status").default("active").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("users_email_idx").on(table.email)],
);

export const userIdentities = pgTable(
  "user_identities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    providerSubject: varchar("provider_subject", { length: 255 }).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("user_identities_provider_subject_unique").on(
      table.provider,
      table.providerSubject,
    ),
    unique("user_identities_user_provider_unique").on(
      table.userId,
      table.provider,
    ),
    index("user_identities_user_id_idx").on(table.userId),
    check(
      "user_identities_provider_check",
      sql`${table.provider} IN ('google')`,
    ),
  ],
);
