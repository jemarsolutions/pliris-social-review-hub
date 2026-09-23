"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Heart,
  MessageCircle,
  Bookmark,
  MoreHorizontal,
  ThumbsUp,
  Share2,
  Maximize2,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  api,
  type Item,
  type Variant,
  type History,
  type Version,
} from "./types";
import { effectiveStatus, Platform, Status, formatDate, label } from "./hub";
export function Review({
  item,
  variant,
  reviewer,
  refresh,
  onEdit,
}: {
  item: Item;
  variant: Variant;
  reviewer: boolean;
  refresh: () => Promise<void>;
  onEdit: () => void;
}) {
  const [history, setHistory] = useState<History | null>(null),
    [versionId, setVersionId] = useState(variant.currentVersionId),
    [slide, setSlide] = useState(0),
    [feedback, setFeedback] = useState(""),
    [comment, setComment] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [enlarged, setEnlarged] = useState(false),
    [tab, setTab] = useState("Review"),
    [publishing, setPublishing] = useState(false),
    [previewVariant, setPreviewVariant] = useState(variant);
  async function load() {
    setHistory(await api<History>(`platform-variants/${variant.id}/history`));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
    setVersionId(variant.currentVersionId);
    setSlide(0);
    setTab("Review");
    setPreviewVariant(variant);
  }, [variant.id, variant.currentVersionId, variant.reviewStatus]);
  const version =
    history?.versions.find((v) => v.id === versionId) || variant.version;
  const current = version.id === variant.currentVersionId;
  const decision = history?.decisions.find(
    (d) => d.decision.versionId === version.id,
  );
  const media = version.media[slide];
  const isVideo = ["SHORT_VIDEO", "LONG_VIDEO"].includes(variant.contentFormat);
  const accountName = variant.publishingAccountName;
  const previewVersion =
    previewVariant.id === variant.id ? version : previewVariant.version;
  const previewMedia = previewVersion.media[slide];
  const previewIsVideo = ["SHORT_VIDEO", "LONG_VIDEO"].includes(
    previewVariant.contentFormat,
  );
  const publishedRecord = history?.publishing
    .slice()
    .reverse()
    .find((record) => record.status === "PUBLISHED");
  const personalVariants = item.variants.filter(
    (candidate) =>
      variant.publishingAccount === "PLIRIS" &&
      candidate.publishingAccount === "PERSONAL" &&
      candidate.platform === variant.platform &&
      candidate.contentFormat === variant.contentFormat,
  );
  async function action(path: string, data: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`platform-variants/${variant.id}/${path}`, "POST", data);
      await refresh();
      await load();
      setMessage("Saved.");
      setFeedback("");
      setComment("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="review-layout">
      <div className="preview-column">
        <header className="preview-heading">
          <Platform value={previewVariant.platform} />
          <span>{label(previewVariant.contentFormat)} · Platform preview</span>
        </header>
        <div
          className={`preview-mode-indicator ${
            previewVariant.publishingAccount === "PERSONAL"
              ? "personal"
              : "pliris"
          }`}
          role="status"
        >
          <strong>
            {previewVariant.publishingAccount === "PERSONAL"
              ? "PERSONAL PREVIEW"
              : "PLIRIS PREVIEW"}
          </strong>
          <span>
            {previewVariant.publishingAccount === "PERSONAL"
              ? `Viewing ${previewVariant.publishingAccountName}`
              : "Canonical company post"}
          </span>
        </div>
        <div
          className={`social-preview social-${previewVariant.platform.toLowerCase()}`}
        >
          <div className="social-account">
            <div className="brand-avatar">P</div>
            <div>
              <strong>{previewVariant.publishingAccountName}</strong>
              <small>
                {previewVariant.platform === "LINKEDIN"
                  ? "Residential design · Sample content"
                  : "Sample content"}
              </small>
            </div>
            <MoreHorizontal size={22} />
          </div>
          {!["INSTAGRAM", "TIKTOK", "YOUTUBE"].includes(variant.platform) && (
            <p className="caption pre-media">{previewVersion.caption}</p>
          )}
          {previewVariant.contentFormat !== "TEXT_POST" && (
            <div
              className={`preview-media ${
                previewIsVideo
                  ? `video-preview ${
                      previewVariant.contentFormat === "SHORT_VIDEO"
                        ? "portrait-video"
                        : "landscape-video"
                    }`
                  : ""
              }`}
            >
              {previewIsVideo && previewVersion.video ? (
                <video
                  controls
                  preload="metadata"
                  aria-label={previewVersion.video.altText}
                  src={`/api/media/${previewVersion.video.id}`}
                  poster={
                    previewVersion.thumbnail
                      ? `/api/media/${previewVersion.thumbnail.id}?thumb=1`
                      : `/api/media/${previewVersion.video.id}?thumb=1`
                  }
                />
              ) : previewMedia ? (
                <img
                  src={`/api/media/${previewMedia.id}`}
                  alt={previewMedia.altText}
                />
              ) : (
                <div className="no-media">
                  No {previewIsVideo ? "video" : "image"} attached
                </div>
              )}
              {!previewIsVideo && previewMedia && (
                <button
                  className="enlarge"
                  aria-label="Enlarge image"
                  onClick={() => setEnlarged(true)}
                >
                  <Maximize2 size={18} />
                </button>
              )}
              {!previewIsVideo && previewVersion.media.length > 1 && (
                <>
                  <button
                    className="slide-arrow previous"
                    aria-label="Previous slide"
                    disabled={slide === 0}
                    onClick={() => setSlide((s) => s - 1)}
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <button
                    className="slide-arrow next"
                    aria-label="Next slide"
                    disabled={slide === previewVersion.media.length - 1}
                    onClick={() => setSlide((s) => s + 1)}
                  >
                    <ArrowRight size={18} />
                  </button>
                  <span className="slide-counter">
                    {slide + 1} / {previewVersion.media.length}
                  </span>
                </>
              )}
            </div>
          )}
          <div className="preview-icons" aria-hidden="true">
            {["INSTAGRAM", "TIKTOK"].includes(previewVariant.platform) ? (
              <>
                <Heart />
                <MessageCircle />
                <Share2 />
                <Bookmark className="push-right" />
              </>
            ) : (
              <>
                <ThumbsUp />
                <span>Like</span>
                <MessageCircle />
                <span>Comment</span>
                <Share2 />
              </>
            )}
          </div>
          {previewIsVideo && previewVersion.headline && (
            <h3 className="video-headline">{previewVersion.headline}</h3>
          )}
          {["INSTAGRAM", "TIKTOK", "YOUTUBE"].includes(
            previewVariant.platform,
          ) && (
            <p className="caption">
              {previewVariant.platform !== "YOUTUBE" && (
                <strong>{previewVariant.publishingAccountName} </strong>
              )}
              {previewVersion.caption}
            </p>
          )}
          {previewVersion.ctaText && (
            <div className="preview-cta">
              {previewVersion.ctaText}
              <ArrowUpRightIcon />
            </div>
          )}
        </div>
        {!previewIsVideo && previewVersion.media.length > 1 && (
          <div className="thumbnails" aria-label="Carousel slides">
            {previewVersion.media.map((m, i) => (
              <button
                key={m.id}
                aria-label={`View slide ${i + 1}`}
                aria-pressed={slide === i}
                onClick={() => setSlide(i)}
              >
                <img src={`/api/media/${m.id}?thumb=1`} alt={m.altText} />
                <span>{i + 1}</span>
              </button>
            ))}
          </div>
        )}
        <small className="preview-note">
          Preview is an approximation. Actual platform presentation may vary.
        </small>
      </div>
      <div className="decision-column">
        <p className="eyebrow">
          {item.internalReference} ·{" "}
          {variant.wcsContentId ? `${variant.wcsContentId} · ` : ""}
          {formatDate(variant.plannedPublishAt)}
        </p>
        <h2>{item.title}</h2>
        <div className="version-bar">
          <Status
            value={
              current
                ? effectiveStatus(variant)
                : decision?.decision.decision || "DRAFT"
            }
          />
          <span>
            Version {version.versionNumber}
            {!current ? " · Historical" : ""}
          </span>
        </div>
        <div className="detail-tabs" role="tablist" aria-label="Review details">
          {[
            "Review",
            ...(personalVariants.length ? ["Personal"] : []),
            ...(isVideo ? ["Script"] : []),
            "History",
          ].map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
            >
              {t}
              {t === "History" && history
                ? ` (${history.versions.length})`
                : ""}
            </button>
          ))}
        </div>
        {tab === "Personal" ? (
          <section className="personal-preview-panel">
            <p className="eyebrow">PERSONAL SOCIAL MIRRORS</p>
            <h3>Automatically follows this {label(variant.platform)} post</h3>
            <p>
              John and Royal can use the same approved creative on their
              personal accounts. These mirrors do not require a separate
              approval decision.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setPreviewVariant(variant);
                setSlide(0);
              }}
            >
              <ArrowLeft size={16} />
              Back to PLIRIS preview
            </Button>
            <div className="personal-preview-list">
              {personalVariants.map((personal) => (
                <button
                  className={`personal-preview-item ${
                    previewVariant.id === personal.id ? "selected" : ""
                  }`}
                  key={personal.id}
                  aria-pressed={previewVariant.id === personal.id}
                  onClick={() => {
                    setPreviewVariant(personal);
                    setSlide(0);
                  }}
                >
                  <div>
                    <strong>{personal.publishingAccountName}</strong>
                    <small>
                      {label(personal.contentFormat)} · Follows PLIRIS
                    </small>
                  </div>
                  <span className="sync-state">Auto-synced</span>
                </button>
              ))}
            </div>
          </section>
        ) : tab === "Script" ? (
          <section className="script-panel">
            <p className="eyebrow">FINAL PRODUCTION REFERENCE</p>
            <h3>{version.headline || item.title}</h3>
            {version.script ? (
              <pre>{version.script}</pre>
            ) : (
              <p>No final script or transcript was attached to this version.</p>
            )}
            {version.chapters && (
              <>
                <h3>Chapters and timestamps</h3>
                <pre>{version.chapters}</pre>
              </>
            )}
            {version.tags && (
              <>
                <h3>Tags and publishing notes</h3>
                <pre>{version.tags}</pre>
              </>
            )}
          </section>
        ) : tab === "Review" ? (
          <>
            <dl className="details">
              {variant.wcsContentId && (
                <div>
                  <dt>WCS Content ID</dt>
                  <dd>{variant.wcsContentId}</dd>
                </div>
              )}
              <div>
                <dt>Planned for (UTC)</dt>
                <dd>
                  {new Date(variant.plannedPublishAt).toLocaleString("en-US", {
                    timeZone: "UTC",
                  })}
                </dd>
              </div>
              <div>
                <dt>Publishing</dt>
                <dd>{label(variant.publishingStatus)}</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>{label(variant.contentFormat)}</dd>
              </div>
              {isVideo && version.video && (
                <div>
                  <dt>Video</dt>
                  <dd>
                    {version.video.width && version.video.height
                      ? `${version.video.width}×${version.video.height}`
                      : "Dimensions pending"}
                    {version.video.durationMs
                      ? ` · ${Math.round(version.video.durationMs / 1000)} seconds`
                      : ""}
                  </dd>
                </div>
              )}
              <div>
                <dt>Upload account</dt>
                <dd>
                  {variant.publishingAccount === "PERSONAL"
                    ? "Personal · "
                    : "PLIRIS · "}
                  {variant.publishingAccountName}
                </dd>
              </div>
              {version.ctaText && (
                <div>
                  <dt>Call to action</dt>
                  <dd>{version.ctaText}</dd>
                </div>
              )}
              {version.ctaUrl && (
                <div>
                  <dt>Destination</dt>
                  <dd>
                    <a
                      href={version.ctaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {version.ctaUrl}
                      <ExternalLink size={14} />
                    </a>
                  </dd>
                </div>
              )}
              {publishedRecord?.publishedUrl && (
                <div>
                  <dt>Published post</dt>
                  <dd>
                    <a
                      href={publishedRecord.publishedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {publishedRecord.publishedUrl}
                      <ExternalLink size={14} />
                    </a>
                  </dd>
                </div>
              )}
            </dl>
            {decision && (
              <div className="decision-receipt">
                <strong>
                  {label(decision.decision.decision)} by {decision.reviewer}
                </strong>
                <small>
                  Version {version.versionNumber} ·{" "}
                  {new Date(decision.decision.createdAt).toLocaleString()}
                </small>
                {decision.decision.reason && <p>{decision.decision.reason}</p>}
              </div>
            )}
            {current &&
              reviewer &&
              variant.publishingAccount === "PLIRIS" &&
              variant.reviewStatus === "READY_FOR_REVIEW" && (
                <section className="review-actions">
                  <h3>Your decision</h3>
                  <p>
                    You’re reviewing version {version.versionNumber} of this{" "}
                    {label(variant.platform)} adaptation.
                  </p>
                  <label>
                    Feedback
                    <textarea
                      rows={4}
                      placeholder="Required for a revision or rejection…"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      maxLength={4000}
                    />
                  </label>
                  <Button
                    className="full"
                    disabled={busy}
                    onClick={() =>
                      action("approve", {
                        expectedVersionId: version.id,
                        reason: feedback,
                      })
                    }
                  >
                    <Check size={18} />
                    Approve version {version.versionNumber}
                  </Button>
                  <div className="form-grid">
                    <Button
                      variant="outline"
                      disabled={busy || !feedback.trim()}
                      onClick={() =>
                        action("request-revision", {
                          expectedVersionId: version.id,
                          reason: feedback,
                        })
                      }
                    >
                      Request revision
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={busy || !feedback.trim()}
                      onClick={() =>
                        action("reject", {
                          expectedVersionId: version.id,
                          reason: feedback,
                        })
                      }
                    >
                      Reject
                    </Button>
                  </div>
                  <small>
                    Approval does not schedule or publish this content.
                  </small>
                </section>
              )}
            {current && !reviewer && variant.publishingAccount === "PLIRIS" && (
              <section className="review-actions">
                <h3>Production actions</h3>
                <Button variant="outline" className="full" onClick={onEdit}>
                  Edit / create new version
                </Button>
                {["DRAFT", "IN_PRODUCTION"].includes(variant.reviewStatus) && (
                  <Button
                    className="full"
                    disabled={busy}
                    onClick={() =>
                      action("submit-review", { expectedVersionId: version.id })
                    }
                  >
                    Submit for review
                  </Button>
                )}
                {variant.reviewStatus === "APPROVED" &&
                  variant.publishingStatus !== "PUBLISHED" && (
                    <Button
                      className="full"
                      variant="outline"
                      onClick={() => setPublishing(true)}
                    >
                      {variant.publishingStatus === "SCHEDULED"
                        ? "Record publication"
                        : "Record scheduling / publication"}
                    </Button>
                  )}
                {variant.publishingStatus === "PUBLISHED" && (
                  <small>
                    This version is already recorded as published. Find it in
                    Published or review its publication history.
                  </small>
                )}
                <small>
                  Editing reviewed content creates a new version and resets its
                  current approval.
                </small>
              </section>
            )}
            {current && variant.publishingAccount === "PERSONAL" && (
              <section className="review-actions">
                <h3>Personal mirror</h3>
                <p>
                  This post follows the approved PLIRIS adaptation and does not
                  require a separate review decision.
                </p>
              </section>
            )}
            <section className="comment-thread">
              <h3>Comments on version {version.versionNumber}</h3>
              {history?.comments
                .filter((c) => c.comment.versionId === version.id)
                .map((c) => (
                  <div className="comment" key={c.comment.id}>
                    <strong>{c.author}</strong>
                    <small>
                      {new Date(c.comment.createdAt).toLocaleString()}
                    </small>
                    <p>{c.comment.body}</p>
                  </div>
                ))}
              <label className="sr-only" htmlFor="comment">
                Add a comment
              </label>
              <textarea
                id="comment"
                placeholder="Add a comment…"
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={4000}
              />
              <Button
                variant="ghost"
                disabled={busy || !comment.trim()}
                onClick={() =>
                  action("comments", { versionId: version.id, body: comment })
                }
              >
                Add comment
              </Button>
            </section>
          </>
        ) : (
          <section className="history">
            <label>
              View an exact version
              <select
                value={versionId}
                onChange={(e) => {
                  setVersionId(e.target.value);
                  setSlide(0);
                }}
              >
                {(history?.versions || [variant.version]).map((v) => (
                  <option key={v.id} value={v.id}>
                    Version {v.versionNumber}
                    {v.id === variant.currentVersionId ? " — Current" : ""}
                  </option>
                ))}
              </select>
            </label>
            {!current && (
              <Button
                variant="outline"
                onClick={() => {
                  setVersionId(variant.currentVersionId);
                  setSlide(0);
                }}
              >
                Return to current version
              </Button>
            )}
            {history?.decisions.map((d) => (
              <div key={d.decision.id} className="history-event">
                <Status value={d.decision.decision} />
                <p>
                  <strong>{d.reviewer}</strong> · Version{" "}
                  {
                    history.versions.find((v) => v.id === d.decision.versionId)
                      ?.versionNumber
                  }
                </p>
                {d.decision.reason && (
                  <blockquote>{d.decision.reason}</blockquote>
                )}
                <small>{new Date(d.decision.createdAt).toLocaleString()}</small>
              </div>
            ))}
            <h3>Activity</h3>
            {history?.events
              .slice()
              .reverse()
              .map((e) => (
                <div className="timeline-event" key={e.event.id}>
                  <strong>{label(e.event.action)}</strong>
                  <small>
                    {e.actor} · {new Date(e.event.createdAt).toLocaleString()}
                  </small>
                </div>
              ))}
            {history?.publishing
              .filter((p) => p.status === "PUBLISHED")
              .map((p) => (
                <p key={p.id}>
                  <a
                    href={p.publishedUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View recorded published post <ExternalLink size={14} />
                  </a>
                </p>
              ))}
          </section>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="success">
            {message}
          </p>
        )}
      </div>
      <Dialog open={enlarged} onOpenChange={setEnlarged}>
        <DialogContent className="image-dialog">
          <DialogTitle>Slide {slide + 1}</DialogTitle>
          <DialogDescription>{previewMedia?.altText}</DialogDescription>
          {previewMedia && (
            <img
              src={`/api/media/${previewMedia.id}`}
              alt={previewMedia.altText}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={publishing} onOpenChange={setPublishing}>
        <DialogContent>
          <DialogTitle>Record an external action</DialogTitle>
          <DialogDescription>
            This records what you have done elsewhere. It does not publish or
            schedule anything.
          </DialogDescription>
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const status = f.get("status");
              const at = String(f.get("at") || "");
              await action("publishing", {
                expectedVersionId: variant.currentVersionId,
                status,
                ...(status === "SCHEDULED"
                  ? { scheduledAt: new Date(at + "Z").toISOString() }
                  : {}),
                ...(status === "PUBLISHED"
                  ? {
                      publishedAt: new Date(at + "Z").toISOString(),
                      publishedUrl: f.get("url"),
                    }
                  : {}),
              });
              setPublishing(false);
            }}
          >
            <label>
              State
              <select name="status">
                <option value="READY_TO_SCHEDULE">Ready to schedule</option>
                <option value="SCHEDULED">Scheduled externally</option>
                <option value="PUBLISHED">Published externally</option>
                <option value="UNSCHEDULED">Unscheduled</option>
              </select>
            </label>
            <label>
              Scheduled / published time (UTC)
              <input name="at" type="datetime-local" required />
            </label>
            <label>
              Published post URL
              <input name="url" type="url" placeholder="https://…" />
            </label>
            <Button disabled={busy}>Save manual record</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function ArrowUpRightIcon() {
  return <ExternalLink size={16} />;
}
