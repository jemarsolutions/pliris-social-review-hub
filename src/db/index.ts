import { drizzle as neonDrizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import {
  drizzle as localDrizzle,
  type PgliteDatabase,
} from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";
// Both adapters execute the same PostgreSQL schema and transactional service code.
const globalDb = globalThis as unknown as {
  plirisDb?: PgliteDatabase<typeof schema>;
};
export function getDb(): PgliteDatabase<typeof schema> {
  if (globalDb.plirisDb) return globalDb.plirisDb;
  if (process.env.DATABASE_URL) {
    neonConfig.webSocketConstructor = WebSocket;
    globalDb.plirisDb = neonDrizzle(
      new Pool({ connectionString: process.env.DATABASE_URL }),
      { schema },
    ) as unknown as PgliteDatabase<typeof schema>;
  } else {
    if (process.env.LOCAL_DEMO !== "1" || process.env.VERCEL)
      throw new Error(
        "DATABASE_URL required. Local demo must be explicitly enabled outside Vercel.",
      );
    globalDb.plirisDb = localDrizzle(
      new PGlite(process.env.LOCAL_DB_PATH || ".local/database"),
      { schema },
    );
  }
  return globalDb.plirisDb;
}
export type Database = ReturnType<typeof getDb>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
