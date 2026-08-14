CREATE TYPE "public"."media_rights_status" AS ENUM('verified', 'provider_allowed', 'pending', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."media_source_type" AS ENUM('provider', 'editorial', 'community', 'synthetic');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('image');--> statement-breakpoint
CREATE TABLE "place_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"internal_id" varchar(64) NOT NULL,
	"place_id" uuid NOT NULL,
	"place_area_id" uuid,
	"media_type" "media_type" DEFAULT 'image' NOT NULL,
	"storage_key" varchar(512),
	"source_url" varchar(2048),
	"thumbnail_key" varchar(512),
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"source_type" "media_source_type" NOT NULL,
	"source_reference" varchar(255),
	"rights_status" "media_rights_status" NOT NULL,
	"captured_at" timestamp with time zone,
	"uploaded_by" varchar(128),
	"alt_text" varchar(240) NOT NULL,
	"sort_order" integer NOT NULL,
	"moderation_status" "moderation_status" NOT NULL,
	"is_simulated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_media_internal_id_unique" UNIQUE("internal_id"),
	CONSTRAINT "place_media_place_sort_order_unique" UNIQUE("place_id","sort_order"),
	CONSTRAINT "place_media_internal_id_format_check" CHECK ("place_media"."internal_id" ~ '^[a-z0-9_]{3,64}$'),
	CONSTRAINT "place_media_exactly_one_location_check" CHECK (("place_media"."storage_key" IS NOT NULL) <> ("place_media"."source_url" IS NOT NULL)),
	CONSTRAINT "place_media_dimensions_positive_check" CHECK ("place_media"."width" > 0 AND "place_media"."height" > 0),
	CONSTRAINT "place_media_sort_order_range_check" CHECK ("place_media"."sort_order" BETWEEN 0 AND 4),
	CONSTRAINT "place_media_alt_text_not_blank_check" CHECK (btrim("place_media"."alt_text") <> ''),
	CONSTRAINT "place_media_synthetic_contract_check" CHECK ("place_media"."source_type" <> 'synthetic' OR (
        "place_media"."is_simulated" = true
        AND "place_media"."storage_key" IS NOT NULL
        AND "place_media"."rights_status" = 'verified'
      ))
);
--> statement-breakpoint
ALTER TABLE "place_media" ADD CONSTRAINT "place_media_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "place_media" ADD CONSTRAINT "place_media_place_area_same_place_fkey" FOREIGN KEY ("place_area_id","place_id") REFERENCES "public"."place_areas"("id","place_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "place_media_place_id_idx" ON "place_media" USING btree ("place_id");
