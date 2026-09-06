import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { getAppBaseUrl, getTrustedAppOrigins } from "./app-origin";
let instance: ReturnType<typeof createAuth> | undefined;
function createAuth() {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32)
    throw new Error(
      "Set AUTH_SECRET to a random secret of at least 32 characters.",
    );
  const baseURL = getAppBaseUrl();
  return betterAuth({
    secret: process.env.AUTH_SECRET,
    baseURL,
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
    trustedOrigins: getTrustedAppOrigins(),
    advanced: {
      useSecureCookies: baseURL.startsWith("https://"),
    },
  });
}
export function getAuth() {
  return (instance ||= createAuth());
}
