CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_name" varchar(64) NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_events_event_name_check" CHECK ("analytics_events"."event_name" IN ('explore_filter_changed', 'explore_results_viewed', 'explore_share_clicked')),
	CONSTRAINT "analytics_events_session_id_check" CHECK ("analytics_events"."session_id" ~ '^[a-zA-Z0-9_-]{8,64}$'),
	CONSTRAINT "analytics_events_payload_object_check" CHECK (jsonb_typeof("analytics_events"."payload") = 'object')
);
--> statement-breakpoint
CREATE INDEX "analytics_events_event_name_occurred_at_idx" ON "analytics_events" USING btree ("event_name","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "analytics_events_session_id_idx" ON "analytics_events" USING btree ("session_id");