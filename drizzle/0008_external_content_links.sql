CREATE TABLE "external_content_links" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"content_item_id" text NOT NULL,
	"platform_variant_id" text NOT NULL,
	"last_payload_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_content_links_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "external_content_links_platform_variant_id_platform_variants_id_fk" FOREIGN KEY ("platform_variant_id") REFERENCES "public"."platform_variants"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "external_content_source_id_unique" ON "external_content_links" USING btree ("source","external_id");
