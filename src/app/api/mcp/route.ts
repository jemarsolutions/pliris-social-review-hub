import { eq } from "drizzle-orm";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { requireMcpAuth } from "@better-auth/mcp";
import type { JWTPayload } from "jose";
import { z } from "zod";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { AppError, type Actor } from "@/lib/domain";
import { getAppBaseUrl } from "@/lib/app-origin";
import * as service from "@/lib/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resource = `${getAppBaseUrl()}/api/mcp`;

async function getActor(
  claims: JWTPayload,
  integration = false,
): Promise<Actor> {
  if (!claims.sub) throw new AppError(401, "Sign-in is required.");
  const [account] = await getDb()
    .select()
    .from(user)
    .where(eq(user.id, claims.sub));
  if (!account) throw new AppError(401, "Your Hub account is unavailable.");
  return {
    id: account.id,
    name: account.name,
    role: account.role,
    ...(integration ? { integration: true } : {}),
  };
}

const wcsPostInput = z.object({
  contentId: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  contentDate: z.string().describe("WCS content date in YYYY-MM-DD format"),
  campaign: z.string().max(200).optional(),
  conceptSummary: z.string().max(4000).optional(),
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "LINKEDIN", "YOUTUBE", "TIKTOK"]),
  contentFormat: z.enum([
    "IMAGE_POST",
    "CAROUSEL",
    "SHORT_VIDEO",
    "LONG_VIDEO",
  ]),
  plannedPublishAt: z.string().describe("ISO 8601 timestamp with timezone"),
  publishingAccountName: z.string().min(1).max(200).optional(),
  caption: z.string().min(1).max(10000),
  headline: z.string().max(200).optional(),
  script: z.string().max(60000).optional(),
  chapters: z.string().max(10000).optional(),
  tags: z.string().max(2000).optional(),
  ctaText: z.string().max(300).optional(),
  ctaUrl: z.string().optional(),
  mediaIds: z.array(z.string()).max(20).optional(),
  videoId: z.string().nullable().optional(),
  thumbnailId: z.string().nullable().optional(),
  submitForReview: z.boolean().optional(),
});

const handler = createMcpHandler(
  () => {
    const server = new McpServer({
      name: "PLIRIS Social Review Hub",
      version: "1.0.0",
    });

    server.registerTool(
      "import_or_update_wcs_post",
      {
        title: "Import or update a WCS post",
        description:
          "Create or update one PLIRIS WCS post in the Social Review Hub using its stable Content ID. Repeated unchanged imports are idempotent. This does not publish content. Set submitForReview only when its media and copy are complete; reviewers retain all approval decisions.",
        inputSchema: wcsPostInput,
      },
      async (input, extra) => {
        try {
          if (!extra.http?.authInfo?.scopes.includes("wcs:write"))
            throw new AppError(
              403,
              "This connection is not authorized to import WCS posts.",
            );
          const actor = await getActor(
            extra.http?.authInfo?.extra as JWTPayload,
            true,
          );
          const result = await service.upsertWcsPost(actor, input);
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text:
                  error instanceof Error ? error.message : "WCS import failed.",
              },
            ],
          };
        }
      },
    );

    for (const [name, status, title] of [
      [
        "list_posts_awaiting_review",
        "READY_FOR_REVIEW",
        "List posts awaiting review",
      ],
      [
        "list_posts_needing_revision",
        "CHANGES_REQUESTED",
        "List posts needing revision",
      ],
    ] as const) {
      server.registerTool(
        name,
        {
          title,
          description: `Read PLIRIS Social Review Hub posts with review status ${status}. This is read-only and does not make or change review decisions.`,
          inputSchema: z.object({}),
        },
        async (_input, extra) => {
          try {
            const claims = extra.http?.authInfo?.extra as JWTPayload;
            if (!extra.http?.authInfo?.scopes.includes("review:read"))
              throw new AppError(
                403,
                "This connection is not authorized to read review queues.",
              );
            await getActor(claims);
            const items = await service.listContent();
            const posts = items.flatMap((item) =>
              item.variants
                .filter(
                  (variant) =>
                    variant.publishingAccount === "PLIRIS" &&
                    variant.reviewStatus === status,
                )
                .map((variant) => ({
                  title: item.title,
                  contentDate: item.contentDate,
                  variantId: variant.id,
                  versionId: variant.currentVersionId,
                  platform: variant.platform,
                  contentFormat: variant.contentFormat,
                  plannedPublishAt: variant.plannedPublishAt,
                  reviewStatus: variant.reviewStatus,
                  caption: variant.version.caption,
                })),
            );
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ count: posts.length, posts }),
                },
              ],
            };
          } catch (error) {
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text:
                    error instanceof Error
                      ? error.message
                      : "Unable to read the review queue.",
                },
              ],
            };
          }
        },
      );
    }

    return server;
  },
  { legacy: "reject" },
);

export async function POST(request: Request) {
  const protectedHandler = requireMcpAuth(
    getAuth(),
    (incomingRequest, claims) =>
      handler.fetch(incomingRequest, {
        authInfo: {
          token:
            incomingRequest.headers
              .get("authorization")
              ?.replace(/^Bearer\s+/i, "") || "",
          clientId:
            typeof claims.client_id === "string" ? claims.client_id : "",
          scopes:
            typeof claims.scope === "string"
              ? claims.scope.split(" ").filter(Boolean)
              : [],
          expiresAt: typeof claims.exp === "number" ? claims.exp : undefined,
          resource: new URL(resource),
          extra: claims,
        },
      }),
    { resource },
  );
  return protectedHandler(request);
}
