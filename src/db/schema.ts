import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  jsonb,
  uniqueIndex,
  index,
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
// Better Auth MCP/OAuth persistence. These are additive to the existing auth
// tables above; token and client lifecycle remains owned by Better Auth.
export const jwks = pgTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  alg: text("alg"),
  crv: text("crv"),
});
export const oauthClient = pgTable(
  "oauth_client",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().unique(),
    clientSecret: text("client_secret"),
    clientDiscoveryId: text("client_discovery_id"),
    disabled: boolean("disabled").default(false),
    skipConsent: boolean("skip_consent"),
    enableEndSession: boolean("enable_end_session"),
    subjectType: text("subject_type"),
    scopes: text("scopes").array(),
    clientCredentialsScopes: text("client_credentials_scopes")
      .array()
      .default([]),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    name: text("name"),
    uri: text("uri"),
    icon: text("icon"),
    contacts: text("contacts").array(),
    tos: text("tos"),
    policy: text("policy"),
    softwareId: text("software_id"),
    softwareVersion: text("software_version"),
    softwareStatement: text("software_statement"),
    redirectUris: text("redirect_uris").array().notNull(),
    postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
    backchannelLogoutUri: text("backchannel_logout_uri"),
    backchannelLogoutSessionRequired: boolean(
      "backchannel_logout_session_required",
    ),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
    applicationType: text("application_type"),
    jwks: text("jwks"),
    jwksUri: text("jwks_uri"),
    grantTypes: text("grant_types").array(),
    responseTypes: text("response_types").array(),
    requirePKCE: boolean("require_pkce"),
    dpopBoundAccessTokens: boolean("dpop_bound_access_tokens").default(false),
    referenceId: text("reference_id"),
    metadata: jsonb("metadata"),
  },
  (t) => [index("oauthClient_userId_idx").on(t.userId)],
);
export const oauthResource = pgTable("oauth_resource", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull().unique(),
  name: text("name").notNull(),
  accessTokenTtl: integer("access_token_ttl"),
  refreshTokenTtl: integer("refresh_token_ttl"),
  signingAlgorithm: text("signing_algorithm"),
  signingKeyId: text("signing_key_id"),
  allowedScopes: text("allowed_scopes").array(),
  customClaims: jsonb("custom_claims"),
  dpopBoundAccessTokensRequired: boolean(
    "dpop_bound_access_tokens_required",
  ).default(false),
  disabled: boolean("disabled").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  policyVersion: integer("policy_version").default(1),
  metadata: jsonb("metadata"),
});
export const oauthClientResource = pgTable(
  "oauth_client_resource",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    resourceId: text("resource_id")
      .notNull()
      .references(() => oauthResource.identifier, { onDelete: "cascade" }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("oauthClientResource_clientId_resourceId_uidx").on(
      t.clientId,
      t.resourceId,
    ),
    index("oauthClientResource_clientId_idx").on(t.clientId),
    index("oauthClientResource_resourceId_idx").on(t.resourceId),
  ],
);
export const oauthRefreshToken = pgTable(
  "oauth_refresh_token",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => session.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    revoked: timestamp("revoked", { withTimezone: true }),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
    rotationReplayResponse: text("rotation_replay_response"),
    rotationReplayExpiresAt: timestamp("rotation_replay_expires_at", {
      withTimezone: true,
    }),
    authTime: timestamp("auth_time", { withTimezone: true }),
    confirmation: jsonb("confirmation"),
    scopes: text("scopes").array().notNull(),
  },
  (t) => [
    index("oauthRefreshToken_clientId_idx").on(t.clientId),
    index("oauthRefreshToken_sessionId_idx").on(t.sessionId),
    index("oauthRefreshToken_userId_idx").on(t.userId),
    index("oauthRefreshToken_authorizationCodeId_idx").on(
      t.authorizationCodeId,
    ),
  ],
);
export const oauthAccessToken = pgTable(
  "oauth_access_token",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => session.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    refreshId: text("refresh_id").references(() => oauthRefreshToken.id, {
      onDelete: "cascade",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    revoked: timestamp("revoked", { withTimezone: true }),
    confirmation: jsonb("confirmation"),
    scopes: text("scopes").array().notNull(),
  },
  (t) => [
    index("oauthAccessToken_clientId_idx").on(t.clientId),
    index("oauthAccessToken_sessionId_idx").on(t.sessionId),
    index("oauthAccessToken_userId_idx").on(t.userId),
    index("oauthAccessToken_authorizationCodeId_idx").on(t.authorizationCodeId),
    index("oauthAccessToken_refreshId_idx").on(t.refreshId),
  ],
);
export const oauthConsent = pgTable(
  "oauth_consent",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    scopes: text("scopes").array().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("oauthConsent_clientId_idx").on(t.clientId),
    index("oauthConsent_userId_idx").on(t.userId),
  ],
);
export const oauthClientAssertion = pgTable("oauth_client_assertion", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
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
    publishingAccount: text("publishing_account").notNull().default("PLIRIS"),
    publishingAccountName: text("publishing_account_name")
      .notNull()
      .default("PLIRIS"),
    reviewStatus: reviewStates("review_status").notNull().default("DRAFT"),
    publishingStatus: publishStates("publishing_status")
      .notNull()
      .default("UNSCHEDULED"),
    currentVersionId: text("current_version_id"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("one_destination_format_per_content").on(
      t.contentItemId,
      t.platform,
      t.contentFormat,
      t.publishingAccount,
      t.publishingAccountName,
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
export const externalContentLinks = pgTable(
  "external_content_links",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    contentItemId: text("content_item_id")
      .notNull()
      .references(() => contentItems.id),
    platformVariantId: text("platform_variant_id")
      .notNull()
      .references(() => platformVariants.id),
    lastPayloadHash: text("last_payload_hash").notNull(),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("external_content_source_id_unique").on(t.source, t.externalId),
  ],
);
export const rateLimit = pgTable("rate_limits", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
