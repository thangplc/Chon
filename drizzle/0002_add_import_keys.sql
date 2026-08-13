ALTER TABLE "vibe_reports" DROP CONSTRAINT "vibe_reports_research_contract_check";--> statement-breakpoint
ALTER TABLE "vibe_reports" DROP CONSTRAINT "vibe_reports_editorial_contract_check";--> statement-breakpoint
ALTER TABLE "place_areas" ADD COLUMN "internal_id" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "internal_id" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "vibe_reports" ADD COLUMN "internal_id" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "place_areas" ADD CONSTRAINT "place_areas_internal_id_unique" UNIQUE("internal_id");--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_internal_id_unique" UNIQUE("internal_id");--> statement-breakpoint
ALTER TABLE "vibe_reports" ADD CONSTRAINT "vibe_reports_internal_id_unique" UNIQUE("internal_id");--> statement-breakpoint
ALTER TABLE "place_areas" ADD CONSTRAINT "place_areas_internal_id_format_check" CHECK ("place_areas"."internal_id" ~ '^[a-z0-9_]{3,64}$');--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_internal_id_format_check" CHECK ("places"."internal_id" ~ '^[a-z0-9_]{3,64}$');--> statement-breakpoint
ALTER TABLE "vibe_reports" ADD CONSTRAINT "vibe_reports_internal_id_format_check" CHECK ("vibe_reports"."internal_id" ~ '^[a-z0-9_]{3,64}$');--> statement-breakpoint
ALTER TABLE "vibe_reports" ADD CONSTRAINT "vibe_reports_research_contract_check" CHECK ("vibe_reports"."data_type" <> 'research' OR (
        "vibe_reports"."is_simulated" = true
        OR (
          "vibe_reports"."participant_id" IS NOT NULL
          AND btrim("vibe_reports"."participant_id") <> ''
          AND "vibe_reports"."consent_recorded" = true
        )
      ));--> statement-breakpoint
ALTER TABLE "vibe_reports" ADD CONSTRAINT "vibe_reports_editorial_contract_check" CHECK ("vibe_reports"."data_type" <> 'editorial' OR (
        "vibe_reports"."is_simulated" = true
        OR (
          "vibe_reports"."verified_by" IS NOT NULL
          AND btrim("vibe_reports"."verified_by") <> ''
          AND "vibe_reports"."verified_at" IS NOT NULL
          AND "vibe_reports"."source_note" IS NOT NULL
          AND "vibe_reports"."location_verification" = 'verified'
          AND "vibe_reports"."moderation_status" = 'approved'
        )
      ));