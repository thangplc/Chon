CREATE TABLE "place_metadata_overlays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"environment" varchar(16) NOT NULL,
	"opening_hours" jsonb,
	"price_level" integer,
	"typical_spend_min" integer,
	"typical_spend_max" integer,
	"currency" varchar(3) DEFAULT 'VND' NOT NULL,
	"size_category" "size_category" DEFAULT 'unknown' NOT NULL,
	"estimated_capacity" integer,
	"amenities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"space_note" varchar(240),
	"source_note" varchar(240),
	"updated_by" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_metadata_overlays_place_environment_unique" UNIQUE("place_id","environment"),
	CONSTRAINT "place_metadata_overlays_environment_check" CHECK ("place_metadata_overlays"."environment" IN ('local', 'ci', 'staging')),
	CONSTRAINT "place_metadata_overlays_price_level_range_check" CHECK ("place_metadata_overlays"."price_level" IS NULL OR "place_metadata_overlays"."price_level" BETWEEN 1 AND 4),
	CONSTRAINT "place_metadata_overlays_typical_spend_min_check" CHECK ("place_metadata_overlays"."typical_spend_min" IS NULL OR "place_metadata_overlays"."typical_spend_min" >= 0),
	CONSTRAINT "place_metadata_overlays_typical_spend_max_check" CHECK ("place_metadata_overlays"."typical_spend_max" IS NULL OR "place_metadata_overlays"."typical_spend_max" >= 0),
	CONSTRAINT "place_metadata_overlays_typical_spend_order_check" CHECK ("place_metadata_overlays"."typical_spend_min" IS NULL OR "place_metadata_overlays"."typical_spend_max" IS NULL OR "place_metadata_overlays"."typical_spend_max" >= "place_metadata_overlays"."typical_spend_min"),
	CONSTRAINT "place_metadata_overlays_currency_format_check" CHECK ("place_metadata_overlays"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "place_metadata_overlays_capacity_positive_check" CHECK ("place_metadata_overlays"."estimated_capacity" IS NULL OR "place_metadata_overlays"."estimated_capacity" > 0),
	CONSTRAINT "place_metadata_overlays_amenities_array_check" CHECK (jsonb_typeof("place_metadata_overlays"."amenities") = 'array'),
	CONSTRAINT "place_metadata_overlays_updated_by_not_blank_check" CHECK (btrim("place_metadata_overlays"."updated_by") <> '')
);
--> statement-breakpoint
ALTER TABLE "place_metadata_overlays" ADD CONSTRAINT "place_metadata_overlays_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "place_metadata_overlays_place_id_idx" ON "place_metadata_overlays" USING btree ("place_id");