import { v2 as cloudinary } from "cloudinary";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mediaAssets, auditEvents } from "@/db/schema";
import { type Actor, AppError, requireProducer } from "./domain";
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
export async function uploadMedia(actor: Actor, req: Request) {
  requireProducer(actor);
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > 4_000_000)
    throw new AppError(413, "Image must be under 3 MB.");
  const data = await req.formData();
  const file = data.get("file");
  const altText = String(data.get("altText") || "").trim();
  if (!(file instanceof File) || !altText || altText.length > 500)
    throw new AppError(422, "An image and alt text are required.");
  if (
    file.size > 3_000_000 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    throw new AppError(422, "Use a JPEG, PNG or WebP under 3 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
    ? "image/jpeg"
    : bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? "image/png"
      : bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP"
        ? "image/webp"
        : null;
  if (detected !== file.type)
    throw new AppError(422, "Image format does not match the file.");
  const assetId = crypto.randomUUID();
  let metadata: {
    cloudinaryPublicId: string | null;
    width: number;
    height: number;
    storage: string;
    storageVersion: string | null;
  };
  if (
    process.env.LOCAL_DEMO === "1" &&
    !process.env.DATABASE_URL &&
    !process.env.VERCEL
  ) {
    const dir = path.resolve(".local/media");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, assetId), bytes);
    metadata = {
      cloudinaryPublicId: null,
      width: 0,
      height: 0,
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
        mimeType: file.type,
        originalFilename: file.name.slice(0, 250),
        bytes: file.size,
        altText,
        createdBy: actor.id,
      })
      .returning();
    await tx
      .insert(auditEvents)
      .values({
        id: crypto.randomUUID(),
        actorId: actor.id,
        action: "MEDIA_UPLOADED",
        entityType: "media",
        entityId: assetId,
        metadata: { integration: !!actor.integration },
      });
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
    if (process.env.LOCAL_DEMO !== "1" || process.env.VERCEL)
      throw new AppError(404, "Local media unavailable.");
    const bytes = await readFile(path.resolve(".local/media", asset.id));
    return new Response(bytes, { headers });
  }
  const c = cloud();
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
