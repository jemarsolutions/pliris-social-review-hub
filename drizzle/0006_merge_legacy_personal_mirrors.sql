UPDATE "platform_variants" AS personal_variant
SET
  "content_item_id" = main_item."id",
  "publishing_account" = 'PERSONAL',
  "publishing_account_name" = trim(split_part(mirror_item."title", '|', 1))
FROM "content_items" AS mirror_item
JOIN "content_items" AS main_item
  ON main_item."internal_reference" = substring(
    mirror_item."concept_summary" from '(PLIRIS-[0-9]+)'
  )
WHERE personal_variant."content_item_id" = mirror_item."id"
  AND mirror_item."concept_summary" LIKE 'Authorized personal-account mirror of %';
--> statement-breakpoint
UPDATE "content_items" AS mirror_item
SET "archived_at" = now(), "updated_at" = now()
WHERE mirror_item."concept_summary" LIKE 'Authorized personal-account mirror of %'
  AND EXISTS (
    SELECT 1
    FROM "content_items" AS main_item
    WHERE main_item."internal_reference" = substring(
      mirror_item."concept_summary" from '(PLIRIS-[0-9]+)'
    )
  );