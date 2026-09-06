import { authenticate, apiError } from "@/lib/api-auth";
import { AppError, coverage } from "@/lib/domain";
import * as service from "@/lib/service";
import { completeVideoUpload, signVideoUpload, uploadMedia } from "@/lib/media";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
async function route(req: Request, ctx: Context) {
  try {
    const actor = await authenticate(req);
    const { path: p } = await ctx.params;
    const method = req.method;
    let data: unknown;
    if (method === "GET") {
      if (p[0] === "dashboard" && p.length === 1)
        data = await service.dashboard();
      else if (p[0] === "me" && p.length === 1) data = actor;
      else if (
        [
          "content",
          "review-queue",
          "calendar",
          "coverage",
          "revisions",
        ].includes(p[0])
      ) {
        const items = await service.listContent();
        const variants = items.flatMap((i) =>
          i.variants.map((v) => ({
            ...v,
            title: i.title,
            contentDate: i.contentDate,
          })),
        );
        variants.sort(
          (a, b) =>
            new Date(a.plannedPublishAt).getTime() -
            new Date(b.plannedPublishAt).getTime(),
        );
        if (p[0] === "content") {
          data = p[1] ? items.find((i) => i.id === p[1]) : items;
          if (!data) throw new AppError(404, "Content not found.");
        } else if (p[0] === "coverage") data = coverage(variants);
        else if (p[0] === "calendar") {
          const url = new URL(req.url);
          const start = url.searchParams.get("start"),
            end = url.searchParams.get("end");
          if (
            (start && !Number.isFinite(Date.parse(start))) ||
            (end && !Number.isFinite(Date.parse(end)))
          )
            throw new AppError(422, "Invalid calendar range.");
          data = variants.filter(
            (v) =>
              (!start || new Date(v.plannedPublishAt) >= new Date(start)) &&
              (!end || new Date(v.plannedPublishAt) < new Date(end)),
          );
        } else
          data = variants.filter(
            (v) =>
              v.reviewStatus ===
              (p[0] === "review-queue"
                ? "READY_FOR_REVIEW"
                : "CHANGES_REQUESTED"),
          );
      } else if (p[0] === "platform-variants" && p[1] && p[2] === "history")
        data = await service.history(p[1]);
      else throw new AppError(404, "Endpoint not found.");
    } else if (method === "DELETE" && p[0] === "content" && p.length === 2)
      data = await service.archiveContent(actor, p[1]);
    else if (method === "POST" && p[0] === "media" && p.length === 1)
      data = await uploadMedia(actor, req);
    else {
      const text = await req.text();
      if (text.length > 100000) throw new AppError(413, "Request too large.");
      const input = JSON.parse(text || "{}");
      if (p[0] === "media" && p[1] === "sign-upload" && method === "POST")
        data = signVideoUpload(actor, input);
      else if (
        p[0] === "media" &&
        p[1] === "complete-video" &&
        method === "POST"
      )
        data = await completeVideoUpload(actor, input);
      else if (p[0] === "content" && p.length === 1 && method === "POST")
        data = await service.createContent(actor, input);
      else if (p[0] === "content" && p.length === 2 && method === "PATCH")
        data = await service.updateContent(actor, p[1], input);
      else if (
        p[0] === "content" &&
        p[2] === "platform-variants" &&
        method === "POST"
      )
        data = await service.createVariant(actor, p[1], input);
      else if (p[0] === "platform-variants" && p[1]) {
        const variantId = p[1];
        if (method === "PATCH" && p.length === 2)
          data = await service.editVariant(actor, variantId, input);
        else if (method === "POST") {
          switch (p[2]) {
            case "submit-review":
              data = await service.submitReview(
                actor,
                variantId,
                input.expectedVersionId,
              );
              break;
            case "approve":
              data = await service.decide(actor, variantId, "APPROVED", input);
              break;
            case "request-revision":
              data = await service.decide(
                actor,
                variantId,
                "CHANGES_REQUESTED",
                input,
              );
              break;
            case "reject":
              data = await service.decide(actor, variantId, "REJECTED", input);
              break;
            case "comments":
              data = await service.addComment(actor, variantId, input);
              break;
            case "publishing":
              data = await service.recordPublishing(actor, variantId, input);
              break;
            case "plan":
              data = await service.planVariant(
                actor,
                variantId,
                input.plannedPublishAt,
              );
              break;
            default:
              throw new AppError(404, "Endpoint not found.");
          }
        } else throw new AppError(405, "Method not allowed.");
      } else throw new AppError(404, "Endpoint not found.");
    }
    return Response.json(
      { data },
      {
        status: method === "POST" ? 201 : 200,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
export const GET = route;
export const POST = route;
export const PATCH = route;
export const DELETE = route;
