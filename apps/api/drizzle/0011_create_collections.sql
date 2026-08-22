CREATE TABLE "collection_places" (
	"collection_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"note" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_places_collection_id_place_id_pk" PRIMARY KEY("collection_id","place_id"),
	CONSTRAINT "collection_places_position_nonnegative_check" CHECK ("collection_places"."position" >= 0),
	CONSTRAINT "collection_places_note_length_check" CHECK ("collection_places"."note" IS NULL OR char_length("collection_places"."note") <= 500)
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"visibility" varchar(16) DEFAULT 'private' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collections_user_slug_unique" UNIQUE("user_id","slug"),
	CONSTRAINT "collections_name_not_blank_check" CHECK (btrim("collections"."name") <> ''),
	CONSTRAINT "collections_slug_format_check" CHECK ("collections"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	CONSTRAINT "collections_visibility_check" CHECK ("collections"."visibility" IN ('private', 'public')),
	CONSTRAINT "collections_default_private_check" CHECK (NOT "collections"."is_default" OR "collections"."visibility" = 'private')
);
--> statement-breakpoint
ALTER TABLE "collection_places" ADD CONSTRAINT "collection_places_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "collection_places" ADD CONSTRAINT "collection_places_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "collection_places_collection_position_idx" ON "collection_places" USING btree ("collection_id","position");--> statement-breakpoint
CREATE INDEX "collection_places_place_id_idx" ON "collection_places" USING btree ("place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_user_default_unique" ON "collections" USING btree ("user_id") WHERE "collections"."is_default" = true;--> statement-breakpoint
CREATE INDEX "collections_user_id_idx" ON "collections" USING btree ("user_id");