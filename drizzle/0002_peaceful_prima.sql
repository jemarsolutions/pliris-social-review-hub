CREATE TYPE "public"."content_format" AS ENUM('IMAGE_POST', 'CAROUSEL', 'SHORT_VIDEO', 'LONG_VIDEO');--> statement-breakpoint
ALTER TYPE "public"."platform" ADD VALUE 'YOUTUBE';--> statement-breakpoint
ALTER TYPE "public"."platform" ADD VALUE 'TIKTOK';--> statement-breakpoint
DROP INDEX "one_platform_per_content";--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "duration_ms" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_variants" ADD COLUMN "content_format" "content_format" DEFAULT 'IMAGE_POST' NOT NULL;--> statement-breakpoint
UPDATE "platform_variants" AS variant
SET "content_format" = 'CAROUSEL'
FROM "platform_variant_versions" AS version
WHERE variant."current_version_id" = version."id"
  AND jsonb_array_length(version."media_snapshot") > 1;--> statement-breakpoint
UPDATE "platform_variant_versions" AS version
SET "media_snapshot" = COALESCE((
  SELECT jsonb_agg(
    item.value || jsonb_build_object(
      'resourceType', COALESCE(asset."resource_type", 'image'),
      'mimeType', COALESCE(asset."mime_type", ''),
      'width', COALESCE(asset."width", 0),
      'height', COALESCE(asset."height", 0),
      'durationMs', 0
    )
    ORDER BY item.ordinality
  )
  FROM jsonb_array_elements(version."media_snapshot") WITH ORDINALITY AS item(value, ordinality)
  LEFT JOIN "media_assets" AS asset ON asset."id" = item.value->>'id'
), '[]'::jsonb);--> statement-breakpoint
ALTER TABLE "platform_variant_versions" ADD COLUMN "headline_snapshot" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_variant_versions" ADD COLUMN "script_snapshot" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_variant_versions" ADD COLUMN "chapters_snapshot" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_variant_versions" ADD COLUMN "tags_snapshot" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_variant_versions" ADD COLUMN "video_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "platform_variant_versions" ADD COLUMN "thumbnail_snapshot" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "one_platform_format_per_content" ON "platform_variants" USING btree ("content_item_id","platform","content_format");
