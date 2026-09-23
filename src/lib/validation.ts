import { z } from "zod";
import {
  contentFormatValues,
  isPlatformFormatAllowed,
  platformValues,
} from "./platform-config";
export const platformSchema = z.enum(platformValues);
export const contentFormatSchema = z.enum(contentFormatValues);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date",
  );
export const urlSchema = z.union([
  z.literal(""),
  z.url().refine((v) => new URL(v).protocol === "https:", "Use an HTTPS URL"),
]);
export const contentSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    contentDate: dateSchema,
    campaign: z.string().trim().max(200).default(""),
    conceptSummary: z.string().trim().max(4000).default(""),
    internalReference: z.string().trim().min(1).max(100).optional(),
  })
  .strict();
const snapshotFields = {
  caption: z.string().trim().min(1).max(10000),
  headline: z.string().trim().max(200).default(""),
  script: z.string().trim().max(60000).default(""),
  chapters: z.string().trim().max(10000).default(""),
  tags: z.string().trim().max(2000).default(""),
  ctaText: z.string().trim().max(300).default(""),
  ctaUrl: urlSchema.default(""),
  mediaIds: z.array(z.string().min(1)).max(20).default([]),
  videoId: z.string().min(1).nullable().default(null),
  thumbnailId: z.string().min(1).nullable().default(null),
};
export const snapshotSchema = z
  .object(snapshotFields)
  .strict()
  .refine(
    (x) => new Set(x.mediaIds).size === x.mediaIds.length,
    "Duplicate media",
  );
export const variantSchema = z
  .object({
    platform: platformSchema,
    contentFormat: contentFormatSchema.default("IMAGE_POST"),
    plannedPublishAt: z.iso.datetime(),
    publishingAccount: z.enum(["PLIRIS", "PERSONAL"]).default("PLIRIS"),
    publishingAccountName: z.string().trim().min(1).max(200).default("PLIRIS"),
    ...snapshotFields,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!isPlatformFormatAllowed(value.platform, value.contentFormat))
      ctx.addIssue({
        code: "custom",
        path: ["contentFormat"],
        message: "That format is not available for this platform.",
      });
  });
export const editSchema = z
  .object({
    ...snapshotFields,
    expectedVersionId: z.string().min(1),
    publishingAccount: z.enum(["PLIRIS", "PERSONAL"]).optional(),
    publishingAccountName: z.string().trim().min(1).max(200).optional(),
  })
  .strict();
export const decisionSchema = z
  .object({
    expectedVersionId: z.string().min(1),
    reason: z.string().trim().max(4000).default(""),
  })
  .strict();
export const commentSchema = z
  .object({
    versionId: z.string().min(1),
    body: z.string().trim().min(1).max(4000),
  })
  .strict();
export const publishingSchema = z
  .object({
    expectedVersionId: z.string().min(1),
    status: z.enum([
      "UNSCHEDULED",
      "READY_TO_SCHEDULE",
      "SCHEDULED",
      "PUBLISHED",
    ]),
    scheduledAt: z.iso.datetime().optional(),
    publishedAt: z.iso.datetime().optional(),
    publishedUrl: urlSchema.optional(),
  })
  .strict();

export const wcsPostSchema = z
  .object({
    contentId: z.string().trim().min(1).max(100),
    title: z.string().trim().min(1).max(200),
    contentDate: dateSchema,
    campaign: z.string().trim().max(200).default("WCS"),
    conceptSummary: z.string().trim().max(4000).default(""),
    platform: platformSchema,
    contentFormat: contentFormatSchema,
    plannedPublishAt: z.iso.datetime(),
    publishingAccountName: z.string().trim().min(1).max(200).default("PLIRIS"),
    caption: z.string().trim().min(1).max(10000),
    headline: z.string().trim().max(200).default(""),
    script: z.string().trim().max(60000).default(""),
    chapters: z.string().trim().max(10000).default(""),
    tags: z.string().trim().max(2000).default(""),
    ctaText: z.string().trim().max(300).default(""),
    ctaUrl: urlSchema.default(""),
    mediaIds: z.array(z.string().min(1)).max(20).default([]),
    videoId: z.string().min(1).nullable().default(null),
    thumbnailId: z.string().min(1).nullable().default(null),
    submitForReview: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!isPlatformFormatAllowed(value.platform, value.contentFormat))
      ctx.addIssue({
        code: "custom",
        path: ["contentFormat"],
        message: "That format is not available for this platform.",
      });
    if (!value.submitForReview) return;
    if (
      ["IMAGE_POST", "CAROUSEL"].includes(value.contentFormat) &&
      value.mediaIds.length === 0
    )
      ctx.addIssue({
        code: "custom",
        path: ["mediaIds"],
        message: "Review-ready image posts require uploaded media IDs.",
      });
    if (
      ["SHORT_VIDEO", "LONG_VIDEO"].includes(value.contentFormat) &&
      !value.videoId
    )
      ctx.addIssue({
        code: "custom",
        path: ["videoId"],
        message: "Review-ready video posts require an uploaded video ID.",
      });
    if (value.platform === "YOUTUBE" && !value.headline)
      ctx.addIssue({
        code: "custom",
        path: ["headline"],
        message: "Review-ready YouTube posts require a headline.",
      });
    if (
      value.platform === "YOUTUBE" &&
      value.contentFormat === "LONG_VIDEO" &&
      !value.thumbnailId
    )
      ctx.addIssue({
        code: "custom",
        path: ["thumbnailId"],
        message: "Review-ready long-form YouTube posts require a thumbnail ID.",
      });
  });
