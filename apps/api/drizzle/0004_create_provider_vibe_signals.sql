CREATE TYPE "public"."provider_signal_storage_policy" AS ENUM('reference_only', 'ttl_cache', 'persist_allowed');--> statement-breakpoint
CREATE TABLE "provider_vibe_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"place_source_id" uuid NOT NULL,
	"provider_product" varchar(64) NOT NULL,
	"provider_signal_id" varchar(255) NOT NULL,
	"signal_type" varchar(64) NOT NULL,
	"signal_value" jsonb,
	"raw_data" jsonb,
	"noise" double precision,
	"crowd" double precision,
	"lighting" double precision,
	"privacy" double precision,
	"workability" double precision,
	"social_energy" double precision,
	"mapping_version" varchar(64),
	"day_type" "day_type",
	"time_bucket" time_bucket,
	"confidence_score" double precision NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	"observed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"source_url" varchar(2048),
	"attribution_text" varchar(512),
	"storage_policy" "provider_signal_storage_policy" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_vibe_signals_source_signal_unique" UNIQUE("place_source_id","provider_product","signal_type","provider_signal_id"),
	CONSTRAINT "provider_vibe_signals_provider_product_format_check" CHECK ("provider_vibe_signals"."provider_product" ~ '^[a-z0-9][a-z0-9_]{1,63}$'),
	CONSTRAINT "provider_vibe_signals_signal_type_format_check" CHECK ("provider_vibe_signals"."signal_type" ~ '^[a-z0-9][a-z0-9_]{1,63}$'),
	CONSTRAINT "provider_vibe_signals_signal_id_not_blank_check" CHECK (btrim("provider_vibe_signals"."provider_signal_id") <> ''),
	CONSTRAINT "provider_vibe_signals_scores_range_check" CHECK (("provider_vibe_signals"."noise" IS NULL OR "provider_vibe_signals"."noise" BETWEEN 1 AND 5)
        AND ("provider_vibe_signals"."crowd" IS NULL OR "provider_vibe_signals"."crowd" BETWEEN 1 AND 5)
        AND ("provider_vibe_signals"."lighting" IS NULL OR "provider_vibe_signals"."lighting" BETWEEN 1 AND 5)
        AND ("provider_vibe_signals"."privacy" IS NULL OR "provider_vibe_signals"."privacy" BETWEEN 1 AND 5)
        AND ("provider_vibe_signals"."workability" IS NULL OR "provider_vibe_signals"."workability" BETWEEN 1 AND 5)
        AND ("provider_vibe_signals"."social_energy" IS NULL OR "provider_vibe_signals"."social_energy" BETWEEN 1 AND 5)),
	CONSTRAINT "provider_vibe_signals_confidence_range_check" CHECK ("provider_vibe_signals"."confidence_score" BETWEEN 0 AND 1),
	CONSTRAINT "provider_vibe_signals_mapping_contract_check" CHECK ((
        "provider_vibe_signals"."noise" IS NULL
        AND "provider_vibe_signals"."crowd" IS NULL
        AND "provider_vibe_signals"."lighting" IS NULL
        AND "provider_vibe_signals"."privacy" IS NULL
        AND "provider_vibe_signals"."workability" IS NULL
        AND "provider_vibe_signals"."social_energy" IS NULL
        AND "provider_vibe_signals"."mapping_version" IS NULL
      ) OR (
        (
          "provider_vibe_signals"."noise" IS NOT NULL
          OR "provider_vibe_signals"."crowd" IS NOT NULL
          OR "provider_vibe_signals"."lighting" IS NOT NULL
          OR "provider_vibe_signals"."privacy" IS NOT NULL
          OR "provider_vibe_signals"."workability" IS NOT NULL
          OR "provider_vibe_signals"."social_energy" IS NOT NULL
        )
        AND "provider_vibe_signals"."mapping_version" IS NOT NULL
        AND btrim("provider_vibe_signals"."mapping_version") <> ''
      )),
	CONSTRAINT "provider_vibe_signals_time_context_check" CHECK (("provider_vibe_signals"."day_type" IS NULL AND "provider_vibe_signals"."time_bucket" IS NULL)
        OR ("provider_vibe_signals"."day_type" IS NOT NULL AND "provider_vibe_signals"."time_bucket" IS NOT NULL)),
	CONSTRAINT "provider_vibe_signals_source_url_not_blank_check" CHECK ("provider_vibe_signals"."source_url" IS NULL OR btrim("provider_vibe_signals"."source_url") <> ''),
	CONSTRAINT "provider_vibe_signals_attribution_not_blank_check" CHECK ("provider_vibe_signals"."attribution_text" IS NULL OR btrim("provider_vibe_signals"."attribution_text") <> ''),
	CONSTRAINT "provider_vibe_signals_storage_policy_contract_check" CHECK ((
        "provider_vibe_signals"."storage_policy" = 'reference_only'
        AND "provider_vibe_signals"."signal_value" IS NULL
        AND "provider_vibe_signals"."raw_data" IS NULL
        AND "provider_vibe_signals"."noise" IS NULL
        AND "provider_vibe_signals"."crowd" IS NULL
        AND "provider_vibe_signals"."lighting" IS NULL
        AND "provider_vibe_signals"."privacy" IS NULL
        AND "provider_vibe_signals"."workability" IS NULL
        AND "provider_vibe_signals"."social_energy" IS NULL
        AND "provider_vibe_signals"."mapping_version" IS NULL
        AND "provider_vibe_signals"."expires_at" IS NULL
      ) OR (
        "provider_vibe_signals"."storage_policy" = 'ttl_cache'
        AND "provider_vibe_signals"."signal_value" IS NOT NULL
        AND "provider_vibe_signals"."expires_at" IS NOT NULL
        AND "provider_vibe_signals"."expires_at" > "provider_vibe_signals"."retrieved_at"
      ) OR (
        "provider_vibe_signals"."storage_policy" = 'persist_allowed'
        AND "provider_vibe_signals"."signal_value" IS NOT NULL
        AND (
          "provider_vibe_signals"."expires_at" IS NULL
          OR "provider_vibe_signals"."expires_at" > "provider_vibe_signals"."retrieved_at"
        )
      ))
);
--> statement-breakpoint
ALTER TABLE "place_sources" ADD CONSTRAINT "place_sources_id_place_unique" UNIQUE("id","place_id");--> statement-breakpoint
ALTER TABLE "provider_vibe_signals" ADD CONSTRAINT "provider_vibe_signals_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "provider_vibe_signals" ADD CONSTRAINT "provider_vibe_signals_place_source_same_place_fkey" FOREIGN KEY ("place_source_id","place_id") REFERENCES "public"."place_sources"("id","place_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "provider_vibe_signals_place_type_idx" ON "provider_vibe_signals" USING btree ("place_id","signal_type");--> statement-breakpoint
CREATE INDEX "provider_vibe_signals_place_time_idx" ON "provider_vibe_signals" USING btree ("place_id","day_type","time_bucket");--> statement-breakpoint
CREATE INDEX "provider_vibe_signals_expires_at_idx" ON "provider_vibe_signals" USING btree ("expires_at") WHERE "provider_vibe_signals"."expires_at" IS NOT NULL;
