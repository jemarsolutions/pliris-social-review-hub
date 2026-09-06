import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  jsonb,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
export const roles = pgEnum("role", ["ADMIN", "PRODUCER", "REVIEWER"]);
export const platforms = pgEnum("platform", [
  "INSTAGRAM",
  "FACEBOOK",
  "LINKEDIN",
  "YOUTUBE",
  "TIKTOK",
]);
export const contentFormats = pgEnum("content_format", [
  "IMAGE_POST",
  "CAROUSEL",
  "SHORT_VIDEO",
  "LONG_VIDEO",
]);
export const reviewStates = pgEnum("review_status", [
  "DRAFT",
  "IN_PRODUCTION",
  "READY_FOR_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
]);
export const publishStates = pgEnum("publishing_status", [
  "UNSCHEDULED",
  "READY_TO_SCHEDULE",
  "SCHEDULED",
  "PUBLISHED",
]);
const created = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updated = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
export const user = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: roles("role").notNull().default("REVIEWER"),
  createdAt: created(),
  updatedAt: updated(),
});
export const session = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: created(),
  updatedAt: updated(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});
export const account = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: created(),
  updatedAt: updated(),
});
export const verification = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: created(),
  updatedAt: updated(),
});
export const contentItems = pgTable("content_items", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  internalReference: text("internal_reference").notNull().unique(),
  contentDate: text("content_date").notNull(),
  campaign: text("campaign").notNull().default(""),
  conceptSummary: text("concept_summary").notNull().default(""),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  createdAt: created(),
  updatedAt: updated(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});
export const platformVariants = pgTable(
  "platform_variants",
  {
    id: text("id").primaryKey(),
    contentItemId: text("content_item_id")
      .notNull()
      .references(() => contentItems.id),
    platform: platforms("platform").notNull(),
    contentFormat: contentFormats("content_format")
      .notNull()
      .default("IMAGE_POST"),
    plannedPublishAt: timestamp("planned_publish_at", {
      withTimezone: true,
    }).notNull(),
    reviewStatus: reviewStates("review_status").notNull().default("DRAFT"),
    publishingStatus: publishStates("publishing_status")
      .notNull()
      .default("UNSCHEDULED"),
    currentVersionId: text("current_version_id"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("one_platform_format_per_content").on(
      t.contentItemId,
      t.platform,
      t.contentFormat,
    ),
  ],
);
export const mediaAssets = pgTable("media_assets", {
  id: text("id").primaryKey(),
  cloudinaryPublicId: text("cloudinary_public_id").unique(),
  resourceType: text("resource_type").notNull().default("image"),
  mimeType: text("mime_type").notNull(),
  originalFilename: text("original_filename").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  durationMs: integer("duration_ms").notNull().default(0),
  bytes: integer("bytes").notNull(),
  altText: text("alt_text").notNull(),
  storage: text("storage").notNull().default("cloudinary"),
  storageVersion: text("storage_version"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  createdAt: created(),
});
export type MediaSnapshot = {
  id: string;
  altText: string;
  sortOrder: number;
  resourceType: "image" | "video";
  mimeType: string;
  width: number;
  height: number;
  durationMs: number;
};
export const versions = pgTable(
  "platform_variant_versions",
  {
    id: text("id").primaryKey(),
    platformVariantId: text("platform_variant_id")
      .notNull()
      .references(() => platformVariants.id),
    versionNumber: integer("version_number").notNull(),
    caption: text("caption_snapshot").notNull(),
    headline: text("headline_snapshot").notNull().default(""),
    script: text("script_snapshot").notNull().default(""),
    chapters: text("chapters_snapshot").notNull().default(""),
    tags: text("tags_snapshot").notNull().default(""),
    ctaText: text("cta_text_snapshot").notNull(),
    ctaUrl: text("cta_url_snapshot").notNull(),
    media: jsonb("media_snapshot").$type<MediaSnapshot[]>().notNull(),
    video: jsonb("video_snapshot").$type<MediaSnapshot | null>(),
    thumbnail: jsonb("thumbnail_snapshot").$type<MediaSnapshot | null>(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("unique_variant_version").on(
      t.platformVariantId,
      t.versionNumber,
    ),
  ],
);
export const variantMedia = pgTable(
  "platform_variant_media",
  {
    id: text("id").primaryKey(),
    platformVariantId: text("platform_variant_id")
      .notNull()
      .references(() => platformVariants.id),
    versionId: text("version_id")
      .notNull()
      .references(() => versions.id),
    mediaAssetId: text("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [uniqueIndex("version_media_order").on(t.versionId, t.sortOrder)],
);
export const reviewDecisions = pgTable(
  "review_decisions",
  {
    id: text("id").primaryKey(),
    platformVariantId: text("platform_variant_id")
      .notNull()
      .references(() => platformVariants.id),
    versionId: text("version_id")
      .notNull()
      .references(() => versions.id),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => user.id),
    decision: text("decision").notNull(),
    reason: text("reason").notNull().default(""),
    createdAt: created(),
  },
  (t) => [uniqueIndex("one_final_decision_per_version").on(t.versionId)],
);
export const comments = pgTable("comments", {
  id: text("id").primaryKey(),
  platformVariantId: text("platform_variant_id")
    .notNull()
    .references(() => platformVariants.id),
  versionId: text("version_id")
    .notNull()
    .references(() => versions.id),
  authorId: text("author_id")
    .notNull()
    .references(() => user.id),
  body: text("body").notNull(),
  createdAt: created(),
});
export const publishingRecords = pgTable("publishing_records", {
  id: text("id").primaryKey(),
  platformVariantId: text("platform_variant_id")
    .notNull()
    .references(() => platformVariants.id),
  versionId: text("version_id")
    .notNull()
    .references(() => versions.id),
  status: publishStates("status").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishedUrl: text("published_url"),
  externalPostId: text("external_post_id"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  createdAt: created(),
});
export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  actorId: text("actor_id")
    .notNull()
    .references(() => user.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  createdAt: created(),
});
export const rateLimit = pgTable("rate_limits", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
