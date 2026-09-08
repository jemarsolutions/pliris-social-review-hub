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
  .object({ ...snapshotFields, expectedVersionId: z.string().min(1) })
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
