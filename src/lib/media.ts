import { v2 as cloudinary } from "cloudinary";
import { timingSafeEqual } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Transaction } from "@/db";
import { mediaAssets, auditEvents } from "@/db/schema";
import { type Actor, AppError, requireProducer } from "./domain";

const MAX_SERVER_UPLOAD_BYTES = 3_000_000;
const MAX_VIDEO_BYTES = 1_000_000_000;
const imageTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const videoTypes = ["video/mp4", "video/quicktime", "video/webm"] as const;

function cloud() {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  )
    throw new AppError(503, "Cloudinary is not configured.");
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

function isLocalDemo() {
  return (
    process.env.LOCAL_DEMO === "1" &&
    !process.env.DATABASE_URL &&
    !process.env.VERCEL
  );
}

function detectMime(bytes: Buffer) {
  if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
    return "image/jpeg";
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  if (bytes.toString("ascii", 4, 8) === "ftyp") return "video/mp4";
  if (bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])))
    return "video/webm";
  return null;
}

async function auditUpload(
  tx: Transaction,
  actor: Actor,
  assetId: string,
  resourceType: "image" | "video",
) {
  await tx.insert(auditEvents).values({
    id: crypto.randomUUID(),
    actorId: actor.id,
    action: "MEDIA_UPLOADED",
    entityType: "media",
    entityId: assetId,
    metadata: { integration: !!actor.integration, resourceType },
  });
}

export async function uploadMedia(actor: Actor, req: Request) {
  requireProducer(actor);
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > 4_000_000)
    throw new AppError(413, "Server uploads must be under 3 MB.");
  const data = await req.formData();
  const file = data.get("file");
  const altText = String(data.get("altText") || "").trim();
  if (!(file instanceof File) || !altText || altText.length > 500)
    throw new AppError(
      422,
      "A media file and accessible description are required.",
    );
  const supported = [...imageTypes, ...videoTypes] as readonly string[];
  if (file.size > MAX_SERVER_UPLOAD_BYTES || !supported.includes(file.type))
    throw new AppError(
      422,
      "Use a JPEG, PNG, WebP, MP4, MOV or WebM file under 3 MB for this upload.",
    );
  const resourceType = file.type.startsWith("video/") ? "video" : "image";
  if (resourceType === "video" && !isLocalDemo())
    throw new AppError(413, "Use the direct Cloudinary video uploader.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = detectMime(bytes);
  const compatibleQuickTime =
    file.type === "video/quicktime" && detected === "video/mp4";
  if (detected !== file.type && !compatibleQuickTime)
    throw new AppError(422, "Media format does not match the file.");
  const assetId = crypto.randomUUID();
  let metadata: {
    cloudinaryPublicId: string | null;
    width: number;
    height: number;
    durationMs: number;
    storage: string;
    storageVersion: string | null;
  };
  if (isLocalDemo()) {
    const dir = path.resolve(".local/media");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, assetId), bytes);
    metadata = {
      cloudinaryPublicId: null,
      width: 0,
      height: 0,
      durationMs: 0,
      storage: "local",
      storageVersion: null,
    };
  } else {
    const c = cloud();
    const uploaded = await c.uploader.upload(
      `data:${file.type};base64,${bytes.toString("base64")}`,
      {
        resource_type: "image",
        type: "authenticated",
        public_id: `pliris-social/${new Date().getUTCFullYear()}/${assetId}`,
        overwrite: false,
      },
    );
    metadata = {
      cloudinaryPublicId: uploaded.public_id,
      width: uploaded.width,
      height: uploaded.height,
      durationMs: 0,
      storage: "cloudinary",
      storageVersion: String(uploaded.version),
    };
  }
  return getDb().transaction(async (tx) => {
    const [asset] = await tx
      .insert(mediaAssets)
      .values({
        id: assetId,
        ...metadata,
        resourceType,
        mimeType: file.type,
        originalFilename: file.name.slice(0, 250),
        bytes: file.size,
        altText,
        createdBy: actor.id,
      })
      .returning();
    await auditUpload(tx, actor, assetId, resourceType);
    return asset;
  });
}

const signUploadSchema = z
  .object({
    filename: z.string().trim().min(1).max(250),
    mimeType: z.enum(videoTypes),
    bytes: z.number().int().positive().max(MAX_VIDEO_BYTES),
  })
  .strict();

