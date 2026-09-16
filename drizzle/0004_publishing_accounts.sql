ALTER TABLE "platform_variants"
  ADD COLUMN "publishing_account" text NOT NULL DEFAULT 'PLIRIS';
--> statement-breakpoint
ALTER TABLE "platform_variants"
  ADD COLUMN "publishing_account_name" text NOT NULL DEFAULT 'PLIRIS';