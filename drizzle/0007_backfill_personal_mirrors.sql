UPDATE "platform_variants"
SET "publishing_account_name" = "publishing_account_name" || ' · ' || "platform"
WHERE "publishing_account" = 'PERSONAL'
  AND "publishing_account_name" IN ('John', 'Royal');
--> statement-breakpoint
WITH sources AS (
  SELECT
    v."id",
    v."content_item_id",
    v."platform",
    v."content_format",
    v."planned_publish_at",
    v."review_status",
    v."publishing_status",
    v."current_version_id",
    ver."version_number",
    ver."caption_snapshot",
    ver."headline_snapshot",
    ver."script_snapshot",
    ver."chapters_snapshot",
    ver."tags_snapshot",
    ver."cta_text_snapshot",
    ver."cta_url_snapshot",
    ver."media_snapshot",
    ver."video_snapshot",
    ver."thumbnail_snapshot",
    ver."created_by",
    account."name" AS "account_name"
  FROM "platform_variants" v
  JOIN "platform_variant_versions" ver
    ON ver."id" = v."current_version_id"
  CROSS JOIN (VALUES ('John'), ('Royal')) AS account("name")
  WHERE v."publishing_account" = 'PLIRIS'
    AND NOT EXISTS (
      SELECT 1
      FROM "platform_variants" existing
      WHERE existing."content_item_id" = v."content_item_id"
        AND existing."platform" = v."platform"
        AND existing."content_format" = v."content_format"
        AND existing."publishing_account" = 'PERSONAL'
        AND existing."publishing_account_name" = account."name" || ' · ' || v."platform"
    )
), mirrors AS (
  SELECT
    md5("id" || "account_name") AS "mirror_id",
    md5("id" || "account_name" || "current_version_id") AS "mirror_version_id",
    *
  FROM sources
)
INSERT INTO "platform_variants" (
  "id", "content_item_id", "platform", "content_format",
  "planned_publish_at", "publishing_account", "publishing_account_name",
  "review_status", "publishing_status", "current_version_id"
)
SELECT
  "mirror_id",
  "content_item_id",
  "platform",
  "content_format",
  "planned_publish_at",
  'PERSONAL',
  "account_name" || ' · ' || "platform",
  (CASE WHEN "review_status" = 'APPROVED' THEN 'APPROVED' ELSE 'DRAFT' END)::review_status,
  'UNSCHEDULED'::publishing_status,
  "mirror_version_id"
FROM mirrors;
--> statement-breakpoint
WITH sources AS (
  SELECT
    v."id",
    v."current_version_id",
    ver."version_number",
    ver."caption_snapshot",
    ver."headline_snapshot",
    ver."script_snapshot",
    ver."chapters_snapshot",
    ver."tags_snapshot",
    ver."cta_text_snapshot",
    ver."cta_url_snapshot",
    ver."media_snapshot",
    ver."video_snapshot",
    ver."thumbnail_snapshot",
    ver."created_by",
    account."name" AS "account_name"
  FROM "platform_variants" v
  JOIN "platform_variant_versions" ver
    ON ver."id" = v."current_version_id"
  CROSS JOIN (VALUES ('John'), ('Royal')) AS account("name")
  WHERE v."publishing_account" = 'PLIRIS'
), mirrors AS (
  SELECT
    md5(s."id" || s."account_name") AS "mirror_id",
    md5(s."id" || s."account_name" || s."current_version_id") AS "mirror_version_id",
    s.*
  FROM sources s
  WHERE EXISTS (
    SELECT 1
    FROM "platform_variants" existing
    WHERE existing."id" = md5(s."id" || s."account_name")
  )
)
INSERT INTO "platform_variant_versions" (
  "id", "platform_variant_id", "version_number", "caption_snapshot",
  "headline_snapshot", "script_snapshot", "chapters_snapshot", "tags_snapshot",
  "cta_text_snapshot", "cta_url_snapshot", "media_snapshot", "video_snapshot",
  "thumbnail_snapshot", "created_by"
)
SELECT
  "mirror_version_id",
  "mirror_id",
  "version_number",
  "caption_snapshot",
  "headline_snapshot",
  "script_snapshot",
  "chapters_snapshot",
  "tags_snapshot",
  "cta_text_snapshot",
  "cta_url_snapshot",
  "media_snapshot",
  "video_snapshot",
  "thumbnail_snapshot",
  "created_by"
FROM mirrors;
--> statement-breakpoint
INSERT INTO "platform_variant_media" (
  "id", "platform_variant_id", "version_id", "media_asset_id", "sort_order"
)
SELECT
  md5(personal."id" || source_media."id"),
  personal."id",
  personal."current_version_id",
  source_media."media_asset_id",
  source_media."sort_order"
FROM "platform_variants" personal
JOIN "platform_variants" canonical
  ON canonical."content_item_id" = personal."content_item_id"
  AND canonical."platform" = personal."platform"
  AND canonical."content_format" = personal."content_format"
  AND canonical."publishing_account" = 'PLIRIS'
JOIN "platform_variant_media" source_media
  ON source_media."platform_variant_id" = canonical."id"
  AND source_media."version_id" = canonical."current_version_id"
WHERE personal."publishing_account" = 'PERSONAL'
  AND NOT EXISTS (
    SELECT 1
    FROM "platform_variant_media" existing
    WHERE existing."version_id" = personal."current_version_id"
  );