export function signVideoUpload(actor: Actor, input: unknown) {
  requireProducer(actor);
  const data = signUploadSchema.parse(input);
  if (isLocalDemo())
    return {
      mode: "local" as const,
      maxBytes: MAX_SERVER_UPLOAD_BYTES,
      acceptedTypes: videoTypes,
    };
  const c = cloud();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `pliris-social/${new Date().getUTCFullYear()}/${crypto.randomUUID()}`;
  const params = {
    overwrite: "false",
    public_id: publicId,
    timestamp,
    type: "authenticated",
  };
  return {
    mode: "cloudinary" as const,
    uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload`,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    signature: c.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_API_SECRET!,
    ),
    timestamp,
    publicId,
    uploadType: "authenticated",
    overwrite: "false",
    maxBytes: MAX_VIDEO_BYTES,
    acceptedTypes: videoTypes,
    filename: data.filename,
  };
}

const completeUploadSchema = z
  .object({
    publicId: z.string().regex(/^pliris-social\/\d{4}\/[0-9a-f-]{36}$/),
    version: z.number().int().positive(),
    responseSignature: z.string().regex(/^[a-f0-9]{40}$/i),
    mimeType: z.enum(videoTypes),
    originalFilename: z.string().trim().min(1).max(250),
    bytes: z.number().int().positive().max(MAX_VIDEO_BYTES),
    width: z.number().int().nonnegative(),
    height: z.number().int().nonnegative(),
    duration: z
      .number()
      .nonnegative()
      .max(24 * 60 * 60),
    altText: z.string().trim().min(1).max(500),
  })
  .strict();

export async function completeVideoUpload(actor: Actor, input: unknown) {
  requireProducer(actor);
  if (isLocalDemo())
    throw new AppError(409, "Local demo videos use the server upload route.");
  const data = completeUploadSchema.parse(input);
  const c = cloud();
  const expected = c.utils.api_sign_request(
    { public_id: data.publicId, version: data.version },
    process.env.CLOUDINARY_API_SECRET!,
  );
  const suppliedBytes = Buffer.from(data.responseSignature, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  if (
    suppliedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(suppliedBytes, expectedBytes)
  )
    throw new AppError(422, "Cloudinary upload verification failed.");
  const assetId = crypto.randomUUID();
  return getDb().transaction(async (tx) => {
    const [asset] = await tx
      .insert(mediaAssets)
      .values({
        id: assetId,
        cloudinaryPublicId: data.publicId,
        resourceType: "video",
        mimeType: data.mimeType,
        originalFilename: data.originalFilename,
        width: data.width,
        height: data.height,
        durationMs: Math.round(data.duration * 1000),
        bytes: data.bytes,
        altText: data.altText,
        storage: "cloudinary",
        storageVersion: String(data.version),
        createdBy: actor.id,
      })
      .returning();
    await auditUpload(tx, actor, assetId, "video");
    return asset;
  });
}

export async function deliverMedia(assetId: string, thumbnail = false) {
  const [asset] = await getDb()
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, assetId));
  if (!asset) throw new AppError(404, "Media not found.");
  const headers = {
    "Content-Type": asset.mimeType,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (asset.storage === "local") {
    if (!isLocalDemo()) throw new AppError(404, "Local media unavailable.");
    const bytes = await readFile(path.resolve(".local/media", asset.id));
    return new Response(bytes, { headers });
  }
  const c = cloud();
  if (asset.resourceType === "video") {
    const url = c.url(asset.cloudinaryPublicId!, {
      secure: true,
      sign_url: true,
      type: "authenticated",
      resource_type: "video",
      version: asset.storageVersion || undefined,
      ...(thumbnail
        ? {
            format: "jpg",
            transformation: [{ width: 720, crop: "limit", start_offset: "0" }],
          }
        : asset.mimeType === "video/mp4"
          ? {}
          : { format: "mp4" }),
    });
    return new Response(null, {
      status: 307,
      headers: { ...headers, Location: url },
    });
  }
  const url = c.url(asset.cloudinaryPublicId!, {
    secure: true,
    sign_url: true,
    type: "authenticated",
    resource_type: "image",
    version: asset.storageVersion || undefined,
    transformation: [
      {
        width: thumbnail ? 440 : 1400,
        crop: "limit",
        quality: "auto",
        fetch_format: "auto",
      },
    ],
  });
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new AppError(502, "Media delivery failed.");
  return new Response(response.body, {
    headers: {
      ...headers,
      "Content-Type": response.headers.get("content-type") || asset.mimeType,
    },
  });
}
