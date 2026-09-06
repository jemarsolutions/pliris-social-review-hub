"use client";
import { useState } from "react";
import {
  LayoutDashboard,
  Inbox,
  CalendarDays,
  CheckCheck,
  RotateCcw,
  Archive,
  Plus,
  LogOut,
  Trash2,
  ArrowUpRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Camera,
  MessageSquare,
  BriefcaseBusiness,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { api, type HubData, type Item, type Variant } from "./types";
import { Review } from "./review";
import { Editor } from "./producer";
const nav = [
  ["Dashboard", LayoutDashboard],
  ["Review queue", Inbox],
  ["Calendar", CalendarDays],
  ["Approved", CheckCheck],
  ["Revisions", RotateCcw],
  ["Archive", Archive],
] as const;
export const label = (v: string) =>
  v
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (v) => v.toUpperCase());
export function Status({ value }: { value: string }) {
  return (
    <span className={`status status-${value.toLowerCase()}`}>
      {label(value)}
    </span>
  );
}
export function Platform({ value }: { value: string }) {
  const Icon =
    value === "INSTAGRAM"
      ? Camera
      : value === "FACEBOOK"
        ? MessageSquare
        : BriefcaseBusiness;
  return (
    <span className={`platform platform-${value.toLowerCase()}`}>
      <Icon size={15} />
      {label(value)}
    </span>
  );
}
export function formatDate(date: string, full = false) {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: full ? "long" : "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
export function Hub({
  initial,
  user,
  localDemo,
}: {
  initial: HubData;
  user: { id: string; name: string; role: string };
  localDemo: boolean;
}) {
  const [data, setData] = useState(initial),
    [view, setView] = useState("Dashboard"),
    [selected, setSelected] = useState<{ item: Item; variant: Variant } | null>(
      null,
    ),
    [editing, setEditing] = useState<{ item: Item; variant?: Variant } | null>(
      null,
    ),
    [creating, setCreating] = useState(false),
    [metadataItem, setMetadataItem] = useState<Item | null>(null),
    [platform, setPlatform] = useState("ALL"),
    [date, setDate] = useState(""),
    [query, setQuery] = useState(""),
    [weekOffset, setWeekOffset] = useState(0),
    [error, setError] = useState("");
  const producer = user.role !== "REVIEWER";
  async function refresh() {
    const fresh = await api<HubData>("dashboard");
    setData(fresh);
    if (selected) {
      const item = fresh.items.find((i) => i.id === selected.item.id);
      const variant = item?.variants.find((v) => v.id === selected.variant.id);
      if (item && variant) setSelected({ item, variant });
    }
  }
  const all = data.items.flatMap((item) =>
    item.variants.map((variant) => ({ item, variant })),
  );
  const filtered = all.filter(
    ({ item, variant: v }) =>
      (platform === "ALL" || v.platform === platform) &&
      (!date || v.plannedPublishAt.slice(0, 10) === date) &&
      (!query ||
        `${item.title} ${v.version.caption}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const visible = filtered.filter(({ variant: v }) =>
    view === "Dashboard" || view === "Review queue"
      ? v.reviewStatus === "READY_FOR_REVIEW"
      : view === "Approved"
        ? v.reviewStatus === "APPROVED"
        : view === "Revisions"
          ? v.reviewStatus === "CHANGES_REQUESTED"
          : view === "Archive"
            ? v.publishingStatus === "PUBLISHED"
            : true,
  );
  const monday = new Date();
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(
    monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) + weekOffset * 7,
  );
  const days = Array.from(
    { length: 7 },
    (_, i) => new Date(monday.getTime() + i * 86400000),
  );
  const open = (item: Item, variant: Variant) => setSelected({ item, variant });
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="wordmark">
          PLIRIS<span>SOCIAL REVIEW HUB</span>
        </div>
        <div className="workspace-label">CONTENT WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              className={view === name ? "nav active" : "nav"}
              onClick={() => {
                setView(name);
                setDate("");
                setQuery("");
                setPlatform("ALL");
              }}
            >
              <Icon size={19} />
              <span>{name}</span>
              {name === "Review queue" && data.counts.review > 0 && (
                <b>{data.counts.review}</b>
              )}
            </button>
          ))}
          {producer && (
            <button
              className={view === "Content" ? "nav active" : "nav"}
              onClick={() => setView("Content")}
            >
              <SlidersHorizontal size={19} />
              Content studio
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="avatar">
            {user.name
              .split(" ")
              .map((s) => s[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div>
            <strong>{user.name}</strong>
            <small>{label(user.role)}</small>
          </div>
          <button
            aria-label="Sign out"
            onClick={async () => {
              await fetch("/api/auth/sign-out", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
              });
              location.href = "/login";
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <span>
            PLIRIS Co <span className="divider">/</span> {view}
          </span>
          <span className="private-label">
            {localDemo ? "LOCAL DEMO · SAMPLE CONTENT" : "PRIVATE WORKSPACE"}
          </span>
        </header>
        <div className="main-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {view === "Dashboard" ? "THE WEEK AHEAD" : "SOCIAL CONTENT"}
              </p>
              <h1>
                {view === "Dashboard"
                  ? `Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}, ${user.name.split(" ")[0]}.`
                  : view === "Review queue"
                    ? "Needs your review"
                    : view === "Content"
                      ? "Content studio"
                      : view}
              </h1>
              <p>
                {view === "Dashboard"
                  ? "Your next decisions, all in one place."
                  : view === "Review queue"
                    ? "Review each platform adaptation and its current version."
                    : view === "Approved"
                      ? "Approved current versions. Scheduling and publishing are recorded separately."
                      : view === "Revisions"
                        ? "Feedback to carry into the next version."
                        : view === "Calendar"
                          ? "A week of content, with every platform accounted for."
                          : view === "Archive"
                            ? "Manually recorded published content."
                            : "Create content ideas and their platform adaptations."}
              </p>
            </div>
            {producer && (
              <Button onClick={() => setCreating(true)}>
                <Plus size={18} />
                Create content
              </Button>
            )}
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {view === "Dashboard" && (
            <>
              <div className="metrics">
                {[
                  ["Needs your review", data.counts.review, "Review queue"],
                  ["Changes requested", data.counts.revisions, "Revisions"],
                  ["Approved", data.counts.approved, "Approved"],
                ].map(([name, count, target]) => (
                  <button
                    className="metric"
                    key={String(name)}
                    onClick={() => setView(String(target))}
                  >
                    <span>{name}</span>
                    <strong>{count}</strong>
                    <ArrowUpRight size={20} />
                  </button>
                ))}
              </div>
              <section className="coverage">
                <div>
                  <p className="eyebrow">NEXT 7 DAYS APPROVAL COVERAGE</p>
                  <h2>
                    {data.coverage.approved}{" "}
                    <span>of {data.coverage.total} adaptations approved</span>
                  </h2>
                  <div
                    className="progress"
                    role="progressbar"
                    aria-label="Approval coverage"
                    aria-valuenow={data.coverage.percentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <i style={{ width: `${data.coverage.percentage}%` }} />
                  </div>
                  <p>
                    {data.coverage.earliestUnapproved
                      ? `Next awaiting approval: ${formatDate(data.coverage.earliestUnapproved.plannedPublishAt)} · ${data.coverage.earliestUnapproved.title}`
                      : "No upcoming unapproved content in this window."}
                  </p>
                </div>
                <strong className="coverage-percent">
                  {data.coverage.total ? `${data.coverage.percentage}%` : "—"}
                </strong>
              </section>
            </>
          )}
          <div className="section-heading">
            <h2>
              {view === "Dashboard"
                ? "Start with these"
                : view === "Calendar"
                  ? `${formatDate(days[0].toISOString())} – ${formatDate(days[6].toISOString())}`
                  : view === "Content"
                    ? `${data.items.length} content ideas`
                    : `${visible.length} platform adaptations`}
            </h2>
            {view === "Dashboard" ? (
              <Button variant="ghost" onClick={() => setView("Review queue")}>
                View review queue <ArrowRight size={16} />
              </Button>
            ) : (
              view === "Calendar" && (
                <div className="actions">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Previous week"
                    onClick={() => setWeekOffset((v) => v - 1)}
                  >
                    <ChevronLeft size={18} />
                  </Button>
                  <Button variant="outline" onClick={() => setWeekOffset(0)}>
                    This week
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Next week"
                    onClick={() => setWeekOffset((v) => v + 1)}
                  >
                    <ChevronRight size={18} />
                  </Button>
                </div>
              )
            )}
          </div>
          {view !== "Dashboard" && (
            <div className="filters">
              <label className="sr-only" htmlFor="search">
                Search content
              </label>
              <input
                id="search"
                placeholder="Search content…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <label className="sr-only" htmlFor="platform-filter">
                Platform
              </label>
              <select
                id="platform-filter"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                <option value="ALL">All platforms</option>
                {["INSTAGRAM", "FACEBOOK", "LINKEDIN"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              {view !== "Calendar" && (
                <>
                  <label className="sr-only" htmlFor="date-filter">
                    Planned date
                  </label>
                  <input
                    id="date-filter"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </>
              )}
              {(date || query || platform !== "ALL") && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDate("");
                    setQuery("");
                    setPlatform("ALL");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          )}
          {view === "Calendar" ? (
            <div className="calendar">
              {days.map((day) => {
                const dateKey = day.toISOString().slice(0, 10);
                return (
                  <section className="calendar-day" key={dateKey}>
                    <header>
                      <span>
                        {day.toLocaleDateString("en-US", {
                          weekday: "short",
                          timeZone: "UTC",
                        })}
                      </span>
                      <strong>{day.getUTCDate()}</strong>
                    </header>
                    {filtered
                      .filter(
                        ({ variant: v }) =>
                          v.plannedPublishAt.slice(0, 10) === dateKey,
                      )
                      .map(({ item, variant }) => (
                        <button
                          key={variant.id}
                          className="agenda-item"
                          onClick={() => open(item, variant)}
                        >
                          <Platform value={variant.platform} />
                          <strong>{item.title}</strong>
                          <Status value={variant.reviewStatus} />
                        </button>
                      ))}
                  </section>
                );
              })}
            </div>
          ) : view === "Content" ? (
            <div className="content-list">
              {data.items
                .filter(
                  (i) =>
                    !query ||
                    i.title.toLowerCase().includes(query.toLowerCase()),
                )
                .map((item) => (
                  <article className="content-item" key={item.id}>
                    <div>
                      <p className="eyebrow">
                        {item.internalReference} ·{" "}
                        {formatDate(item.contentDate)}
                      </p>
                      <h3>{item.title}</h3>
                      <p>{item.conceptSummary}</p>
                      <div className="actions">
                        {item.variants.map((v) => (
                          <Button
                            key={v.id}
                            variant="outline"
                            onClick={() => open(item, v)}
                          >
                            <Platform value={v.platform} />
                            <Status value={v.reviewStatus} />
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="actions">
                      <Button
                        variant="ghost"
                        onClick={() => setEditing({ item })}
                      >
                        <Plus size={16} />
                        Add platform
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setMetadataItem(item)}
                      >
                        Edit idea details
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={async () => {
                          if (
                            !window.confirm(
                              "Archive this content? It will disappear from active views while its saved history remains preserved.",
                            )
                          )
                            return;
                          try {
                            await api(`content/${item.id}`, "DELETE");
                            await refresh();
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        <Trash2 size={16} />
                        Delete content
                      </Button>
                    </div>
                  </article>
                ))}
            </div>
          ) : (
            <div className="review-grid">
              {(view === "Dashboard" ? visible.slice(0, 6) : visible).map(
                ({ item, variant: v }) => (
                  <button
                    className="review-card"
                    key={v.id}
                    onClick={() => open(item, v)}
                  >
                    <div className="card-media">
                      {v.version.media[0] ? (
                        <img
                          src={`/api/media/${v.version.media[0].id}?thumb=1`}
                          alt={v.version.media[0].altText}
                          loading="lazy"
                        />
                      ) : (
                        <span>No media yet</span>
                      )}
                      <span className="media-count">
                        {v.version.media.length > 1
                          ? `${v.version.media.length} slides`
                          : "Single image"}
                      </span>
                    </div>
                    <div className="card-content">
                      <div className="card-meta">
                        <Platform value={v.platform} />
                        <small>v{v.version.versionNumber}</small>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{formatDate(v.plannedPublishAt, true)}</p>
                      <div className="card-footer">
                        <Status value={v.reviewStatus} />
                        <ArrowUpRight size={18} />
                      </div>
                    </div>
                  </button>
                ),
              )}
            </div>
          )}
          {!visible.length && !["Content", "Calendar"].includes(view) && (
            <div className="empty">
              <CheckCheck size={32} />
              <h3>
                {view === "Review queue" || view === "Dashboard"
                  ? "You’re all caught up."
                  : "No content here yet."}
              </h3>
              <p>Content matching this view will appear here.</p>
            </div>
          )}
          <footer className="workspace-footer">
            PLIRIS Social Review Hub{" "}
            <span>
              All dates shown in UTC · Approval never publishes content
            </span>
          </footer>
        </div>
      </main>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="review-dialog">
          <DialogTitle className="sr-only">
            {selected?.item.title || "Review content"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Inspect this exact platform version, review its history, and record
            a decision.
          </DialogDescription>
          {selected && (
            <Review
              key={selected.variant.id}
              item={selected.item}
              variant={selected.variant}
              reviewer={!producer}
              refresh={refresh}
              onEdit={() => {
                setEditing(selected);
                setSelected(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogTitle>Create a content idea</DialogTitle>
          <DialogDescription>
            Add the idea first, then create its platform adaptations.
          </DialogDescription>
          <ContentForm
            onDone={async (item) => {
              setCreating(false);
              await refresh();
              setEditing({ item });
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!metadataItem}
        onOpenChange={(v) => !v && setMetadataItem(null)}
      >
        <DialogContent>
          <DialogTitle>Edit idea details</DialogTitle>
          <DialogDescription>
            Title, reference and date describe the content idea. Platform
            payloads are versioned separately.
          </DialogDescription>
          {metadataItem && (
            <ContentForm
              item={metadataItem}
              onDone={async () => {
                setMetadataItem(null);
                await refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="editor-dialog">
          <DialogTitle>
            {editing?.variant
              ? "Create a revised version"
              : "Add a platform adaptation"}
          </DialogTitle>
          <DialogDescription>{editing?.item.title}</DialogDescription>
          {editing && (
            <Editor
              key={editing.variant?.id || editing.item.id}
              item={editing.item}
              variant={editing.variant}
              onDone={async () => {
                setEditing(null);
                await refresh();
                setView("Content");
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function ContentForm({
  onDone,
  item,
}: {
  onDone: (item: Item) => Promise<void>;
  item?: Item;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const data = Object.fromEntries(new FormData(e.currentTarget));
        try {
          await onDone({
            ...(await api<Item>(
              item ? `content/${item.id}` : "content",
              item ? "PATCH" : "POST",
              data,
            )),
            variants: item?.variants || [],
          });
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Title
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={item?.title}
        />
      </label>
      <div className="form-grid">
        <label>
          Internal reference
          <input
            name="internalReference"
            required
            maxLength={100}
            placeholder="e.g. DEMO-006"
            defaultValue={item?.internalReference}
          />
        </label>
        <label>
          Content date (UTC)
          <input
            name="contentDate"
            type="date"
            required
            defaultValue={
              item?.contentDate || new Date().toISOString().slice(0, 10)
            }
          />
        </label>
      </div>
      <label>
        Campaign
        <input name="campaign" maxLength={200} defaultValue={item?.campaign} />
      </label>
      <label>
        Concept summary
        <textarea
          name="conceptSummary"
          rows={3}
          maxLength={4000}
          defaultValue={item?.conceptSummary}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <Button disabled={busy}>
        {busy
          ? "Saving…"
          : item
            ? "Save idea details"
            : "Create idea & add platform"}
      </Button>
    </form>
  );
}
