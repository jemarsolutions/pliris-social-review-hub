import { readFileSync } from "node:fs";
import { getDb } from "../src/db/index";
import { contentItems } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { createUser } from "./create-user";
import * as service from "../src/lib/service";
import { uploadMedia } from "../src/lib/media";
import type { Actor } from "../src/lib/domain";
const admin = await createUser(
  "Mac Jemar",
  process.env.SEED_ADMIN_EMAIL || "mac@example.test",
  "ADMIN",
  process.env.SEED_ADMIN_PASSWORD || "",
);
const reviewer = await createUser(
  "John O’Shea",
  process.env.SEED_REVIEWER_EMAIL || "john@example.test",
  "REVIEWER",
  process.env.SEED_REVIEWER_PASSWORD || "",
);
const a: Actor = { id: admin.id, role: "ADMIN" },
  r: Actor = { id: reviewer.id, role: "REVIEWER" };
const monday = new Date();
monday.setUTCHours(0, 0, 0, 0);
monday.setUTCDate(monday.getUTCDate() + ((8 - monday.getUTCDay()) % 7 || 7));
const topics = [
  ["Start with the way you live", "A home designed around everyday life."],
  [
    "The details behind a better plan",
    "Thoughtful planning starts with the right questions.",
  ],
  [
    "Before you choose your land",
    "Consider the site before shaping the design.",
  ],
  ["Room to grow, space to belong", "Plan for the life you want to build."],
  [
    "From an idea to a considered home",
    "Good conversations lead to clearer next steps.",
  ],
];
for (let n = 0; n < 5; n++) {
  if (
    (
      await getDb()
        .select()
        .from(contentItems)
        .where(eq(contentItems.title, topics[n][0]))
    ).length
  )
    continue;
  const date = new Date(monday.getTime() + n * 86400000);
  const item = await service.createContent(a, {
    title: topics[n][0],
    contentDate: date.toISOString().slice(0, 10),
    campaign: "Sample · A considered home",
    conceptSummary: topics[n][1],
  });
  const media: string[] = [];
  for (let slide = 0; slide < (n === 0 ? 3 : 1); slide++) {
    const form = new FormData();
    form.set(
      "file",
      new File(
        [readFileSync(`fixtures/sample-${((n + slide) % 5) + 1}.png`)],
        "sample.png",
        { type: "image/png" },
      ),
    );
    form.set(
      "altText",
      `Sample typographic artwork: ${topics[(n + slide) % 5][0]}`,
    );
    const asset = await uploadMedia(
      a,
      new Request("http://localhost/upload", { method: "POST", body: form }),
    );
    media.push(asset.id);
  }
  for (const [index, platform] of [
    "INSTAGRAM",
    "FACEBOOK",
    "LINKEDIN",
  ].entries()) {
    date.setUTCHours(16 + index, 0, 0, 0);
    const v = await service.createVariant(a, item.id, {
      platform,
      contentFormat: media.length > 1 ? "CAROUSEL" : "IMAGE_POST",
      plannedPublishAt: date.toISOString(),
      caption: `${topics[n][0]}.\n\n${topics[n][1]}\n\n${platform === "INSTAGRAM" ? "Save this idea for your next home planning conversation. #HomeDesign #ThoughtfulPlanning" : platform === "FACEBOOK" ? "What matters most in a home that works for your family? Share your thoughts." : "A considered design brief helps teams make better decisions. What questions do you ask at the start of a project?"}\n\nSample content for prototype testing.`,
      ctaText: "Explore the idea",
      ctaUrl: "https://plirisco.com/",
      mediaIds: media,
    });
    await service.submitReview(a, v.id, v.currentVersionId!);
    if (n === 1 || n === 4)
      await service.decide(r, v.id, "APPROVED", {
        expectedVersionId: v.currentVersionId,
        reason: "Sample approval for demonstration.",
      });
    if (n === 2 && index === 0)
      await service.decide(r, v.id, "CHANGES_REQUESTED", {
        expectedVersionId: v.currentVersionId,
        reason:
          "Please make the opening caption shorter and lead with the site question.",
      });
    if (n === 3 && index === 2)
      await service.decide(r, v.id, "REJECTED", {
        expectedVersionId: v.currentVersionId,
        reason:
          "Please replace this concept with a more specific educational example.",
      });
    if (n === 4)
      await service.recordPublishing(a, v.id, {
        expectedVersionId: v.currentVersionId,
        status: "PUBLISHED",
        publishedAt: new Date().toISOString(),
        publishedUrl: "https://example.com/sample-post",
      });
  }
}
console.log(
  "Seed complete: five sample content ideas, 15 platform adaptations; no social publishing performed.",
);
process.exit(0);
