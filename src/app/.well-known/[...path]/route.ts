import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const path = new URL(request.url).pathname;
  if (
    !path.startsWith("/.well-known/oauth-authorization-server") &&
    !path.startsWith("/.well-known/oauth-protected-resource")
  )
    return new Response("Not found", { status: 404 });
  return getAuth().handler(request);
}
