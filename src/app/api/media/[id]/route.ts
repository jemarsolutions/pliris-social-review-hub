import { authenticate, apiError } from "@/lib/api-auth";
import { deliverMedia } from "@/lib/media";
export const dynamic = "force-dynamic";
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await authenticate(req);
    return await deliverMedia(
      (await ctx.params).id,
      new URL(req.url).searchParams.get("thumb") === "1",
    );
  } catch (e) {
    return apiError(e);
  }
}
