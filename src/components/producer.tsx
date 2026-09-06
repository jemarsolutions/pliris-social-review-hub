"use client";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  FileVideo2,
  ImagePlus,
  Trash2,
  Upload,
} from "lucide-react";
import { formatsByPlatform, platformValues } from "@/lib/platform-config";
import { uploadVideo } from "@/lib/client-video-upload";
import { Button } from "./ui/button";
import {
  api,
  type ContentFormat,
  type Item,
  type MediaAsset,
  type Platform,
  type Variant,
} from "./types";

function orientation(media: MediaAsset) {
  if (!media.width || !media.height)
    return "Orientation detected in production";
  const ratio = media.width / media.height;
  if (ratio > 1.15) return `${media.width}×${media.height} · Landscape`;
  if (ratio < 0.87) return `${media.width}×${media.height} · Portrait`;
  return `${media.width}×${media.height} · Square`;
}

function duration(ms: number) {
  if (!ms) return "";
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function Editor({
  item,
  variant,
  onDone,
}: {
  item: Item;
  variant?: Variant;
  onDone: () => Promise<void>;
}) {
  const availableFormats = (platform: Platform) =>
    formatsByPlatform[platform].filter(
      (format) =>
        !item.variants.some(
          (existing) =>
            existing.platform === platform && existing.contentFormat === format,
        ),
    );
  const firstPlatform =
    platformValues.find((candidate) => availableFormats(candidate).length) ||
    "INSTAGRAM";
  const [platform, setPlatform] = useState<Platform>(
      variant?.platform || firstPlatform,
    ),
    [contentFormat, setContentFormat] = useState<ContentFormat>(
      variant?.contentFormat ||
        availableFormats(firstPlatform)[0] ||
        "IMAGE_POST",
    ),
    [media, setMedia] = useState(variant?.version.media || []),
    [video, setVideo] = useState<MediaAsset | null>(
      variant?.version.video || null,
    ),
    [thumbnail, setThumbnail] = useState<MediaAsset | null>(
      variant?.version.thumbnail || null,
    ),
    [caption, setCaption] = useState(variant?.version.caption || ""),
    [imageAlt, setImageAlt] = useState(""),
    [videoAlt, setVideoAlt] = useState(""),
    [thumbnailAlt, setThumbnailAlt] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [uploadProgress, setUploadProgress] = useState(0);
  const isVideo = ["SHORT_VIDEO", "LONG_VIDEO"].includes(contentFormat);
  const platformOptions = platformValues.filter(
    (candidate) => availableFormats(candidate).length,
  );
  const formatOptions = variant
    ? [variant.contentFormat]
    : availableFormats(platform);

  function move(index: number, delta: number) {
    setMedia((old) => {
      const next = [...old];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next.map((value, position) => ({
        ...value,
        sortOrder: position,
      }));
    });
  }

  async function uploadImage(file: File, altText: string) {
    const form = new FormData();
    form.set("file", file);
    form.set("altText", altText);
    return api<MediaAsset>("media", "POST", form);
  }

  if (!variant && !platformOptions.length)
    return (
      <p>
        Every available platform and format has been added. Open an adaptation
        to create a revised version.
      </p>
    );

  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        const form = new FormData(event.currentTarget);
        try {
          const snapshot = {
            caption,
            headline: isVideo ? form.get("headline") : "",
            script: isVideo ? form.get("script") : "",
            chapters:
              isVideo && platform === "YOUTUBE" ? form.get("chapters") : "",
            tags: isVideo ? form.get("tags") : "",
            ctaText: form.get("ctaText"),
            ctaUrl: form.get("ctaUrl"),
            mediaIds: isVideo ? [] : media.map((asset) => asset.id),
            videoId: isVideo ? video?.id || null : null,
            thumbnailId: isVideo ? thumbnail?.id || null : null,
          };
          if (variant) {
            await api(`platform-variants/${variant.id}`, "PATCH", {
              ...snapshot,
              expectedVersionId: variant.currentVersionId,
            });
            const planned = new Date(
              String(form.get("plannedPublishAt")) + "Z",
            ).toISOString();
            if (planned !== new Date(variant.plannedPublishAt).toISOString())
              await api(`platform-variants/${variant.id}/plan`, "POST", {
                plannedPublishAt: planned,
              });
          } else {
            await api(`content/${item.id}/platform-variants`, "POST", {
              ...snapshot,
              platform,
              contentFormat,
              plannedPublishAt: new Date(
                String(form.get("plannedPublishAt")) + "Z",
              ).toISOString(),
            });
          }
          await onDone();
        } catch (caught) {
          setError((caught as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        {!variant ? (
          <>
            <label>
              Platform
              <select
                name="platform"
                value={platform}
                onChange={(event) => {
                  const next = event.target.value as Platform;
                  setPlatform(next);
                  setContentFormat(availableFormats(next)[0]);
                }}
              >
                {platformOptions.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Format
              <select
                name="contentFormat"
                value={contentFormat}
                onChange={(event) =>
                  setContentFormat(event.target.value as ContentFormat)
                }
              >
                {formatOptions.map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <div className="format-summary">
            <strong>{platform.replaceAll("_", " ")}</strong>
            <span>{contentFormat.replaceAll("_", " ")}</span>
          </div>
        )}
        <label>
          Planned date / time (UTC)
          <input
            name="plannedPublishAt"
            type="datetime-local"
            required
            defaultValue={
              variant
                ? variant.plannedPublishAt.slice(0, 16)
                : `${item.contentDate}T16:00`
            }
          />
        </label>
      </div>

      {isVideo && (
        <>
          <label>
            {platform === "YOUTUBE" ? "Final YouTube title" : "Video title"}
            <input
              name="headline"
              required={platform === "YOUTUBE"}
              maxLength={200}
              defaultValue={variant?.version.headline}
            />
          </label>
          <div className="editor-video">
            <div className="editor-section-heading">
              <div>
                <h3>Final video</h3>
                <p>
                  Upload the exact portrait or landscape cut the reviewer will
                  approve.
                </p>
              </div>
              <FileVideo2 size={24} />
            </div>
            {video && (
              <div className="video-asset-card">
                <video
                  controls
                  preload="metadata"
                  aria-label={video.altText}
                  src={`/api/media/${video.id}`}
                  poster={
                    thumbnail
                      ? `/api/media/${thumbnail.id}?thumb=1`
                      : `/api/media/${video.id}?thumb=1`
                  }
                />
                <div>
                  <strong>{video.altText}</strong>
                  <span>
                    {orientation(video)}
                    {duration(video.durationMs)
                      ? ` · ${duration(video.durationMs)}`
                      : ""}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setVideo(null)}
                  >
                    <Trash2 size={15} /> Remove from this version
                  </Button>
                </div>
              </div>
            )}
            <label>
              Accessible video description
              <input
                value={videoAlt}
                onChange={(event) => setVideoAlt(event.target.value)}
                maxLength={500}
                placeholder="Describe the final video for reviewers"
              />
            </label>
            <label
              className={`upload-control ${uploading || !videoAlt.trim() ? "disabled" : ""}`}
            >
              <Upload size={20} />
              {uploading
                ? `Uploading video · ${uploadProgress}%`
                : video
                  ? "Replace final video"
                  : "Upload final video"}
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                disabled={uploading || !videoAlt.trim()}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  setUploadProgress(0);
                  setError("");
                  try {
                    const asset = await uploadVideo(
                      file,
                      videoAlt,
                      setUploadProgress,
                    );
                    setVideo({ ...asset, sortOrder: 0 });
                    setVideoAlt("");
                  } catch (caught) {
                    setError((caught as Error).message);
                  } finally {
                    setUploading(false);
                    event.target.value = "";
                  }
                }}
              />
            </label>
            {uploading && (
              <progress value={uploadProgress} max={100}>
                {uploadProgress}%
              </progress>
            )}
            <small>
              MP4, MOV or WebM · Production review copy up to 1 GB · Large files
              upload in resumable chunks
            </small>
          </div>

          <div className="editor-media compact-media">
            <div className="editor-section-heading">
              <div>
                <h3>Thumbnail or cover</h3>
                <p>
                  Required for a full YouTube episode and optional for
                  short-form video.
                </p>
              </div>
              <ImagePlus size={22} />
            </div>
            {thumbnail && (
              <div className="thumbnail-asset-card">
                <img
                  src={`/api/media/${thumbnail.id}?thumb=1`}
                  alt={thumbnail.altText}
                />
                <div>
                  <strong>{thumbnail.altText}</strong>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setThumbnail(null)}
                  >
                    <Trash2 size={15} /> Remove
                  </Button>
                </div>
              </div>
            )}
            <label>
              Thumbnail description
              <input
                value={thumbnailAlt}
                onChange={(event) => setThumbnailAlt(event.target.value)}
                maxLength={500}
              />
            </label>
            <label
              className={`upload-control ${uploading || !thumbnailAlt.trim() ? "disabled" : ""}`}
            >
              <ImagePlus size={20} />
              {thumbnail ? "Replace thumbnail" : "Upload thumbnail"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading || !thumbnailAlt.trim()}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  setError("");
                  try {
                    const asset = await uploadImage(file, thumbnailAlt);
                    setThumbnail({ ...asset, sortOrder: 0 });
                    setThumbnailAlt("");
                  } catch (caught) {
                    setError((caught as Error).message);
                  } finally {
                    setUploading(false);
                    event.target.value = "";
                  }
                }}
              />
            </label>
          </div>
        </>
      )}

      <label>
        {platform === "YOUTUBE" ? "Final description" : "Full caption"}
        <textarea
          rows={6}
          required
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          maxLength={10000}
        />
      </label>
      <small>{caption.length} characters</small>

      {isVideo && (
        <>
          <label>
            Final script or transcript
            <textarea
              name="script"
              rows={8}
              maxLength={60000}
              defaultValue={variant?.version.script}
              placeholder="Paste the final script, outline or transcript used for this video."
            />
          </label>
          {platform === "YOUTUBE" && (
            <label>
              Chapters and timestamps
              <textarea
                name="chapters"
                rows={4}
                maxLength={10000}
                defaultValue={variant?.version.chapters}
                placeholder={"00:00 Introduction\n02:15 First topic"}
              />
            </label>
          )}
          <label>
            Tags, hashtags or publishing notes
            <textarea
              name="tags"
              rows={3}
              maxLength={2000}
              defaultValue={variant?.version.tags}
            />
          </label>
        </>
      )}

      <div className="form-grid">
        <label>
          CTA text
          <input
            name="ctaText"
            defaultValue={variant?.version.ctaText}
            maxLength={300}
          />
        </label>
        <label>
          Destination URL
          <input
            name="ctaUrl"
            type="url"
            placeholder="https://…"
            defaultValue={variant?.version.ctaUrl}
          />
        </label>
      </div>

      {!isVideo && (
        <div className="editor-media">
          <h3>Images & carousel order</h3>
          <p>The order shown here is the order the reviewer approves.</p>
          <div className="media-edit-grid">
            {media.map((asset, index) => (
              <div key={asset.id}>
                <img
                  src={`/api/media/${asset.id}?thumb=1`}
                  alt={asset.altText}
                />
                <p>
                  {index + 1}. {asset.altText}
                </p>
                <div className="actions">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Move slide ${index + 1} earlier`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowLeft size={15} />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Move slide ${index + 1} later`}
                    disabled={index === media.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowRight size={15} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove slide ${index + 1}`}
                    onClick={() =>
                      setMedia((old) =>
                        old.filter((value) => value.id !== asset.id),
                      )
                    }
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <label>
            Alt text for the next image
            <input
              value={imageAlt}
              onChange={(event) => setImageAlt(event.target.value)}
              maxLength={500}
            />
          </label>
          <label
            className={`upload-control ${uploading || !imageAlt.trim() ? "disabled" : ""}`}
          >
            <Upload size={20} />
            {uploading ? "Uploading…" : "Upload image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading || !imageAlt.trim() || media.length >= 20}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setUploading(true);
                setError("");
                try {
                  const asset = await uploadImage(file, imageAlt);
                  setMedia((old) => [
                    ...old,
                    { ...asset, sortOrder: old.length },
                  ]);
                  setImageAlt("");
                } catch (caught) {
                  setError((caught as Error).message);
                } finally {
                  setUploading(false);
                  event.target.value = "";
                }
              }}
            />
          </label>
          <small>
            {imageAlt.trim()
              ? "JPEG, PNG or WebP · Up to 3 MB each"
              : "Enter alt text above to enable image upload"}
          </small>
        </div>
      )}

      {variant && (
        <p className="notice">
          A substantive change creates version{" "}
          {variant.version.versionNumber + 1}. Previous decisions remain in
          history. A reviewed adaptation returns to Ready for review.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <Button disabled={busy || uploading}>
        {busy ? "Saving…" : variant ? "Save changes" : "Save platform draft"}
      </Button>
    </form>
  );
}
