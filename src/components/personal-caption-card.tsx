"use client";
import { useEffect, useState } from "react";
import { Copy, Eye, Sparkles, Check } from "lucide-react";
import { api, type Variant, type History } from "./types";
import { Button } from "./ui/button";
import { buildChatGptCaptionPrompt } from "@/lib/personal-caption-prompt";

export function PersonalCaptionCard({
  personal,
  source,
  title,
  editable,
  aiAvailable,
  onPreview,
  refresh,
}: {
  personal: Variant;
  source: Variant;
  title: string;
  editable: boolean;
  aiAvailable: boolean;
  onPreview: (variant: Variant) => void;
  refresh: () => Promise<void>;
}) {
  const initialCaption =
    !personal.personalSourceVersionId && !personal.personalCaptionEdited
      ? ""
      : personal.version.caption;
  const [caption, setCaption] = useState(initialCaption);
  const [dirty, setDirty] = useState(false);
  const [baseVersion, setBaseVersion] = useState(personal.currentVersionId);
  const [baseSource, setBaseSource] = useState(source.currentVersionId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [replace, setReplace] = useState(false);
  const [history, setHistory] = useState<History | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [promptFeedback, setPromptFeedback] = useState<{
    prompt: string;
    status: "copied" | "failed";
  } | null>(null);
  const chatGptPrompt = buildChatGptCaptionPrompt({
    accountName: personal.publishingAccountName,
    platform: personal.platform,
    title: source.version.headline || title,
    caption: source.version.caption,
  });
  // Feedback applies only to the source that was actually copied.
  const promptStatus =
    promptFeedback?.prompt === chatGptPrompt ? promptFeedback?.status : null;
  useEffect(() => {
    if (!dirty) {
      setCaption(initialCaption);
      setBaseVersion(personal.currentVersionId);
      setBaseSource(source.currentVersionId);
    }
  }, [
    initialCaption,
    personal.currentVersionId,
    source.currentVersionId,
    dirty,
  ]);
  const changed =
    dirty &&
    (baseVersion !== personal.currentVersionId ||
      baseSource !== source.currentVersionId);
  const outdated =
    personal.personalCaptionStatus === "OUTDATED" ||
    (!!personal.personalSourceVersionId &&
      personal.personalSourceVersionId !== source.currentVersionId);
  const generating =
    personal.personalCaptionStatus === "GENERATING" && !outdated;
  const status = outdated
    ? "Source changed"
    : personal.personalCaptionStatus === "READY"
      ? "Ready"
      : generating
        ? "Generating…"
        : personal.personalCaptionStatus === "NOT_GENERATED"
          ? "Needs a caption"
          : personal.personalCaptionStatus === "FAILED"
            ? "Generation failed"
            : "Needs review";
  async function save(ready: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`platform-variants/${personal.id}/personal-caption`, "POST", {
        expectedVersionId: baseVersion,
        expectedSourceVersionId: baseSource,
        caption,
        ready,
      });
      setDirty(false);
      await refresh();
      setMessage(ready ? "Caption marked ready." : "Draft saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    setBusy(true);
    setError("");
    setMessage("");
    setReplace(false);
    try {
      await api(`platform-variants/${personal.id}/generate-caption`, "POST", {
        expectedVersionId: personal.currentVersionId,
        expectedSourceVersionId: source.currentVersionId,
      });
      setDirty(false);
      await refresh();
      setMessage("New AI draft saved. Review it before marking ready.");
    } catch (e) {
      setError((e as Error).message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  const creative = source.version.thumbnail || source.version.media[0];
  return (
    <article className="personal-caption-card">
      <header>
        <strong>{personal.publishingAccountName}</strong>
        <span className="sync-state">{dirty ? "Unsaved changes" : status}</span>
      </header>
      {creative && (
        <img
          className="personal-caption-thumb"
          src={`/api/media/${creative.id}?thumb=1`}
          alt={creative.altText}
        />
      )}
      {outdated && (
        <p className="personal-caption-notice">
          The PLIRIS post changed. Your caption was kept. Review it against the
          updated post, then save or mark ready.
        </p>
      )}
      {generating && (
        <p className="personal-caption-notice">
          Preparing this caption. If it takes too long, retry generation.
        </p>
      )}
      <label>
        Short personal caption
        <textarea
          aria-label={`${personal.publishingAccountName} caption`}
          rows={5}
          maxLength={1200}
          value={caption}
          readOnly={!editable}
          disabled={busy}
          placeholder="Generate a draft or write a short personal take on this post."
          onChange={(e) => {
            setCaption(e.target.value);
            setDirty(true);
            setReplace(false);
            setMessage("");
          }}
        />
      </label>
      <small>{caption.length}/1200 characters · Same PLIRIS creative</small>
      {editable && (
        <section
          className="personal-caption-chatgpt"
          aria-label={`${personal.publishingAccountName} ChatGPT drafting`}
        >
          <strong>Draft with your ChatGPT account</strong>
          <p className="personal-caption-notice">
            Copy the prompt and paste it into ChatGPT. Paste the finished
            caption into the field above, save the draft, then review it before
            marking ready. This does not use the Hub’s AI Gateway.
          </p>
          <div className="personal-caption-actions">
            <Button
              type="button"
              variant="outline"
              disabled={!chatGptPrompt}
              onClick={async () => {
                if (!chatGptPrompt) return;
                setPromptFeedback(null);
                try {
                  await navigator.clipboard.writeText(chatGptPrompt);
                  setPromptFeedback({
                    prompt: chatGptPrompt,
                    status: "copied",
                  });
                } catch {
                  setPromptFeedback({
                    prompt: chatGptPrompt,
                    status: "failed",
                  });
                }
              }}
            >
              <Copy size={15} /> Copy ChatGPT prompt
            </Button>
            <Button asChild variant="outline">
              <a
                href="https://chatgpt.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open ChatGPT
              </a>
            </Button>
          </div>
          {!chatGptPrompt && (
            <p className="personal-caption-notice">
              A PLIRIS source caption and a configured account voice are needed
              to prepare this prompt.
            </p>
          )}
          {promptStatus === "copied" && (
            <p className="personal-caption-notice" role="status">
              Prompt copied. Paste it into ChatGPT to generate your draft.
            </p>
          )}
          {promptStatus === "failed" && (
            <>
              <p className="personal-caption-notice" role="alert">
                Clipboard access was blocked. Select and copy the prompt below.
              </p>
              <label>
                ChatGPT prompt — copy manually
                <textarea
                  aria-label={`${personal.publishingAccountName} ChatGPT prompt`}
                  rows={8}
                  readOnly
                  value={chatGptPrompt || ""}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </label>
            </>
          )}
        </section>
      )}
      {changed && (
        <p role="alert">
          This post changed while you were editing. Copy your draft, then reopen
          the post before saving.
        </p>
      )}
      <div className="personal-caption-actions">
        <Button
          variant="outline"
          disabled={!caption.trim()}
          onClick={() =>
            onPreview({
              ...personal,
              version: {
                ...source.version,
                ...personal.version,
                caption,
                media: source.version.media,
                video: source.version.video,
                thumbnail: source.version.thumbnail,
                ctaText: "",
                ctaUrl: "",
              },
            })
          }
        >
          <Eye size={15} /> Preview
        </Button>
        <Button
          variant="outline"
          disabled={!caption.trim()}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(caption);
              setMessage("Caption copied.");
            } catch {
              setError(
                "Could not copy automatically. Select and copy the caption above.",
              );
            }
          }}
        >
          <Copy size={15} /> Copy caption
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            if (showHistory) {
              setShowHistory(false);
              return;
            }
            try {
              setHistory(
                await api<History>(`platform-variants/${personal.id}/history`),
              );
              setShowHistory(true);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          History
        </Button>
        {editable && (
          <>
            <Button
              variant="outline"
              disabled={busy || changed || !caption.trim()}
              onClick={() => save(false)}
            >
              Save draft
            </Button>
            <Button
              disabled={busy || changed || !caption.trim()}
              onClick={() => save(true)}
            >
              <Check size={15} /> Mark ready
            </Button>
            <Button
              variant="outline"
              disabled={busy || !aiAvailable}
              onClick={() => {
                if (dirty || personal.personalCaptionEdited || caption.trim())
                  setReplace(true);
                else void generate();
              }}
            >
              <Sparkles size={15} />
              {busy
                ? "Working…"
                : caption.trim()
                  ? "Regenerate"
                  : "Generate caption"}
            </Button>
          </>
        )}
      </div>
      {replace && (
        <div className="personal-caption-notice">
          <p>
            Replace this caption with a new AI draft? Saved versions remain in
            history.
          </p>
          <Button disabled={busy} onClick={() => void generate()}>
            Replace with AI draft
          </Button>{" "}
          <Button variant="outline" onClick={() => setReplace(false)}>
            Keep caption
          </Button>
        </div>
      )}
      {!aiAvailable && editable && (
        <p className="personal-caption-notice">
          Built-in AI generation needs configuration. You can use the ChatGPT
          prompt above or write, save, and copy captions now.
        </p>
      )}
      {showHistory && history && (
        <section
          className="personal-caption-history"
          aria-label={`${personal.publishingAccountName} caption history`}
        >
          <h4>Saved captions</h4>
          {history.versions
            .slice()
            .reverse()
            .map((version) => (
              <div key={version.id}>
                <strong>Version {version.versionNumber}</strong>
                <p>{version.caption}</p>
              </div>
            ))}
          {!!history.generations.length && (
            <>
              <h4>AI drafts</h4>
              {history.generations
                .slice()
                .reverse()
                .map((generation) => (
                  <div key={generation.id}>
                    <strong>
                      {generation.status} · {generation.model}
                    </strong>
                    {generation.result && <p>{generation.result}</p>}
                  </div>
                ))}
            </>
          )}
        </section>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
    </article>
  );
}
