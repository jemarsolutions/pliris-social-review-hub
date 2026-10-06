import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { getDb, type Transaction } from "@/db";
import * as s from "@/db/schema";
import {
  AppError,
  type Actor,
  requireDecision,
  requireProducer,
  requireReviewer,
  requireVersion,
  coverage,
} from "./domain";
import {
  contentSchema,
  variantSchema,
  editSchema,
  commentSchema,
  publishingSchema,
  dateSchema,
  decisionSchema,
} from "./validation";
import type { ContentFormatValue, PlatformValue } from "./platform-config";
import { z } from "zod";
import { captionGenerationFailure } from "./caption-generation-error";
import {
  captionAiConfigured,
  captionModel,
  draftPersonalCaption,
  personalCaptionSchema,
} from "./personal-captions";
const id = () => crypto.randomUUID();
async function audit(
  tx: Transaction,
  actor: Actor,
  action: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await tx.insert(s.auditEvents).values({
    id: id(),
    actorId: actor.id,
    action,
    entityType: "platform_variant",
    entityId,
    metadata: { ...metadata, integration: !!actor.integration },
  });
}
async function lock(tx: Transaction, variantId: string) {
  const [v] = await tx
    .select()
    .from(s.platformVariants)
    .where(eq(s.platformVariants.id, variantId))
    .for("update");
  if (!v) throw new AppError(404, "Platform variant not found.");
  const [item] = await tx
    .select()
    .from(s.contentItems)
    .where(eq(s.contentItems.id, v.contentItemId));
  if (item.archivedAt) throw new AppError(409, "This content is archived.");
  return v;
}
async function snapshotAsset(
  tx: Transaction,
  mediaId: string,
  expectedType: "image" | "video",
  sortOrder: number,
) {
  const [m] = await tx
    .select()
    .from(s.mediaAssets)
    .where(eq(s.mediaAssets.id, mediaId));
  if (!m) throw new AppError(422, "Media asset does not exist.");
  if (m.resourceType !== expectedType)
    throw new AppError(422, `Expected a ${expectedType} asset.`);
  return {
    id: m.id,
    altText: m.altText,
    sortOrder,
    resourceType: expectedType,
    mimeType: m.mimeType,
    width: m.width,
    height: m.height,
    durationMs: m.durationMs,
  } as s.MediaSnapshot;
}
async function snapshotMedia(tx: Transaction, mediaIds: string[]) {
  if (new Set(mediaIds).size !== mediaIds.length)
    throw new AppError(422, "Duplicate media.");
  return Promise.all(
    mediaIds.map((mediaId, sortOrder) =>
      snapshotAsset(tx, mediaId, "image", sortOrder),
    ),
  );
}
async function insertVersion(
  tx: Transaction,
  actor: Actor,
  variantId: string,
  versionNumber: number,
  data: {
    caption: string;
    headline: string;
    script: string;
    chapters: string;
    tags: string;
    ctaText: string;
    ctaUrl: string;
    mediaIds: string[];
    videoId: string | null;
    thumbnailId: string | null;
  },
) {
  const media = await snapshotMedia(tx, data.mediaIds);
  const video = data.videoId
    ? await snapshotAsset(tx, data.videoId, "video", media.length)
    : null;
  const thumbnail = data.thumbnailId
    ? await snapshotAsset(
        tx,
        data.thumbnailId,
        "image",
        media.length + (video ? 1 : 0),
      )
    : null;
  const versionId = id();
  await tx.insert(s.versions).values({
    id: versionId,
    platformVariantId: variantId,
    versionNumber,
    caption: data.caption,
    headline: data.headline,
    script: data.script,
    chapters: data.chapters,
    tags: data.tags,
    ctaText: data.ctaText,
    ctaUrl: data.ctaUrl,
    media,
    video,
    thumbnail,
    createdBy: actor.id,
  });
  const linkedMedia = [
    ...media,
    ...(video ? [video] : []),
    ...(thumbnail ? [thumbnail] : []),
  ];
  if (linkedMedia.length)
    await tx.insert(s.variantMedia).values(
      linkedMedia.map((m) => ({
        id: id(),
        platformVariantId: variantId,
        versionId,
        mediaAssetId: m.id,
        sortOrder: m.sortOrder,
      })),
    );
  await audit(tx, actor, "VERSION_CREATED", variantId, {
    versionId,
    versionNumber,
  });
  return versionId;
}
function assertPayloadShape(
  platform: PlatformValue,
  contentFormat: ContentFormatValue,
  data: {
    headline: string;
    script: string;
    chapters: string;
    tags: string;
    mediaIds: string[];
    videoId: string | null;
    thumbnailId: string | null;
  },
) {
  const videoFormat = ["SHORT_VIDEO", "LONG_VIDEO"].includes(contentFormat);
  if (
    contentFormat === "TEXT_POST" &&
    (data.mediaIds.length || data.videoId || data.thumbnailId)
  )
    throw new AppError(
      422,
      "Text posts cannot include image, video, or thumbnail media.",
    );
  if (videoFormat && data.mediaIds.length)
    throw new AppError(
      422,
      "Video adaptations cannot include carousel images.",
    );
  if (
    !videoFormat &&
    (data.videoId ||
      data.thumbnailId ||
      data.headline ||
      data.script ||
      data.chapters ||
      data.tags)
  )
    throw new AppError(422, "Image adaptations cannot include video fields.");
  if (platform !== "YOUTUBE" && data.chapters)
    throw new AppError(422, "Chapters are available only for YouTube.");
}
export async function createContent(actor: Actor, input: unknown) {
  requireProducer(actor);
  const data = contentSchema.parse(input);
  return getDb().transaction(async (tx) => {
    const referenceResult = await tx.execute(
      sql<{
        nextval: string;
      }>`SELECT nextval('content_reference_seq') AS nextval`,
    );
    const [{ nextval }] = referenceResult.rows as [{ nextval: string }];
    const internalReference = `PLIRIS-${String(nextval).padStart(4, "0")}`;
    const [item] = await tx
      .insert(s.contentItems)
      .values({
        id: id(),
        ...data,
        internalReference,
        createdBy: actor.id,
      })
      .returning();
    await audit(tx, actor, "CONTENT_CREATED", item.id);
    return item;
  });
}
export async function updateContent(
  actor: Actor,
  contentId: string,
  input: unknown,
) {
  requireProducer(actor);
  const data = contentSchema.partial().parse(input);
  return getDb().transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(s.contentItems)
      .where(eq(s.contentItems.id, contentId))
      .for("update");
    if (!item) throw new AppError(404, "Content not found.");
    if (item.archivedAt) throw new AppError(409, "Content is archived.");
    const { internalReference: _ignoredReference, ...editableData } = data;
    const [updated] = await tx
      .update(s.contentItems)
      .set({ ...editableData, updatedAt: new Date() })
      .where(eq(s.contentItems.id, contentId))
      .returning();
    // The content date is the source of truth for the whole content group.
    // Run this reconciliation even when the date value itself is unchanged so
    // older groups with mismatched adaptation dates can be repaired by saving.
    if (data.contentDate) {
      const variants = await tx
        .select({
          id: s.platformVariants.id,
          plannedPublishAt: s.platformVariants.plannedPublishAt,
        })
        .from(s.platformVariants)
        .where(eq(s.platformVariants.contentItemId, contentId));
      const nextDate = new Date(`${data.contentDate}T00:00:00.000Z`);
      for (const { id: variantId, plannedPublishAt } of variants) {
        const nextPlannedDate = new Date(plannedPublishAt);
        nextPlannedDate.setUTCFullYear(
          nextDate.getUTCFullYear(),
          nextDate.getUTCMonth(),
          nextDate.getUTCDate(),
        );
        await tx
          .update(s.platformVariants)
          .set({ plannedPublishAt: nextPlannedDate, updatedAt: new Date() })
          .where(eq(s.platformVariants.id, variantId));
      }
    }
    await audit(tx, actor, "CONTENT_UPDATED", contentId, {
      fields: Object.keys(data),
      ...(data.contentDate ? { synchronizedVariantDates: true } : {}),
    });
    return updated;
  });
}
export async function archiveContent(actor: Actor, contentId: string) {
  requireProducer(actor);
  return getDb().transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(s.contentItems)
      .where(eq(s.contentItems.id, contentId))
      .for("update");
    if (!item) throw new AppError(404, "Content not found.");
    if (item.archivedAt)
      throw new AppError(409, "Content is already archived.");
    const [archived] = await tx
      .update(s.contentItems)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(s.contentItems.id, contentId))
      .returning();
    await audit(tx, actor, "CONTENT_ARCHIVED", contentId);
    return archived;
  });
}
export async function createVariant(
  actor: Actor,
  contentId: string,
  input: unknown,
) {
  requireProducer(actor);
  const data = variantSchema.parse(input);
  assertPayloadShape(data.platform, data.contentFormat, data);
  return getDb().transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(s.contentItems)
      .where(eq(s.contentItems.id, contentId));
    if (!item || item.archivedAt)
      throw new AppError(404, "Active content not found.");
    const variantId = id();
    await tx.insert(s.platformVariants).values({
      id: variantId,
      contentItemId: contentId,
      platform: data.platform,
      contentFormat: data.contentFormat,
      wcsContentId:
        data.publishingAccount === "PLIRIS" ? data.wcsContentId : null,
      plannedPublishAt: new Date(data.plannedPublishAt),
      publishingAccount: data.publishingAccount,
      publishingAccountName: data.publishingAccountName,
    });
    const versionId = await insertVersion(tx, actor, variantId, 1, data);
    const [variant] = await tx
      .update(s.platformVariants)
      .set({ currentVersionId: versionId })
      .where(eq(s.platformVariants.id, variantId))
      .returning();
    await audit(tx, actor, "VARIANT_CREATED", variantId);
    if (data.publishingAccount === "PLIRIS") {
      for (const accountName of ["John", "Royal"]) {
        const personalVariantId = id();
        await tx.insert(s.platformVariants).values({
          id: personalVariantId,
          contentItemId: contentId,
          platform: data.platform,
          contentFormat: data.contentFormat,
          wcsContentId: null,
          plannedPublishAt: new Date(data.plannedPublishAt),
          publishingAccount: "PERSONAL",
          publishingAccountName: `${accountName} · ${data.platform}`,
        });
        const personalVersionId = await insertVersion(
          tx,
          actor,
          personalVariantId,
          1,
          { ...data, ctaText: "", ctaUrl: "" },
        );
        await tx
          .update(s.platformVariants)
          .set({ currentVersionId: personalVersionId })
          .where(eq(s.platformVariants.id, personalVariantId));
        await audit(tx, actor, "PERSONAL_MIRROR_CREATED", personalVariantId, {
          sourceVariantId: variantId,
        });
      }
    }
    return variant;
  });
}
export async function editVariant(
  actor: Actor,
  variantId: string,
  input: unknown,
) {
  requireProducer(actor);
  const data = editSchema.parse(input);
  return getDb().transaction(async (tx) => {
    const v = await lock(tx, variantId);
    requireVersion(v.currentVersionId, data.expectedVersionId);
    assertPayloadShape(v.platform, v.contentFormat, data);
    const publishingAccount = data.publishingAccount || v.publishingAccount;
    if (v.wcsContentId && publishingAccount !== "PLIRIS")
      throw new AppError(
        422,
        "A WCS-linked PLIRIS adaptation cannot become a personal account.",
      );
    const publishingAccountName =
      data.publishingAccountName || v.publishingAccountName;
    const [previous] = await tx
      .select()
      .from(s.versions)
      .where(eq(s.versions.id, data.expectedVersionId));
    if (
      previous.caption === data.caption &&
      previous.headline === data.headline &&
      previous.script === data.script &&
      previous.chapters === data.chapters &&
      previous.tags === data.tags &&
      previous.ctaText === data.ctaText &&
      previous.ctaUrl === data.ctaUrl &&
      (previous.video?.id || null) === data.videoId &&
      (previous.thumbnail?.id || null) === data.thumbnailId &&
      JSON.stringify(previous.media.map((m) => m.id)) ===
        JSON.stringify(data.mediaIds)
    ) {
      if (
        publishingAccount === v.publishingAccount &&
        publishingAccountName === v.publishingAccountName
      )
        return v;
      const [updated] = await tx
        .update(s.platformVariants)
        .set({
          publishingAccount,
          publishingAccountName,
          updatedAt: new Date(),
        })
        .where(eq(s.platformVariants.id, variantId))
        .returning();
      await audit(tx, actor, "PUBLISHING_ACCOUNT_CHANGED", variantId, {
        publishingAccount,
        publishingAccountName,
      });
      return updated;
    }
    const versionId = await insertVersion(
      tx,
      actor,
      variantId,
      previous.versionNumber + 1,
      data,
    );
    const reviewStatus =
      v.reviewStatus === "DRAFT" || v.reviewStatus === "IN_PRODUCTION"
        ? v.reviewStatus
        : "READY_FOR_REVIEW";
    if (
      reviewStatus === "READY_FOR_REVIEW" &&
      ["IMAGE_POST", "CAROUSEL"].includes(v.contentFormat) &&
      !data.mediaIds.length
    )
      throw new AppError(422, "Reviewable image content needs an image.");
    if (
      reviewStatus === "READY_FOR_REVIEW" &&
      ["SHORT_VIDEO", "LONG_VIDEO"].includes(v.contentFormat) &&
      !data.videoId
    )
      throw new AppError(422, "Reviewable video content needs a video.");
    const [updated] = await tx
      .update(s.platformVariants)
      .set({
        currentVersionId: versionId,
        reviewStatus,
        publishingAccount,
        publishingAccountName,
        publishingStatus: "UNSCHEDULED",
        ...(v.publishingAccount === "PERSONAL"
          ? {
              personalGenerationId: null,
              personalCaptionEdited: true,
              personalCaptionStatus: "OUTDATED",
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(s.platformVariants.id, variantId))
      .returning();
    await audit(tx, actor, "CONTENT_REVISED", variantId, {
      previousVersionId: previous.id,
      versionId,
      schedulingReset: true,
    });
    if (v.publishingAccount === "PLIRIS") {
      const personalMirrors = await tx
        .select()
        .from(s.platformVariants)
        .where(
          and(
            eq(s.platformVariants.contentItemId, v.contentItemId),
            eq(s.platformVariants.platform, v.platform),
            eq(s.platformVariants.contentFormat, v.contentFormat),
            eq(s.platformVariants.publishingAccount, "PERSONAL"),
          ),
        )
        .for("update");
      for (const personal of personalMirrors) {
        const [personalPrevious] = await tx
          .select()
          .from(s.versions)
          .where(eq(s.versions.id, personal.currentVersionId!));
        const personalVersionId = await insertVersion(
          tx,
          actor,
          personal.id,
          personalPrevious.versionNumber + 1,
          {
            ...data,
            // Once personalized, company edits update creative but preserve copy.
            caption:
              personal.personalCaptionStatus === "NOT_GENERATED"
                ? data.caption
                : personalPrevious.caption,
            ctaText: "",
            ctaUrl: "",
          },
        );
        await tx
          .update(s.platformVariants)
          .set({
            currentVersionId: personalVersionId,
            reviewStatus: "DRAFT",
            publishingStatus: "UNSCHEDULED",
            personalCaptionStatus:
              personal.personalCaptionStatus === "NOT_GENERATED"
                ? "NOT_GENERATED"
                : "OUTDATED",
            personalGenerationId: null,
            updatedAt: new Date(),
          })
          .where(eq(s.platformVariants.id, personal.id));
        await audit(tx, actor, "PERSONAL_MIRROR_SYNCED", personal.id, {
          sourceVariantId: variantId,
          sourceVersionId: versionId,
        });
      }
    }
    return updated;
  });
}
const personalInput = z
  .object({
    expectedVersionId: z.string().min(1),
    expectedSourceVersionId: z.string().min(1),
    caption: personalCaptionSchema,
    ready: z.boolean().default(false),
  })
  .strict();
const generationInput = personalInput.pick({
  expectedVersionId: true,
  expectedSourceVersionId: true,
});

async function personalSource(personalId: string) {
  const [personal] = await getDb()
    .select()
    .from(s.platformVariants)
    .where(eq(s.platformVariants.id, personalId));
  if (!personal || personal.publishingAccount !== "PERSONAL")
    throw new AppError(422, "Choose a personal account caption.");
  const [source] = await getDb()
    .select()
    .from(s.platformVariants)
    .where(
      and(
        eq(s.platformVariants.contentItemId, personal.contentItemId),
        eq(s.platformVariants.platform, personal.platform),
        eq(s.platformVariants.contentFormat, personal.contentFormat),
        eq(s.platformVariants.publishingAccount, "PLIRIS"),
      ),
    );
  if (!source)
    throw new AppError(
      422,
      "This personal account has no matching PLIRIS post.",
    );
  return { personal, source };
}
function versionPayload(version: typeof s.versions.$inferSelect) {
  return {
    ...version,
    mediaIds: version.media.map((m) => m.id),
    videoId: version.video?.id || null,
    thumbnailId: version.thumbnail?.id || null,
  };
}
export async function savePersonalCaption(
  actor: Actor,
  personalId: string,
  input: unknown,
) {
  requireProducer(actor);
  const data = personalInput.parse(input);
  const { source } = await personalSource(personalId);
  return getDb().transaction(async (tx) => {
    const currentSource = await lock(tx, source.id);
    const personal = await lock(tx, personalId);
    requireVersion(
      currentSource.currentVersionId,
      data.expectedSourceVersionId,
    );
    requireVersion(personal.currentVersionId, data.expectedVersionId);
    const [previous] = await tx
      .select()
      .from(s.versions)
      .where(eq(s.versions.id, personal.currentVersionId!));
    const [sourceVersion] = await tx
      .select()
      .from(s.versions)
      .where(eq(s.versions.id, currentSource.currentVersionId!));
    const versionId = await insertVersion(
      tx,
      actor,
      personalId,
      previous.versionNumber + 1,
      {
        ...versionPayload(sourceVersion),
        caption: data.caption,
        ctaText: "",
        ctaUrl: "",
      },
    );
    const [updated] = await tx
      .update(s.platformVariants)
      .set({
        currentVersionId: versionId,
        personalSourceVersionId: currentSource.currentVersionId,
        personalGenerationId: null,
        personalCaptionStatus: data.ready ? "READY" : "NEEDS_REVIEW",
        personalCaptionEdited: true,
        reviewStatus:
          data.ready && currentSource.reviewStatus === "APPROVED"
            ? "APPROVED"
            : "DRAFT",
        publishingStatus: "UNSCHEDULED",
        updatedAt: new Date(),
      })
      .where(eq(s.platformVariants.id, personalId))
      .returning();
    await audit(
      tx,
      actor,
      data.ready ? "PERSONAL_CAPTION_READY" : "PERSONAL_CAPTION_SAVED",
      personalId,
      {
        versionId,
        sourceVersionId: currentSource.currentVersionId,
      },
    );
    return updated;
  });
}

export async function generatePersonalCaption(
  actor: Actor,
  personalId: string,
  input: unknown,
) {
  requireProducer(actor);
  const data = generationInput.parse(input);
  return runCaptionGeneration(actor, personalId, data, false);
}

async function runCaptionGeneration(
  actor: Actor,
  personalId: string,
  expected: z.infer<typeof generationInput>,
  automatic: boolean,
) {
  if (!captionAiConfigured())
    throw new AppError(
      503,
      "AI captions are not configured yet. You can write and save a personal caption now.",
    );
  const { source } = await personalSource(personalId);
  const generationId = id();
  const claimed = await getDb().transaction(async (tx) => {
    const currentSource = await lock(tx, source.id);
    const personal = await lock(tx, personalId);
    requireVersion(
      currentSource.currentVersionId,
      expected.expectedSourceVersionId,
    );
    requireVersion(personal.currentVersionId, expected.expectedVersionId);
    if (
      personal.personalCaptionStatus === "GENERATING" &&
      Date.now() - personal.updatedAt.getTime() < 120000
    )
      throw new AppError(
        409,
        "This caption is already generating. Please wait.",
      );
    if (
      automatic &&
      (personal.personalCaptionEdited ||
        (personal.personalSourceVersionId === currentSource.currentVersionId &&
          ["READY", "NEEDS_REVIEW"].includes(personal.personalCaptionStatus)))
    )
      return null;
    const [version] = await tx
      .select()
      .from(s.versions)
      .where(eq(s.versions.id, currentSource.currentVersionId!));
    const [item] = await tx
      .select()
      .from(s.contentItems)
      .where(eq(s.contentItems.id, source.contentItemId));
    await tx.insert(s.captionGenerations).values({
      id: generationId,
      platformVariantId: personalId,
      sourceVersionId: version.id,
      createdBy: actor.id,
      model: captionModel(),
    });
    await tx
      .update(s.platformVariants)
      .set({
        personalCaptionStatus: "GENERATING",
        personalGenerationId: generationId,
        updatedAt: new Date(),
      })
      .where(eq(s.platformVariants.id, personalId));
    return { personal, version, item };
  });
  if (!claimed) return { skipped: true };
  let stage = "provider";
  try {
    const result = await draftPersonalCaption({
      accountName: claimed.personal.publishingAccountName,
      platform: source.platform,
      title: claimed.item.title,
      caption: claimed.version.caption,
    });
    // Persist the result even if a concurrent source/personal edit means it cannot
    // be applied. History keeps this paid output retrievable.
    stage = "save_generation";
    await getDb()
      .update(s.captionGenerations)
      .set({
        result: result.caption,
        usage: result.usage as unknown as Record<string, unknown>,
        status: "COMPLETE",
        updatedAt: new Date(),
      })
      .where(eq(s.captionGenerations.id, generationId));
    stage = "apply_caption";
    return await getDb().transaction(async (tx) => {
      const currentSource = await lock(tx, source.id);
      const personal = await lock(tx, personalId);
      requireVersion(
        currentSource.currentVersionId,
        expected.expectedSourceVersionId,
      );
      requireVersion(personal.currentVersionId, expected.expectedVersionId);
      if (
        personal.personalCaptionStatus !== "GENERATING" ||
        personal.personalGenerationId !== generationId
      )
        throw new AppError(
          409,
          "This caption changed while AI was generating. The result is saved in history.",
        );
      const [previous] = await tx
        .select()
        .from(s.versions)
        .where(eq(s.versions.id, personal.currentVersionId!));
      const versionId = await insertVersion(
        tx,
        actor,
        personalId,
        previous.versionNumber + 1,
        {
          ...versionPayload(claimed.version),
          caption: result.caption,
          ctaText: "",
          ctaUrl: "",
        },
      );
      const [updated] = await tx
        .update(s.platformVariants)
        .set({
          currentVersionId: versionId,
          personalSourceVersionId: claimed.version.id,
          personalGenerationId: null,
          personalCaptionStatus: "NEEDS_REVIEW",
          personalCaptionEdited: false,
          reviewStatus: "DRAFT",
          publishingStatus: "UNSCHEDULED",
          updatedAt: new Date(),
        })
        .where(eq(s.platformVariants.id, personalId))
        .returning();
      await audit(tx, actor, "PERSONAL_CAPTION_GENERATED", personalId, {
        generationId,
        versionId,
        sourceVersionId: claimed.version.id,
        model: result.model,
      });
      return updated;
    });
  } catch (error) {
    const failure = captionGenerationFailure(error);
    const failureMessage =
      error instanceof AppError
        ? error.message
        : stage === "provider"
          ? failure.message
          : "The AI draft could not be saved. Please check the caption generation runtime log.";
    console.error("Personal caption generation failed", {
      generationId,
      stage,
      category: error instanceof AppError ? "workflow" : failure.category,
      errorNames: failure.errorNames,
      upstreamStatus: failure.upstreamStatus,
      providerCode: failure.providerCode,
    });
    await getDb()
      .update(s.captionGenerations)
      .set({
        status:
          error instanceof AppError && error.status === 409
            ? "SUPERSEDED"
            : "FAILED",
        error: failureMessage,
        updatedAt: new Date(),
      })
      .where(eq(s.captionGenerations.id, generationId));
    await getDb()
      .update(s.platformVariants)
      .set({
        personalCaptionStatus: "FAILED",
        personalGenerationId: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(s.platformVariants.id, personalId),
          eq(s.platformVariants.currentVersionId, expected.expectedVersionId),
          eq(s.platformVariants.personalCaptionStatus, "GENERATING"),
          eq(s.platformVariants.personalGenerationId, generationId),
        ),
      );
    if (error instanceof AppError) throw error;
    throw new AppError(502, failureMessage);
  }
}

// Called only by authenticated create/approve/edit routes after the response.
export async function preparePersonalCaptions(actor: Actor, sourceId: string) {
  if (!captionAiConfigured()) return;
  if (!["ADMIN", "PRODUCER", "REVIEWER"].includes(actor.role))
    throw new AppError(403, "Access required.");
  const [source] = await getDb()
    .select()
    .from(s.platformVariants)
    .where(eq(s.platformVariants.id, sourceId));
  if (!source || source.publishingAccount !== "PLIRIS") return;
  if (
    actor.role === "REVIEWER" &&
    (actor.integration || source.reviewStatus !== "APPROVED")
  )
    return;
  const personals = await getDb()
    .select()
    .from(s.platformVariants)
    .where(
      and(
        eq(s.platformVariants.contentItemId, source.contentItemId),
        eq(s.platformVariants.platform, source.platform),
        eq(s.platformVariants.contentFormat, source.contentFormat),
        eq(s.platformVariants.publishingAccount, "PERSONAL"),
      ),
    );
  await Promise.allSettled(
    personals.map((personal) =>
      runCaptionGeneration(
        actor,
        personal.id,
        {
          expectedVersionId: personal.currentVersionId!,
          expectedSourceVersionId: source.currentVersionId!,
        },
        true,
      ),
    ),
  );
}

export async function submitReview(
  actor: Actor,
  variantId: string,
  expected: string,
) {
  requireProducer(actor);
  return getDb().transaction(async (tx) => {
    const v = await lock(tx, variantId);
    requireVersion(v.currentVersionId, expected);
    if (!["DRAFT", "IN_PRODUCTION"].includes(v.reviewStatus))
      throw new AppError(
        409,
        "Create a revised version before submitting again.",
      );
    const [version] = await tx
      .select()
      .from(s.versions)
      .where(eq(s.versions.id, expected));
    if (!version.caption.trim())
      throw new AppError(422, "Add the final caption or description.");
    if (
      ["IMAGE_POST", "CAROUSEL"].includes(v.contentFormat) &&
      !version.media.length
    )
      throw new AppError(422, "Add at least one image before review.");
    if (
      ["SHORT_VIDEO", "LONG_VIDEO"].includes(v.contentFormat) &&
      !version.video
    )
      throw new AppError(422, "Upload the final video before review.");
    if (v.platform === "YOUTUBE" && !version.headline.trim())
      throw new AppError(422, "Add the final YouTube title before review.");
    if (
      v.platform === "YOUTUBE" &&
      v.contentFormat === "LONG_VIDEO" &&
      !version.thumbnail
    )
      throw new AppError(422, "Add the final YouTube thumbnail before review.");
    const [updated] = await tx
      .update(s.platformVariants)
      .set({ reviewStatus: "READY_FOR_REVIEW", updatedAt: new Date() })
      .where(eq(s.platformVariants.id, variantId))
      .returning();
    await audit(tx, actor, "SUBMITTED_FOR_REVIEW", variantId, {
      versionId: expected,
    });
    return updated;
  });
}
export async function decide(
  actor: Actor,
  variantId: string,
  decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED",
  input: unknown,
) {
  requireReviewer(actor);
  const data = decisionSchema.parse(input);
  requireDecision(data.reason, decision);
  return getDb().transaction(async (tx) => {
    const v = await lock(tx, variantId);
    requireVersion(v.currentVersionId, data.expectedVersionId);
    if (v.reviewStatus !== "READY_FOR_REVIEW")
      throw new AppError(409, "This version is not awaiting review.");
    await tx.insert(s.reviewDecisions).values({
      id: id(),
      platformVariantId: variantId,
      versionId: data.expectedVersionId,
      reviewerId: actor.id,
      decision,
      reason: data.reason,
    });
    const [updated] = await tx
      .update(s.platformVariants)
      .set({ reviewStatus: decision, updatedAt: new Date() })
      .where(eq(s.platformVariants.id, variantId))
      .returning();
    if (decision === "APPROVED" && v.publishingAccount === "PLIRIS") {
      const personalMirrors = await tx
        .select()
        .from(s.platformVariants)
        .where(
          and(
            eq(s.platformVariants.contentItemId, v.contentItemId),
            eq(s.platformVariants.platform, v.platform),
            eq(s.platformVariants.contentFormat, v.contentFormat),
            eq(s.platformVariants.publishingAccount, "PERSONAL"),
            eq(s.platformVariants.personalCaptionStatus, "READY"),
            eq(
              s.platformVariants.personalSourceVersionId,
              data.expectedVersionId,
            ),
          ),
        );
      if (personalMirrors.length) {
        await tx
          .update(s.platformVariants)
          .set({ reviewStatus: "APPROVED", updatedAt: new Date() })
          .where(
            and(
              eq(s.platformVariants.contentItemId, v.contentItemId),
              eq(s.platformVariants.platform, v.platform),
              eq(s.platformVariants.contentFormat, v.contentFormat),
              eq(s.platformVariants.publishingAccount, "PERSONAL"),
              eq(s.platformVariants.personalCaptionStatus, "READY"),
              eq(
                s.platformVariants.personalSourceVersionId,
                data.expectedVersionId,
              ),
            ),
          );
        for (const personal of personalMirrors)
          await audit(
            tx,
            actor,
            "PERSONAL_CAPTION_SOURCE_APPROVED",
            personal.id,
            {
              sourceVariantId: variantId,
              sourceVersionId: data.expectedVersionId,
            },
          );
      }
    }
    await audit(tx, actor, decision, variantId, {
      versionId: data.expectedVersionId,
      reason: data.reason,
    });
    return updated;
  });
}
export async function addComment(
  actor: Actor,
  variantId: string,
  input: unknown,
) {
  const data = commentSchema.parse(input);
  return getDb().transaction(async (tx) => {
    await lock(tx, variantId);
    const [version] = await tx
      .select()
      .from(s.versions)
      .where(
        and(
          eq(s.versions.id, data.versionId),
          eq(s.versions.platformVariantId, variantId),
        ),
      );
    if (!version)
      throw new AppError(422, "Version does not belong to this variant.");
    const [comment] = await tx
      .insert(s.comments)
      .values({
        id: id(),
        platformVariantId: variantId,
        ...data,
        authorId: actor.id,
      })
      .returning();
    await audit(tx, actor, "COMMENT_ADDED", variantId, {
      versionId: data.versionId,
    });
    return comment;
  });
}
export async function recordPublishing(
  actor: Actor,
  variantId: string,
  input: unknown,
) {
  requireProducer(actor);
  const data = publishingSchema.parse(input);
  return getDb().transaction(async (tx) => {
    const v = await lock(tx, variantId);
    requireVersion(v.currentVersionId, data.expectedVersionId);
    if (v.publishingAccount === "PERSONAL")
      throw new AppError(
        409,
        "Personal mirrors follow the PLIRIS publishing workflow and cannot be scheduled or published independently.",
      );
    if (v.publishingStatus === "PUBLISHED")
      throw new AppError(409, "This version is already recorded as published.");
    if (v.publishingStatus === "SCHEDULED" && data.status === "SCHEDULED")
      throw new AppError(409, "This version is already recorded as scheduled.");
    if (data.status !== "UNSCHEDULED" && v.reviewStatus !== "APPROVED")
      throw new AppError(409, "Current version must be approved first.");
    if (data.status === "SCHEDULED" && !data.scheduledAt)
      throw new AppError(422, "Scheduled time required.");
    if (
      data.status === "PUBLISHED" &&
      (!data.publishedAt || !data.publishedUrl)
    )
      throw new AppError(
        422,
        "Actual publication time and HTTPS post URL required.",
      );
    await tx.insert(s.publishingRecords).values({
      id: id(),
      platformVariantId: variantId,
      versionId: data.expectedVersionId,
      status: data.status,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      publishedUrl: data.publishedUrl || null,
      createdBy: actor.id,
    });
    await tx
      .update(s.platformVariants)
      .set({ publishingStatus: data.status, updatedAt: new Date() })
      .where(eq(s.platformVariants.id, variantId));
    await audit(tx, actor, "PUBLISHING_RECORDED", variantId, {
      versionId: data.expectedVersionId,
      status: data.status,
      manual: true,
    });
    return { status: data.status };
  });
}
export async function planVariant(
  actor: Actor,
  variantId: string,
  plannedPublishAt: string,
) {
  requireProducer(actor);
  if (!plannedPublishAt || Number.isNaN(Date.parse(plannedPublishAt)))
    throw new AppError(422, "Valid timestamp required.");
  return getDb().transaction(async (tx) => {
    const source = await lock(tx, variantId);
    const [v] = await tx
      .update(s.platformVariants)
      .set({
        plannedPublishAt: new Date(plannedPublishAt),
        updatedAt: new Date(),
      })
      .where(eq(s.platformVariants.id, variantId))
      .returning();
    await audit(tx, actor, "PLANNED_DATE_CHANGED", variantId, {
      plannedPublishAt,
    });
    if (source.publishingAccount === "PLIRIS") {
      const personalMirrors = await tx
        .select()
        .from(s.platformVariants)
        .where(
          and(
            eq(s.platformVariants.contentItemId, source.contentItemId),
            eq(s.platformVariants.platform, source.platform),
            eq(s.platformVariants.contentFormat, source.contentFormat),
            eq(s.platformVariants.publishingAccount, "PERSONAL"),
          ),
        );
      for (const personal of personalMirrors) {
        await tx
          .update(s.platformVariants)
          .set({
            plannedPublishAt: new Date(plannedPublishAt),
            updatedAt: new Date(),
          })
          .where(eq(s.platformVariants.id, personal.id));
        await audit(tx, actor, "PERSONAL_MIRROR_PLAN_SYNCED", personal.id, {
          sourceVariantId: variantId,
          plannedPublishAt,
        });
      }
    }
    return v;
  });
}
export async function listContent() {
  const db = getDb();
  const items = await db
    .select()
    .from(s.contentItems)
    .where(isNull(s.contentItems.archivedAt))
    .orderBy(asc(s.contentItems.contentDate));
  const variants = await db
    .select({ variant: s.platformVariants, version: s.versions })
    .from(s.platformVariants)
    .innerJoin(
      s.versions,
      eq(s.platformVariants.currentVersionId, s.versions.id),
    )
    .orderBy(asc(s.platformVariants.plannedPublishAt));
  return items.map((item) => ({
    ...item,
    variants: variants
      .filter((v) => v.variant.contentItemId === item.id)
      .map(({ variant, version }) => ({ ...variant, version })),
  }));
}
export async function history(variantId: string) {
  const db = getDb();
  const [variant] = await db
    .select()
    .from(s.platformVariants)
    .where(eq(s.platformVariants.id, variantId));
  if (!variant) throw new AppError(404, "Variant not found.");
  const versionList = await db
    .select()
    .from(s.versions)
    .where(eq(s.versions.platformVariantId, variantId))
    .orderBy(asc(s.versions.versionNumber));
  const decisions = await db
    .select({ decision: s.reviewDecisions, reviewer: s.user.name })
    .from(s.reviewDecisions)
    .innerJoin(s.user, eq(s.reviewDecisions.reviewerId, s.user.id))
    .where(eq(s.reviewDecisions.platformVariantId, variantId));
  const commentList = await db
    .select({ comment: s.comments, author: s.user.name })
    .from(s.comments)
    .innerJoin(s.user, eq(s.comments.authorId, s.user.id))
    .where(eq(s.comments.platformVariantId, variantId))
    .orderBy(asc(s.comments.createdAt));
  const events = await db
    .select({ event: s.auditEvents, actor: s.user.name })
    .from(s.auditEvents)
    .innerJoin(s.user, eq(s.auditEvents.actorId, s.user.id))
    .where(eq(s.auditEvents.entityId, variantId))
    .orderBy(asc(s.auditEvents.createdAt));
  const publishing = await db
    .select()
    .from(s.publishingRecords)
    .where(eq(s.publishingRecords.platformVariantId, variantId));
  const generations = await db
    .select()
    .from(s.captionGenerations)
    .where(eq(s.captionGenerations.platformVariantId, variantId))
    .orderBy(asc(s.captionGenerations.createdAt));
  return {
    variant,
    versions: versionList,
    decisions,
    comments: commentList,
    events,
    publishing,
    generations,
  };
}
export async function dashboard() {
  const items = await listContent();
  const variants = items.flatMap((i) =>
    i.variants.map((v) => ({
      ...v,
      title: i.title,
      contentDate: i.contentDate,
    })),
  );
  const canonical = variants.filter((v) => v.publishingAccount === "PLIRIS");
  return {
    items,
    captionAiAvailable: captionAiConfigured(),
    coverage: coverage(canonical),
    counts: {
      review: canonical.filter((v) => v.reviewStatus === "READY_FOR_REVIEW")
        .length,
      revisions: canonical.filter((v) => v.reviewStatus === "CHANGES_REQUESTED")
        .length,
      approved: canonical.filter(
        (v) =>
          v.reviewStatus === "APPROVED" &&
          !["SCHEDULED", "PUBLISHED"].includes(v.publishingStatus),
      ).length,
      upcoming: canonical.filter(
        (v) => new Date(v.plannedPublishAt) >= new Date(),
      ).length,
    },
  };
}
