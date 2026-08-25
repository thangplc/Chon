ALTER TABLE "collections" DROP CONSTRAINT "collections_default_private_check";--> statement-breakpoint
ALTER TABLE "collections" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "owner_type" varchar(16) DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "status" varchar(16) DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "published_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
CREATE UNIQUE INDEX "collections_editorial_slug_unique" ON "collections" USING btree ("slug") WHERE "collections"."owner_type" = 'editorial';--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_owner_type_check" CHECK ("collections"."owner_type" IN ('user', 'editorial'));--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_owner_check" CHECK (("collections"."owner_type" = 'user' AND "collections"."user_id" IS NOT NULL) OR ("collections"."owner_type" = 'editorial' AND "collections"."user_id" IS NULL));--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_status_check" CHECK ("collections"."status" IN ('draft', 'published'));--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_publication_check" CHECK ("collections"."status" = 'published' OR "collections"."published_at" IS NULL);--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_default_private_check" CHECK (NOT "collections"."is_default" OR ("collections"."visibility" = 'private' AND "collections"."owner_type" = 'user'));