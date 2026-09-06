import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getAuth } from "./auth";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { AppError, type Actor, type Role } from "./domain";
export async function authenticate(request: Request): Promise<Actor> {
  const bearer = request.headers.get("authorization");
  if (bearer) {
    const key = process.env.INTERNAL_API_KEY;
    const value = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
    if (
      !key ||
      key.length < 32 ||
      Buffer.byteLength(key) !== Buffer.byteLength(value) ||
      !timingSafeEqual(Buffer.from(key), Buffer.from(value))
    )
      throw new AppError(401, "Authentication required.");
    const [u] = await getDb()
      .select()
      .from(user)
      .where(eq(user.id, process.env.INTERNAL_API_USER_ID || ""));
    if (!u || !["PRODUCER", "ADMIN"].includes(u.role))
      throw new AppError(401, "Integration identity unavailable.");
    return { id: u.id, role: "PRODUCER", name: u.name, integration: true };
  }
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) throw new AppError(401, "Authentication required.");
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const expected = new URL(
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    ).origin;
    if (origin !== expected) throw new AppError(403, "Invalid request origin.");
  }
  return {
    id: session.user.id,
    name: session.user.name,
    role: session.user.role as Role,
  };
}
export function apiError(error: unknown) {
  if (error instanceof AppError)
    return Response.json(
      { error: { message: error.message } },
      { status: error.status },
    );
  if (error && typeof error === "object" && "issues" in error)
    return Response.json(
      { error: { message: "Invalid input.", details: error.issues } },
      { status: 422 },
    );
  if (error instanceof SyntaxError)
    return Response.json(
      { error: { message: "Invalid JSON." } },
      { status: 400 },
    );
  const code =
    (error as { cause?: { code?: string }; code?: string })?.cause?.code ||
    (error as { code?: string })?.code;
  if (code === "23505")
    return Response.json(
      { error: { message: "That record already exists." } },
      { status: 409 },
    );
  console.error(
    "Request failed:",
    error instanceof Error ? error.name : "Unknown error",
  );
  return Response.json(
    { error: { message: "Unable to complete this request." } },
    { status: 500 },
  );
}
