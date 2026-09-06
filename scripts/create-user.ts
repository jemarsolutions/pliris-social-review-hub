import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db/index";
import { user, account } from "../src/db/schema";
export async function createUser(
  name: string,
  email: string,
  role: "ADMIN" | "PRODUCER" | "REVIEWER",
  password: string,
) {
  if (password.length < 12)
    throw new Error("Use a password of at least 12 characters.");
  const db = getDb();
  const [existing] = await db.select().from(user).where(eq(user.email, email));
  if (existing) return existing;
  const id = crypto.randomUUID();
  return db.transaction(async (tx) => {
    const [u] = await tx
      .insert(user)
      .values({ id, name, email, role, emailVerified: true })
      .returning();
    await tx
      .insert(account)
      .values({
        id: crypto.randomUUID(),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: await hashPassword(password),
      });
    return u;
  });
}
if (process.argv[1]?.endsWith("create-user.ts")) {
  const role = process.env.NEW_USER_ROLE;
  if (!["ADMIN", "PRODUCER", "REVIEWER"].includes(role || ""))
    throw new Error("Set NEW_USER_ROLE.");
  if (
    !process.env.NEW_USER_NAME ||
    !process.env.NEW_USER_EMAIL ||
    !process.env.NEW_USER_PASSWORD
  )
    throw new Error(
      "Set NEW_USER_NAME, NEW_USER_EMAIL and NEW_USER_PASSWORD in your shell.",
    );
  await createUser(
    process.env.NEW_USER_NAME,
    process.env.NEW_USER_EMAIL,
    role as "ADMIN" | "PRODUCER" | "REVIEWER",
    process.env.NEW_USER_PASSWORD,
  );
  console.log("User provisioned. No invitation sent.");
  process.exit(0);
}
