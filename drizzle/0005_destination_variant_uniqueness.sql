DROP INDEX IF EXISTS "one_platform_format_per_content";
--> statement-breakpoint
CREATE UNIQUE INDEX "one_destination_format_per_content"
  ON "platform_variants" ("content_item_id", "platform", "content_format", "publishing_account", "publishing_account_name");