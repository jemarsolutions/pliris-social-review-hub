ALTER TYPE "content_format" ADD VALUE IF NOT EXISTS 'TEXT_POST';
--> statement-breakpoint
ALTER TABLE "platform_variants" ADD COLUMN "wcs_content_id" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "canonical_wcs_content_id_unique"
  ON "platform_variants" ("wcs_content_id")
  WHERE "publishing_account" = 'PLIRIS' AND "wcs_content_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "platform_variants" ADD CONSTRAINT "personal_wcs_content_id_null"
  CHECK ("publishing_account" <> 'PERSONAL' OR "wcs_content_id" IS NULL);
