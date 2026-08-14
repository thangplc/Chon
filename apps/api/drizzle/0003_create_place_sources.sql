CREATE TABLE "place_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"provider" varchar(64) NOT NULL,
	"provider_place_id" varchar(255) NOT NULL,
	"last_synced_at" timestamp with time zone NOT NULL,
	"source_url" varchar(2048),
	"raw_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_sources_provider_external_id_unique" UNIQUE("provider","provider_place_id"),
	CONSTRAINT "place_sources_place_provider_unique" UNIQUE("place_id","provider"),
	CONSTRAINT "place_sources_provider_format_check" CHECK ("place_sources"."provider" ~ '^[a-z0-9][a-z0-9_]{1,63}$'),
	CONSTRAINT "place_sources_provider_place_id_not_blank_check" CHECK (btrim("place_sources"."provider_place_id") <> ''),
	CONSTRAINT "place_sources_source_url_not_blank_check" CHECK ("place_sources"."source_url" IS NULL OR btrim("place_sources"."source_url") <> '')
);
--> statement-breakpoint
ALTER TABLE "place_sources" ADD CONSTRAINT "place_sources_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "place_sources_place_id_idx" ON "place_sources" USING btree ("place_id");