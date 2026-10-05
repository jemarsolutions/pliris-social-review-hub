ALTER TABLE "platform_variants" ADD COLUMN "personal_source_version_id" text;
--> statement-breakpoint
ALTER TABLE "platform_variants" ADD COLUMN "personal_generation_id" text;
--> statement-breakpoint
ALTER TABLE "platform_variants" ADD COLUMN "personal_caption_status" text NOT NULL DEFAULT 'NOT_GENERATED';
--> statement-breakpoint
ALTER TABLE "platform_variants" ADD COLUMN "personal_caption_edited" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE TABLE "caption_generations" (
  "id" text PRIMARY KEY,
  "platform_variant_id" text NOT NULL REFERENCES "platform_variants"("id"),
  "source_version_id" text NOT NULL,
  "created_by" text NOT NULL REFERENCES "users"("id"),
  "model" text NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING',
  "result" text,
  "usage" jsonb,
  "error" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- Existing mirrors are preserved but must be checked before their copy is ready.
UPDATE "platform_variants" SET "review_status" = 'DRAFT'
WHERE "publishing_account" = 'PERSONAL' AND "publishing_status" <> 'PUBLISHED';
--> statement-breakpoint
-- Preserve existing personal copy that already differs from the company caption.
UPDATE "platform_variants" AS personal
SET "personal_caption_status" = 'NEEDS_REVIEW', "personal_caption_edited" = true,
    "personal_source_version_id" = source."current_version_id"
FROM "platform_variants" AS source, "platform_variant_versions" AS pv, "platform_variant_versions" AS sv
WHERE personal."publishing_account" = 'PERSONAL'
  AND source."publishing_account" = 'PLIRIS'
  AND personal."content_item_id" = source."content_item_id"
  AND personal."platform" = source."platform"
  AND personal."content_format" = source."content_format"
  AND pv."id" = personal."current_version_id" AND sv."id" = source."current_version_id"
  AND pv."caption_snapshot" <> sv."caption_snapshot";
