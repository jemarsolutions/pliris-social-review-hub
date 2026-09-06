export type Role = "ADMIN" | "PRODUCER" | "REVIEWER";
export type Actor = {
  id: string;
  role: Role;
  name?: string;
  integration?: boolean;
};
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireProducer(actor: Actor) {
  if (actor.role !== "ADMIN" && actor.role !== "PRODUCER")
    throw new AppError(403, "Producer access required.");
}
export function requireReviewer(actor: Actor) {
  if (actor.role !== "REVIEWER" || actor.integration)
    throw new AppError(403, "Reviewer access required.");
}
export function requireVersion(current: string | null, expected: string) {
  if (current !== expected)
    throw new AppError(
      409,
      "Content has changed. Reload and review the current version.",
    );
}
export function requireDecision(reason: string, decision: string) {
  if (decision !== "APPROVED" && !reason.trim())
    throw new AppError(422, "Written feedback is required.");
}
export function coverage<
  T extends { plannedPublishAt: Date | string; reviewStatus: string },
>(variants: T[], now = new Date()) {
  // Rolling 168 hours; includes now, excludes exactly seven days from now.
  const end = now.getTime() + 7 * 24 * 60 * 60 * 1000;
  const upcoming = variants.filter(
    (v) =>
      new Date(v.plannedPublishAt).getTime() >= now.getTime() &&
      new Date(v.plannedPublishAt).getTime() < end,
  );
  const approved = upcoming.filter((v) => v.reviewStatus === "APPROVED").length;
  return {
    approved,
    total: upcoming.length,
    percentage: upcoming.length
      ? Math.round((approved / upcoming.length) * 100)
      : 0,
    earliestUnapproved:
      upcoming
        .filter((v) => v.reviewStatus !== "APPROVED")
        .sort(
          (a, b) =>
            new Date(a.plannedPublishAt).getTime() -
            new Date(b.plannedPublishAt).getTime(),
        )[0] || null,
  };
}
