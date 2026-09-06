import { beforeAll, describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql, eq } from "drizzle-orm";
import { coverage } from "../src/lib/domain";
process.env.LOCAL_DEMO = "1";
process.env.LOCAL_DB_PATH = join(
  mkdtempSync(join(tmpdir(), "pliris-test-")),
  "db",
);
delete process.env.DATABASE_URL;
process.env.AUTH_SECRET = crypto.randomUUID() + crypto.randomUUID();
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
const { getDb } = await import("../src/db/index");
const s = await import("../src/db/schema");
const { createUser } = await import("../scripts/create-user");
const { getAuth } = await import("../src/lib/auth");
const routes = await import("../src/app/api/v1/[...path]/route");
const mediaRoute = await import("../src/app/api/media/[id]/route");
let adminCookie = "",
  johnCookie = "",
  producerCookie = "";
const password = "Test-Only-Strong-" + crypto.randomUUID();
const state: {
  itemId: string;
  ids: Record<string, string>;
  versions: Record<string, string>;
  media: string[];
} = { itemId: "", ids: {}, versions: {}, media: [] };
async function login(email: string) {
  const res = await getAuth().handler(
    new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({ email, password }),
    }),
  );
  expect(res.status).toBe(200);
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  cookie = adminCookie,
  extra: Record<string, string> = {},
) {
  const req = new Request("http://localhost:3000/api/v1/" + path, {
    method,
    headers: {
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      Cookie: cookie,
      Origin: "http://localhost:3000",
      ...extra,
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const res = await routes[method as "GET" | "POST" | "PATCH"](req, {
    params: Promise.resolve({ path: path.split("/") }),
  });
  return { status: res.status, ...(await res.json()) };
}
beforeAll(async () => {
  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  );
  for (const entry of journal.entries) {
    for (const statement of readFileSync(
      `drizzle/${entry.tag}.sql`,
      "utf8",
    ).split("--> statement-breakpoint"))
      if (statement.trim()) await getDb().execute(sql.raw(statement));
  }
  await createUser("Mac", "mac@test.local", "ADMIN", password);
  await createUser("John", "john@test.local", "REVIEWER", password);
  await createUser("Producer", "producer@test.local", "PRODUCER", password);
  adminCookie = await login("mac@test.local");
  johnCookie = await login("john@test.local");
  producerCookie = await login("producer@test.local");
});
describe("Required three-platform workflow through authenticated API", () => {
  it("Mac creates Monday Educational Content and uploads carousel images", async () => {
    const item = await call("content", "POST", {
      title: "Monday Educational Content",
      internalReference: "E2E-001",
      contentDate: "2026-09-07",
      campaign: "Test",
      conceptSummary: "Required workflow",
    });
    expect(item.status).toBe(201);
    state.itemId = item.data.id;
    for (let i = 1; i <= 2; i++) {
      const form = new FormData();
      form.set(
        "file",
        new File(
          [readFileSync(`fixtures/sample-${i}.png`)],
          `sample-${i}.png`,
          { type: "image/png" },
        ),
      );
      form.set("altText", `Test slide ${i}`);
      const upload = await call("media", "POST", form);
      expect(upload.status).toBe(201);
      state.media.push(upload.data.id);
    }
  });
  it("Mac creates and submits independent Instagram, Facebook and LinkedIn adaptations", async () => {
    for (const platform of ["INSTAGRAM", "FACEBOOK", "LINKEDIN"]) {
      const v = await call(
        `content/${state.itemId}/platform-variants`,
        "POST",
        {
          platform,
          plannedPublishAt: new Date(Date.now() + 86400000).toISOString(),
          caption: "Original caption for " + platform,
          ctaText: "Explore",
          ctaUrl: "https://example.com",
          mediaIds: platform === "INSTAGRAM" ? state.media : [state.media[0]],
        },
      );
      expect(v.status).toBe(201);
      state.ids[platform] = v.data.id;
      state.versions[platform] = v.data.currentVersionId;
      expect(
        (
          await call(`platform-variants/${v.data.id}/submit-review`, "POST", {
            expectedVersionId: v.data.currentVersionId,
          })
        ).status,
      ).toBe(201);
    }
    const queue = await call("review-queue", "GET", undefined, johnCookie);
    expect(queue.data).toHaveLength(3);
    expect(queue.data.map((v: { plannedPublishAt: string }) => v.plannedPublishAt)).toEqual(
      [...queue.data]
        .sort(
          (a: { plannedPublishAt: string }, b: { plannedPublishAt: string }) =>
            Date.parse(a.plannedPublishAt) - Date.parse(b.plannedPublishAt),
        )
        .map((v: { plannedPublishAt: string }) => v.plannedPublishAt),
    );
  });
  it("John approves exact Facebook/LinkedIn versions and requests Instagram revision", async () => {
    for (const p of ["FACEBOOK", "LINKEDIN"])
      expect(
        (
          await call(
            `platform-variants/${state.ids[p]}/approve`,
            "POST",
            { expectedVersionId: state.versions[p] },
            johnCookie,
          )
        ).status,
      ).toBe(201);
    const result = await call(
      `platform-variants/${state.ids.INSTAGRAM}/request-revision`,
      "POST",
      {
        expectedVersionId: state.versions.INSTAGRAM,
        reason:
          "Please revise the first slide and shorten the opening caption.",
      },
      johnCookie,
    );
    expect(result.status).toBe(201);
    const revisions = await call("revisions");
    expect(revisions.data).toHaveLength(1);
    expect(revisions.data[0].id).toBe(state.ids.INSTAGRAM);
  });
  it("Mac changes caption and carousel order; version 2 requires review, history survives", async () => {
    const updated = await call(
      `platform-variants/${state.ids.INSTAGRAM}`,
      "PATCH",
      {
        expectedVersionId: state.versions.INSTAGRAM,
        caption: "Short revised caption",
        ctaText: "Explore",
        ctaUrl: "https://example.com",
        mediaIds: [...state.media].reverse(),
      },
    );
    expect(updated.status).toBe(200);
    expect(updated.data.reviewStatus).toBe("READY_FOR_REVIEW");
    expect(updated.data.currentVersionId).not.toBe(state.versions.INSTAGRAM);
    const h = await call(`platform-variants/${state.ids.INSTAGRAM}/history`);
    expect(h.data.versions).toHaveLength(2);
    expect(h.data.versions[0].caption).toBe("Original caption for INSTAGRAM");
    expect(h.data.versions[0].media.map((m: { id: string }) => m.id)).toEqual(
      state.media,
    );
    expect(h.data.versions[1].media.map((m: { id: string }) => m.id)).toEqual(
      [...state.media].reverse(),
    );
    expect(h.data.decisions[0].decision.reason).toContain(
      "revise the first slide",
    );
    state.versions.INSTAGRAM = updated.data.currentVersionId;
    const items = await call("content");
    expect(
      items.data[0].variants
        .filter((v: { platform: string }) => v.platform !== "INSTAGRAM")
        .every((v: { reviewStatus: string }) => v.reviewStatus === "APPROVED"),
    ).toBe(true);
  });
  it("John approves Instagram v2; no scheduling or publishing occurs, calendar and coverage agree", async () => {
    expect(
      (
        await call(
          `platform-variants/${state.ids.INSTAGRAM}/approve`,
          "POST",
          { expectedVersionId: state.versions.INSTAGRAM },
          johnCookie,
        )
      ).status,
    ).toBe(201);
    const calendar = await call("calendar");
    expect(calendar.data).toHaveLength(3);
    expect(
      calendar.data.every(
        (v: { reviewStatus: string; publishingStatus: string }) =>
          v.reviewStatus === "APPROVED" && v.publishingStatus === "UNSCHEDULED",
      ),
    ).toBe(true);
    const c = await call("coverage");
    expect(c.data).toMatchObject({
      approved: 3,
      total: 3,
      percentage: 100,
      earliestUnapproved: null,
    });
    const h = await call(`platform-variants/${state.ids.INSTAGRAM}/history`);
    expect(
      h.data.decisions.find(
        (d: { decision: { decision: string } }) =>
          d.decision.decision === "APPROVED",
      ).decision.versionId,
    ).toBe(state.versions.INSTAGRAM);
    expect(h.data.publishing).toHaveLength(0);
  });
});
describe("Integrity and authorization", () => {
  it("Editing approved content invalidates approval without deleting the approved version", async () => {
    const previous = state.versions.INSTAGRAM;
    const result = await call(
      `platform-variants/${state.ids.INSTAGRAM}`,
      "PATCH",
      {
        expectedVersionId: previous,
        caption: "A third caption",
        ctaText: "Explore",
        ctaUrl: "https://example.com",
        mediaIds: state.media,
      },
    );
    expect(result.data.reviewStatus).toBe("READY_FOR_REVIEW");
    const h = await call(`platform-variants/${state.ids.INSTAGRAM}/history`);
    expect(h.data.versions).toHaveLength(3);
    expect(
      h.data.decisions.some(
        (d: { decision: { versionId: string; decision: string } }) =>
          d.decision.versionId === previous &&
          d.decision.decision === "APPROVED",
      ),
    ).toBe(true);
    state.versions.INSTAGRAM = result.data.currentVersionId;
    expect((await call("coverage")).data.percentage).toBe(67);
  });
  it("Empty revision/rejection reasons are rejected", async () => {
    for (const action of ["request-revision", "reject"]) {
      const r = await call(
        `platform-variants/${state.ids.INSTAGRAM}/${action}`,
        "POST",
        { expectedVersionId: state.versions.INSTAGRAM, reason: "   " },
        johnCookie,
      );
      expect(r.status).toBe(422);
    }
  });
  it("Stale approvals and stale edits are rejected", async () => {
    expect(
      (
        await call(
          `platform-variants/${state.ids.INSTAGRAM}/approve`,
          "POST",
          { expectedVersionId: "outdated" },
          johnCookie,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(`platform-variants/${state.ids.INSTAGRAM}`, "PATCH", {
          expectedVersionId: "outdated",
          caption: "Bad overwrite",
          ctaText: "",
          ctaUrl: "",
          mediaIds: state.media,
        })
      ).status,
    ).toBe(409);
  });
  it("Producer/admin cannot approve; reviewer cannot produce", async () => {
    for (const cookie of [adminCookie, producerCookie])
      expect(
        (
          await call(
            `platform-variants/${state.ids.INSTAGRAM}/approve`,
            "POST",
            { expectedVersionId: state.versions.INSTAGRAM },
            cookie,
          )
        ).status,
      ).toBe(403);
    expect(
      (
        await call(
          "content",
          "POST",
          {
            title: "Unauthorized",
            internalReference: "NO",
            contentDate: "2026-09-07",
          },
          johnCookie,
        )
      ).status,
    ).toBe(403);
  });
  it("Unauthenticated API and media calls fail; cross-origin writes fail", async () => {
    expect((await call("content", "GET", undefined, "")).status).toBe(401);
    expect(
      (
        await call(
          `platform-variants/${state.ids.INSTAGRAM}/approve`,
          "POST",
          { expectedVersionId: state.versions.INSTAGRAM },
          "",
        )
      ).status,
    ).toBe(401);
    const media = await mediaRoute.GET(
      new Request("http://localhost:3000/api/media/" + state.media[0]),
      { params: Promise.resolve({ id: state.media[0] }) },
    );
    expect(media.status).toBe(401);
    expect(
      (
        await call("content", "POST", {}, adminCookie, {
          Origin: "https://evil.example",
        })
      ).status,
    ).toBe(403);
  });
  it("Reject preserves reason and does not affect other platforms", async () => {
    const r = await call(
      `platform-variants/${state.ids.INSTAGRAM}/reject`,
      "POST",
      {
        expectedVersionId: state.versions.INSTAGRAM,
        reason: "This direction is unsuitable.",
      },
      johnCookie,
    );
    expect(r.status).toBe(201);
    const h = await call(`platform-variants/${state.ids.INSTAGRAM}/history`);
    expect(h.data.decisions.at(-1).decision.reason).toBe(
      "This direction is unsuitable.",
    );
    const items = await call("content");
    expect(
      items.data[0].variants
        .filter((v: { platform: string }) => v.platform !== "INSTAGRAM")
        .every((v: { reviewStatus: string }) => v.reviewStatus === "APPROVED"),
    ).toBe(true);
  });
  it("Unapproved publication, duplicate decisions and invalid links fail", async () => {
    expect(
      (
        await call(
          `platform-variants/${state.ids.INSTAGRAM}/publishing`,
          "POST",
          {
            expectedVersionId: state.versions.INSTAGRAM,
            status: "PUBLISHED",
            publishedAt: new Date().toISOString(),
            publishedUrl: "https://example.com/test",
          },
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          `platform-variants/${state.ids.FACEBOOK}/approve`,
          "POST",
          { expectedVersionId: state.versions.FACEBOOK },
          johnCookie,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(`platform-variants/${state.ids.FACEBOOK}`, "PATCH", {
          expectedVersionId: state.versions.FACEBOOK,
          caption: "Test",
          ctaText: "",
          ctaUrl: "javascript:alert(1)",
          mediaIds: state.media,
        })
      ).status,
    ).toBe(422);
  });
  it("Comment stays attached to a historical version", async () => {
    const h = await call(`platform-variants/${state.ids.INSTAGRAM}/history`);
    const v1 = h.data.versions[0].id;
    expect(
      (
        await call(
          `platform-variants/${state.ids.INSTAGRAM}/comments`,
          "POST",
          { versionId: v1, body: "This refers to the original first slide." },
          johnCookie,
        )
      ).status,
    ).toBe(201);
    expect(
      (await call(`platform-variants/${state.ids.INSTAGRAM}/history`)).data
        .comments[0].comment.versionId,
    ).toBe(v1);
  });
  it("Database rejects historical version and decision rewrites", async () => {
    await expect(
      getDb()
        .update(s.versions)
        .set({ caption: "Tampered" })
        .where(eq(s.versions.id, state.versions.FACEBOOK)),
    ).rejects.toThrow();
    await expect(
      getDb()
        .update(s.reviewDecisions)
        .set({ reason: "Tampered" })
        .where(eq(s.reviewDecisions.versionId, state.versions.FACEBOOK)),
    ).rejects.toThrow();
  });
  it("Coverage honors precise start/end boundaries and empty windows", () => {
    const now = new Date("2026-09-06T12:00:00Z");
    const rows = [
      { plannedPublishAt: "2026-09-06T11:59:59Z", reviewStatus: "APPROVED" },
      { plannedPublishAt: "2026-09-06T12:00:00Z", reviewStatus: "APPROVED" },
      {
        plannedPublishAt: "2026-09-13T11:59:59Z",
        reviewStatus: "READY_FOR_REVIEW",
      },
      { plannedPublishAt: "2026-09-13T12:00:00Z", reviewStatus: "APPROVED" },
    ];
    expect(coverage(rows, now)).toMatchObject({
      approved: 1,
      total: 2,
      percentage: 50,
    });
    expect(coverage([], now)).toMatchObject({
      approved: 0,
      total: 0,
      percentage: 0,
      earliestUnapproved: null,
    });
  });
  it("Integration key is producer-only and revocation rejects access", async () => {
    const [producer] = await getDb()
      .select()
      .from(s.user)
      .where(eq(s.user.email, "producer@test.local"));
    process.env.INTERNAL_API_USER_ID = producer.id;
    process.env.INTERNAL_API_KEY = crypto.randomUUID() + crypto.randomUUID();
    const header = { Authorization: "Bearer " + process.env.INTERNAL_API_KEY };
    expect((await call("content", "GET", undefined, "", header)).status).toBe(
      200,
    );
    expect(
      (
        await call(
          `platform-variants/${state.ids.FACEBOOK}/approve`,
          "POST",
          { expectedVersionId: state.versions.FACEBOOK },
          "",
          header,
        )
      ).status,
    ).toBe(403);
    delete process.env.INTERNAL_API_KEY;
    expect((await call("content", "GET", undefined, "", header)).status).toBe(
      401,
    );
  });
  it("Competing decisions accept only one result for the current version", async () => {
    const edited = await call(
      `platform-variants/${state.ids.INSTAGRAM}`,
      "PATCH",
      {
        expectedVersionId: state.versions.INSTAGRAM,
        caption: "A fourth caption for concurrency",
        ctaText: "",
        ctaUrl: "",
        mediaIds: state.media,
      },
    );
    expect(edited.status).toBe(200);
    const expected = edited.data.currentVersionId;
    const results = await Promise.all([
      call(
        `platform-variants/${state.ids.INSTAGRAM}/approve`,
        "POST",
        { expectedVersionId: expected },
        johnCookie,
      ),
      call(
        `platform-variants/${state.ids.INSTAGRAM}/reject`,
        "POST",
        { expectedVersionId: expected, reason: "Concurrent decision" },
        johnCookie,
      ),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const h = await call(`platform-variants/${state.ids.INSTAGRAM}/history`);
    expect(
      h.data.decisions.filter(
        (d: { decision: { versionId: string } }) =>
          d.decision.versionId === expected,
      ),
    ).toHaveLength(1);
  });
  it("Public signup is disabled", async () => {
    const r = await getAuth().handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          name: "Intruder",
          email: "intruder@test.local",
          password,
        }),
      }),
    );
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
  it("Producer can archive content while reviewer cannot delete it", async () => {
    const forbidden = await call(
      `content/${state.itemId}`,
      "DELETE",
      undefined,
      johnCookie,
    );
    expect(forbidden.status).toBe(403);
    const archived = await call(
      `content/${state.itemId}`,
      "DELETE",
      undefined,
      adminCookie,
    );
    expect(archived.status).toBe(200);
    expect(
      (await call("content")).data.some(
        (item: { id: string }) => item.id === state.itemId,
      ),
    ).toBe(false);
  });
});
