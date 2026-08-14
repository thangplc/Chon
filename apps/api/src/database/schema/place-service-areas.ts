// Canonical service-area membership schema.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { places } from "./places";
import { serviceAreaBoundaries, serviceAreas } from "./service-areas";

export const placeServiceAreas = pgTable(
  "place_service_areas",
  {
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    serviceAreaId: uuid("service_area_id")
      .notNull()
      .references(() => serviceAreas.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    isPrimary: boolean("is_primary").default(false).notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    boundaryVersion: integer("boundary_version").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.placeId, table.serviceAreaId],
      name: "place_service_areas_pkey",
    }),
    foreignKey({
      columns: [table.serviceAreaId, table.boundaryVersion],
      foreignColumns: [
        serviceAreaBoundaries.serviceAreaId,
        serviceAreaBoundaries.version,
      ],
      name: "place_service_areas_boundary_version_fkey",
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    uniqueIndex("place_service_areas_one_primary_unique")
      .on(table.placeId)
      .where(sql`${table.isPrimary} = true`),
    index("place_service_areas_service_area_id_idx").on(table.serviceAreaId),
    check(
      "place_service_areas_boundary_version_positive_check",
      sql`${table.boundaryVersion} > 0`,
    ),
  ],
);
