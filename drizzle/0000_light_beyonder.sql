CREATE TYPE "public"."platform" AS ENUM('INSTAGRAM', 'FACEBOOK', 'LINKEDIN');--> statement-breakpoint
CREATE TYPE "public"."publishing_status" AS ENUM('UNSCHEDULED', 'READY_TO_SCHEDULE', 'SCHEDULED', 'PUBLISHED');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('DRAFT', 'IN_PRODUCTION', 'READY_FOR_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'PRODUCER', 'REVIEWER');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"platform_variant_id" text NOT NULL,
	"version_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_items" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"internal_reference" text NOT NULL,
	"content_date" text NOT NULL,
	"campaign" text DEFAULT '' NOT NULL,
	"concept_summary" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "content_items_internal_reference_unique" UNIQUE("internal_reference")
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"cloudinary_public_id" text,
	"resource_type" text DEFAULT 'image' NOT NULL,
	"mime_type" text NOT NULL,
	"original_filename" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"alt_text" text NOT NULL,
	"storage" text DEFAULT 'cloudinary' NOT NULL,
	"storage_version" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_cloudinary_public_id_unique" UNIQUE("cloudinary_public_id")
);
--> statement-breakpoint
CREATE TABLE "platform_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"content_item_id" text NOT NULL,
	"platform" "platform" NOT NULL,
	"planned_publish_at" timestamp with time zone NOT NULL,
	"review_status" "review_status" DEFAULT 'DRAFT' NOT NULL,
	"publishing_status" "publishing_status" DEFAULT 'UNSCHEDULED' NOT NULL,
	"current_version_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publishing_records" (
	"id" text PRIMARY KEY NOT NULL,
	"platform_variant_id" text NOT NULL,
	"version_id" text NOT NULL,
	"status" "publishing_status" NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"published_url" text,
	"external_post_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "review_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"platform_variant_id" text NOT NULL,
	"version_id" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"decision" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "role" DEFAULT 'REVIEWER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "platform_variant_media" (
	"id" text PRIMARY KEY NOT NULL,
	"platform_variant_id" text NOT NULL,
	"version_id" text NOT NULL,
	"media_asset_id" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_variant_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"platform_variant_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"caption_snapshot" text NOT NULL,
	"cta_text_snapshot" text NOT NULL,
	"cta_url_snapshot" text NOT NULL,
	"media_snapshot" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_platform_variant_id_platform_variants_id_fk" FOREIGN KEY ("platform_variant_id") REFERENCES "public"."platform_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_version_id_platform_variant_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."platform_variant_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_variants" ADD CONSTRAINT "platform_variants_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_records" ADD CONSTRAINT "publishing_records_platform_variant_id_platform_variants_id_fk" FOREIGN KEY ("platform_variant_id") REFERENCES "public"."platform_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_records" ADD CONSTRAINT "publishing_records_version_id_platform_variant_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."platform_variant_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_records" ADD CONSTRAINT "publishing_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_platform_variant_id_platform_variants_id_fk" FOREIGN KEY ("platform_variant_id") REFERENCES "public"."platform_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_version_id_platform_variant_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."platform_variant_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_variant_media" ADD CONSTRAINT "platform_variant_media_platform_variant_id_platform_variants_id_fk" FOREIGN KEY ("platform_variant_id") REFERENCES "public"."platform_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_variant_media" ADD CONSTRAINT "platform_variant_media_version_id_platform_variant_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."platform_variant_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_variant_media" ADD CONSTRAINT "platform_variant_media_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_variant_versions" ADD CONSTRAINT "platform_variant_versions_platform_variant_id_platform_variants_id_fk" FOREIGN KEY ("platform_variant_id") REFERENCES "public"."platform_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_variant_versions" ADD CONSTRAINT "platform_variant_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_platform_per_content" ON "platform_variants" USING btree ("content_item_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "one_final_decision_per_version" ON "review_decisions" USING btree ("version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "version_media_order" ON "platform_variant_media" USING btree ("version_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_variant_version" ON "platform_variant_versions" USING btree ("platform_variant_id","version_number");