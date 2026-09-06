import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
let instance: ReturnType<typeof createAuth> | undefined;
function createAuth() {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32)
    throw new Error(
      "Set AUTH_SECRET to a random secret of at least 32 characters.",
    );
  return betterAuth({
    secret: process.env.AUTH_SECRET,
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: true,
          defaultValue: "REVIEWER",
          input: false,
        },
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, storage: "database", modelName: "rateLimit" },
    trustedOrigins: [
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    ],
    advanced: {
      useSecureCookies:
        process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ?? false,
    },
  });
}
export function getAuth() {
  return (instance ||= createAuth());
}
