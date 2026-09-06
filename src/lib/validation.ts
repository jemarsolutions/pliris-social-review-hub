import { z } from "zod";
export const platformSchema = z.enum(["INSTAGRAM", "FACEBOOK", "LINKEDIN"]);
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
    internalReference: z.string().trim().min(1).max(100),
  })
  .strict();
export const snapshotSchema = z
  .object({
    caption: z.string().trim().min(1).max(10000),
    ctaText: z.string().trim().max(300).default(""),
    ctaUrl: urlSchema.default(""),
    mediaIds: z.array(z.string().min(1)).max(20).default([]),
  })
  .strict()
  .refine(
    (x) => new Set(x.mediaIds).size === x.mediaIds.length,
    "Duplicate media",
  );
export const variantSchema = z
  .object({
    platform: platformSchema,
    plannedPublishAt: z.iso.datetime(),
    ...snapshotSchema.shape,
  })
  .strict();
export const editSchema = z
  .object({ ...snapshotSchema.shape, expectedVersionId: z.string().min(1) })
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
