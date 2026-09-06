"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Trash2, Upload } from "lucide-react";
import { Button } from "./ui/button";
import { api, type Item, type Variant } from "./types";
export function Editor({
  item,
  variant,
  onDone,
}: {
  item: Item;
  variant?: Variant;
  onDone: () => Promise<void>;
}) {
  const [media, setMedia] = useState(variant?.version.media || []),
    [caption, setCaption] = useState(variant?.version.caption || ""),
    [alt, setAlt] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false);
  function move(index: number, delta: number) {
    setMedia((old) => {
      const next = [...old];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next.map((v, i) => ({ ...v, sortOrder: i }));
    });
  }
  const platforms = ["INSTAGRAM", "FACEBOOK", "LINKEDIN"].filter(
    (p) => !item.variants.some((v) => v.platform === p),
  );
  if (!variant && !platforms.length)
    return (
      <p>
        All three platforms have been added. Open one to create a revised
        version.
      </p>
    );
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        try {
          const snapshot = {
            caption,
            ctaText: f.get("ctaText"),
            ctaUrl: f.get("ctaUrl"),
            mediaIds: media.map((m) => m.id),
          };
          if (variant) {
            await api(`platform-variants/${variant.id}`, "PATCH", {
              ...snapshot,
              expectedVersionId: variant.currentVersionId,
            });
            const planned = new Date(
              String(f.get("plannedPublishAt")) + "Z",
            ).toISOString();
            if (planned !== new Date(variant.plannedPublishAt).toISOString())
              await api(`platform-variants/${variant.id}/plan`, "POST", {
                plannedPublishAt: planned,
              });
          } else
            await api(`content/${item.id}/platform-variants`, "POST", {
              ...snapshot,
              platform: f.get("platform"),
              plannedPublishAt: new Date(
                String(f.get("plannedPublishAt")) + "Z",
              ).toISOString(),
            });
          await onDone();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        {!variant && (
          <label>
            Platform
            <select name="platform">
              {platforms.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
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
      <label>
        Full caption
        <textarea
          rows={6}
          required
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={10000}
        />
      </label>
      <small>{caption.length} characters</small>
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
      <div className="editor-media">
        <h3>Images & carousel order</h3>
        <p>The order shown here is the order the reviewer approves.</p>
        <div className="media-edit-grid">
          {media.map((m, i) => (
            <div key={m.id}>
              <img src={`/api/media/${m.id}?thumb=1`} alt={m.altText} />
              <p>
                {i + 1}. {m.altText}
              </p>
              <div className="actions">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Move slide ${i + 1} earlier`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowLeft size={15} />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Move slide ${i + 1} later`}
                  disabled={i === media.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowRight size={15} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove slide ${i + 1}`}
                  onClick={() =>
                    setMedia((old) => old.filter((x) => x.id !== m.id))
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
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            maxLength={500}
          />
        </label>
        <label
          className={`upload-control ${uploading || !alt.trim() ? "disabled" : ""}`}
        >
          <Upload size={20} />
          {uploading ? "Uploading…" : "Upload image"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading || !alt.trim() || media.length >= 20}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              setError("");
              const f = new FormData();
              f.set("file", file);
              f.set("altText", alt);
              try {
                const asset = await api<{ id: string; altText: string }>(
                  "media",
                  "POST",
                  f,
                );
                setMedia((old) => [
                  ...old,
                  {
                    id: asset.id,
                    altText: asset.altText,
                    sortOrder: old.length,
                  },
                ]);
                setAlt("");
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setUploading(false);
                e.target.value = "";
              }
            }}
          />
        </label>
        <small>
          {alt.trim()
            ? "JPEG, PNG or WebP · Up to 3 MB each"
            : "Enter alt text above to enable image upload"}
        </small>
      </div>
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
