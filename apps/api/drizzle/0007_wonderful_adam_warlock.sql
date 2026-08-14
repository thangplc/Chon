CREATE TYPE "public"."vibe_confidence_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."vibe_snapshot_component" AS ENUM('contribution', 'provider');--> statement-breakpoint
CREATE TABLE "vibe_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"place_area_id" uuid,
	"component" "vibe_snapshot_component" NOT NULL,
	"day_type" "day_type" NOT NULL,
	"time_bucket" time_bucket NOT NULL,
	"noise" double precision,
	"crowd" double precision,
	"lighting" double precision,
	"privacy" double precision,
	"workability" double precision,
	"social_energy" double precision,
	"report_count" integer NOT NULL,
	"confidence_score" double precision NOT NULL,
	"confidence_level" "vibe_confidence_level" NOT NULL,
	"last_report_at" timestamp with time zone NOT NULL,
	"source_data_types" jsonb,
	"is_simulated" boolean DEFAULT false NOT NULL,
	"aggregation_version" varchar(32) NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vibe_snapshots_scores_range_check" CHECK (("vibe_snapshots"."noise" IS NULL OR "vibe_snapshots"."noise" BETWEEN 1 AND 5)
        AND ("vibe_snapshots"."crowd" IS NULL OR "vibe_snapshots"."crowd" BETWEEN 1 AND 5)
        AND ("vibe_snapshots"."lighting" IS NULL OR "vibe_snapshots"."lighting" BETWEEN 1 AND 5)
        AND ("vibe_snapshots"."privacy" IS NULL OR "vibe_snapshots"."privacy" BETWEEN 1 AND 5)
        AND ("vibe_snapshots"."workability" IS NULL OR "vibe_snapshots"."workability" BETWEEN 1 AND 5)
        AND ("vibe_snapshots"."social_energy" IS NULL OR "vibe_snapshots"."social_energy" BETWEEN 1 AND 5)),
	CONSTRAINT "vibe_snapshots_report_count_positive_check" CHECK ("vibe_snapshots"."report_count" > 0),
	CONSTRAINT "vibe_snapshots_confidence_score_range_check" CHECK ("vibe_snapshots"."confidence_score" BETWEEN 0 AND 1),
	CONSTRAINT "vibe_snapshots_source_data_types_not_empty_check" CHECK ("vibe_snapshots"."source_data_types" IS NOT NULL AND jsonb_array_length("vibe_snapshots"."source_data_types") > 0),
	CONSTRAINT "vibe_snapshots_aggregation_version_not_blank_check" CHECK (btrim("vibe_snapshots"."aggregation_version") <> '')
);
--> statement-breakpoint
ALTER TABLE "vibe_snapshots" ADD CONSTRAINT "vibe_snapshots_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vibe_snapshots" ADD CONSTRAINT "vibe_snapshots_place_area_same_place_fkey" FOREIGN KEY ("place_area_id","place_id") REFERENCES "public"."place_areas"("id","place_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "vibe_snapshots_place_level_unique" ON "vibe_snapshots" USING btree ("place_id","component","day_type","time_bucket") WHERE "vibe_snapshots"."place_area_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "vibe_snapshots_area_level_unique" ON "vibe_snapshots" USING btree ("place_id","place_area_id","component","day_type","time_bucket") WHERE "vibe_snapshots"."place_area_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "vibe_snapshots_place_time_idx" ON "vibe_snapshots" USING btree ("place_id","day_type","time_bucket");--> statement-breakpoint
CREATE INDEX "vibe_snapshots_component_idx" ON "vibe_snapshots" USING btree ("component");