CREATE TYPE "public"."data_type" AS ENUM('synthetic', 'research', 'editorial', 'community');--> statement-breakpoint
CREATE TYPE "public"."day_type" AS ENUM('weekday', 'friday', 'weekend');--> statement-breakpoint
CREATE TYPE "public"."location_verification" AS ENUM('none', 'recalled', 'approximate', 'verified');--> statement-breakpoint
CREATE TYPE "public"."moderation_status" AS ENUM('pending', 'approved', 'flagged', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."place_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."seat_availability" AS ENUM('easy', 'normal', 'difficult', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."service_area_status" AS ENUM('draft', 'active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."size_category" AS ENUM('small', 'medium', 'large', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."time_bucket" AS ENUM('morning', 'midday', 'afternoon', 'evening', 'late');--> statement-breakpoint
CREATE TYPE "public"."visit_mode" AS ENUM('work', 'study', 'solo', 'date', 'friends', 'business_meeting', 'relax', 'late_night');--> statement-breakpoint
CREATE TABLE "place_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" varchar(240),
	"is_simulated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_areas_place_name_unique" UNIQUE("place_id","name"),
	CONSTRAINT "place_areas_id_place_unique" UNIQUE("id","place_id"),
	CONSTRAINT "place_areas_name_not_blank_check" CHECK (btrim("place_areas"."name") <> ''),
	CONSTRAINT "place_areas_description_not_blank_check" CHECK ("place_areas"."description" IS NULL OR btrim("place_areas"."description") <> '')
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"description" text,
	"location" geometry(Point,4326) NOT NULL,
	"address" varchar(240) NOT NULL,
	"district" varchar(120) NOT NULL,
	"price_level" integer,
	"typical_spend_min" integer,
	"typical_spend_max" integer,
	"currency" varchar(3) DEFAULT 'VND' NOT NULL,
	"size_category" "size_category" DEFAULT 'unknown' NOT NULL,
	"estimated_capacity" integer,
	"opening_hours" jsonb,
	"status" "place_status" DEFAULT 'draft' NOT NULL,
	"is_simulated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "places_slug_unique" UNIQUE("slug"),
	CONSTRAINT "places_name_not_blank_check" CHECK (btrim("places"."name") <> ''),
	CONSTRAINT "places_slug_format_check" CHECK ("places"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	CONSTRAINT "places_address_not_blank_check" CHECK (btrim("places"."address") <> ''),
	CONSTRAINT "places_district_not_blank_check" CHECK (btrim("places"."district") <> ''),
	CONSTRAINT "places_price_level_range_check" CHECK ("places"."price_level" IS NULL OR "places"."price_level" BETWEEN 1 AND 4),
	CONSTRAINT "places_typical_spend_min_check" CHECK ("places"."typical_spend_min" IS NULL OR "places"."typical_spend_min" >= 0),
	CONSTRAINT "places_typical_spend_max_check" CHECK ("places"."typical_spend_max" IS NULL OR "places"."typical_spend_max" >= 0),
	CONSTRAINT "places_typical_spend_order_check" CHECK ("places"."typical_spend_min" IS NULL OR "places"."typical_spend_max" IS NULL OR "places"."typical_spend_max" >= "places"."typical_spend_min"),
	CONSTRAINT "places_currency_format_check" CHECK ("places"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "places_estimated_capacity_positive_check" CHECK ("places"."estimated_capacity" IS NULL OR "places"."estimated_capacity" > 0),
	CONSTRAINT "places_location_valid_check" CHECK (NOT ST_IsEmpty("places"."location") AND ST_X("places"."location") BETWEEN -180 AND 180 AND ST_Y("places"."location") BETWEEN -90 AND 90)
);
--> statement-breakpoint
CREATE TABLE "place_service_areas" (
	"place_id" uuid NOT NULL,
	"service_area_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"boundary_version" integer NOT NULL,
	CONSTRAINT "place_service_areas_pkey" PRIMARY KEY("place_id","service_area_id"),
	CONSTRAINT "place_service_areas_boundary_version_positive_check" CHECK ("place_service_areas"."boundary_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "service_area_boundaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_area_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"boundary" geometry(MultiPolygon,4326) NOT NULL,
	"source_storage_key" varchar(512) NOT NULL,
	"source_name" varchar(120) NOT NULL,
	"source_relation_id" varchar(64) NOT NULL,
	"source_url" varchar(2048) NOT NULL,
	"source_license" varchar(120) NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	"checksum" varchar(128) NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_area_boundaries_area_version_unique" UNIQUE("service_area_id","version"),
	CONSTRAINT "service_area_boundaries_version_positive_check" CHECK ("service_area_boundaries"."version" > 0),
	CONSTRAINT "service_area_boundaries_source_storage_key_not_blank_check" CHECK (btrim("service_area_boundaries"."source_storage_key") <> ''),
	CONSTRAINT "service_area_boundaries_source_name_not_blank_check" CHECK (btrim("service_area_boundaries"."source_name") <> ''),
	CONSTRAINT "service_area_boundaries_source_relation_id_not_blank_check" CHECK (btrim("service_area_boundaries"."source_relation_id") <> ''),
	CONSTRAINT "service_area_boundaries_source_url_not_blank_check" CHECK (btrim("service_area_boundaries"."source_url") <> ''),
	CONSTRAINT "service_area_boundaries_source_license_not_blank_check" CHECK (btrim("service_area_boundaries"."source_license") <> ''),
	CONSTRAINT "service_area_boundaries_checksum_not_blank_check" CHECK (btrim("service_area_boundaries"."checksum") <> ''),
	CONSTRAINT "service_area_boundaries_geometry_valid_check" CHECK (NOT ST_IsEmpty("service_area_boundaries"."boundary") AND ST_IsValid("service_area_boundaries"."boundary"))
);
--> statement-breakpoint
CREATE TABLE "service_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"area_type" varchar(32) NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"status" "service_area_status" DEFAULT 'draft' NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_areas_code_unique" UNIQUE("code"),
	CONSTRAINT "service_areas_code_format_check" CHECK ("service_areas"."code" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	CONSTRAINT "service_areas_display_name_not_blank_check" CHECK (btrim("service_areas"."display_name") <> ''),
	CONSTRAINT "service_areas_area_type_not_blank_check" CHECK (btrim("service_areas"."area_type") <> ''),
	CONSTRAINT "service_areas_timezone_not_blank_check" CHECK (btrim("service_areas"."timezone") <> ''),
	CONSTRAINT "service_areas_parent_not_self_check" CHECK ("service_areas"."parent_id" IS NULL OR "service_areas"."parent_id" <> "service_areas"."id")
);
--> statement-breakpoint
CREATE TABLE "vibe_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"place_area_id" uuid,
	"user_id" varchar(128),
	"participant_id" varchar(64),
	"verified_by" varchar(128),
	"visited_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"noise" integer,
	"crowd" integer,
	"lighting" integer,
	"privacy" integer,
	"workability" integer,
	"social_energy" integer,
	"visit_mode" "visit_mode" NOT NULL,
	"seat_availability" "seat_availability" DEFAULT 'unknown' NOT NULL,
	"location_verification" "location_verification" NOT NULL,
	"data_type" "data_type" NOT NULL,
	"is_simulated" boolean DEFAULT false NOT NULL,
	"moderation_status" "moderation_status" DEFAULT 'pending' NOT NULL,
	"day_type" "day_type",
	"time_bucket" time_bucket,
	"consent_recorded" boolean,
	"short_note" varchar(140),
	"source_note" varchar(240),
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vibe_reports_scores_range_check" CHECK (("vibe_reports"."noise" IS NULL OR "vibe_reports"."noise" BETWEEN 1 AND 5)
        AND ("vibe_reports"."crowd" IS NULL OR "vibe_reports"."crowd" BETWEEN 1 AND 5)
        AND ("vibe_reports"."lighting" IS NULL OR "vibe_reports"."lighting" BETWEEN 1 AND 5)
        AND ("vibe_reports"."privacy" IS NULL OR "vibe_reports"."privacy" BETWEEN 1 AND 5)
        AND ("vibe_reports"."workability" IS NULL OR "vibe_reports"."workability" BETWEEN 1 AND 5)
        AND ("vibe_reports"."social_energy" IS NULL OR "vibe_reports"."social_energy" BETWEEN 1 AND 5)),
	CONSTRAINT "vibe_reports_at_least_three_scores_check" CHECK ((
        CASE WHEN "vibe_reports"."noise" IS NULL THEN 0 ELSE 1 END
        + CASE WHEN "vibe_reports"."crowd" IS NULL THEN 0 ELSE 1 END
        + CASE WHEN "vibe_reports"."lighting" IS NULL THEN 0 ELSE 1 END
        + CASE WHEN "vibe_reports"."privacy" IS NULL THEN 0 ELSE 1 END
        + CASE WHEN "vibe_reports"."workability" IS NULL THEN 0 ELSE 1 END
        + CASE WHEN "vibe_reports"."social_energy" IS NULL THEN 0 ELSE 1 END
      ) >= 3),
	CONSTRAINT "vibe_reports_submission_after_visit_check" CHECK ("vibe_reports"."submitted_at" >= "vibe_reports"."visited_at"),
	CONSTRAINT "vibe_reports_verification_after_visit_check" CHECK ("vibe_reports"."verified_at" IS NULL OR "vibe_reports"."verified_at" >= "vibe_reports"."visited_at"),
	CONSTRAINT "vibe_reports_short_note_not_blank_check" CHECK ("vibe_reports"."short_note" IS NULL OR btrim("vibe_reports"."short_note") <> ''),
	CONSTRAINT "vibe_reports_source_note_not_blank_check" CHECK ("vibe_reports"."source_note" IS NULL OR btrim("vibe_reports"."source_note") <> ''),
	CONSTRAINT "vibe_reports_synthetic_contract_check" CHECK ("vibe_reports"."data_type" <> 'synthetic' OR (
        "vibe_reports"."is_simulated" = true
        AND "vibe_reports"."location_verification" = 'none'
        AND "vibe_reports"."day_type" IS NOT NULL
        AND "vibe_reports"."time_bucket" IS NOT NULL
      )),
	CONSTRAINT "vibe_reports_research_contract_check" CHECK ("vibe_reports"."data_type" <> 'research' OR (
        "vibe_reports"."participant_id" IS NOT NULL
        AND btrim("vibe_reports"."participant_id") <> ''
        AND "vibe_reports"."consent_recorded" = true
        AND "vibe_reports"."is_simulated" = false
      )),
	CONSTRAINT "vibe_reports_editorial_contract_check" CHECK ("vibe_reports"."data_type" <> 'editorial' OR (
        "vibe_reports"."verified_by" IS NOT NULL
        AND btrim("vibe_reports"."verified_by") <> ''
        AND "vibe_reports"."verified_at" IS NOT NULL
        AND "vibe_reports"."source_note" IS NOT NULL
        AND "vibe_reports"."location_verification" = 'verified'
        AND "vibe_reports"."moderation_status" = 'approved'
      )),
	CONSTRAINT "vibe_reports_community_contract_check" CHECK ("vibe_reports"."data_type" <> 'community' OR (
        "vibe_reports"."user_id" IS NOT NULL
        AND btrim("vibe_reports"."user_id") <> ''
      ))
);
--> statement-breakpoint
ALTER TABLE "place_areas" ADD CONSTRAINT "place_areas_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "place_service_areas" ADD CONSTRAINT "place_service_areas_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "place_service_areas" ADD CONSTRAINT "place_service_areas_service_area_id_service_areas_id_fk" FOREIGN KEY ("service_area_id") REFERENCES "public"."service_areas"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "place_service_areas" ADD CONSTRAINT "place_service_areas_boundary_version_fkey" FOREIGN KEY ("service_area_id","boundary_version") REFERENCES "public"."service_area_boundaries"("service_area_id","version") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "service_area_boundaries" ADD CONSTRAINT "service_area_boundaries_service_area_id_service_areas_id_fk" FOREIGN KEY ("service_area_id") REFERENCES "public"."service_areas"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "service_areas" ADD CONSTRAINT "service_areas_parent_id_service_areas_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."service_areas"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vibe_reports" ADD CONSTRAINT "vibe_reports_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vibe_reports" ADD CONSTRAINT "vibe_reports_place_area_same_place_fkey" FOREIGN KEY ("place_area_id","place_id") REFERENCES "public"."place_areas"("id","place_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "place_areas_place_id_idx" ON "place_areas" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "places_location_gist_idx" ON "places" USING gist ("location");--> statement-breakpoint
CREATE INDEX "places_status_idx" ON "places" USING btree ("status");--> statement-breakpoint
CREATE INDEX "places_district_idx" ON "places" USING btree ("district");--> statement-breakpoint
CREATE UNIQUE INDEX "place_service_areas_one_primary_unique" ON "place_service_areas" USING btree ("place_id") WHERE "place_service_areas"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "place_service_areas_service_area_id_idx" ON "place_service_areas" USING btree ("service_area_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_area_boundaries_one_current_unique" ON "service_area_boundaries" USING btree ("service_area_id") WHERE "service_area_boundaries"."is_current" = true;--> statement-breakpoint
CREATE INDEX "service_area_boundaries_boundary_gist_idx" ON "service_area_boundaries" USING gist ("boundary");--> statement-breakpoint
CREATE INDEX "service_area_boundaries_area_id_idx" ON "service_area_boundaries" USING btree ("service_area_id");--> statement-breakpoint
CREATE INDEX "service_areas_status_priority_idx" ON "service_areas" USING btree ("status","priority");--> statement-breakpoint
CREATE INDEX "service_areas_parent_id_idx" ON "service_areas" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "vibe_reports_place_visited_at_idx" ON "vibe_reports" USING btree ("place_id","visited_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "vibe_reports_moderation_status_idx" ON "vibe_reports" USING btree ("moderation_status");--> statement-breakpoint
CREATE INDEX "vibe_reports_data_type_idx" ON "vibe_reports" USING btree ("data_type");