import { readFileSync } from "node:fs";
import { getDb } from "../src/db/index";
import { sql } from "drizzle-orm";
const db = getDb();
await db.execute(
  sql`CREATE TABLE IF NOT EXISTS pliris_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
);
const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
for (const entry of journal.entries) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(8675309)`);
    const applied = await tx.execute(
      sql`SELECT name FROM pliris_migrations WHERE name=${entry.tag}`,
    );
    if (applied.rows.length) return;
    const statements = readFileSync(`drizzle/${entry.tag}.sql`, "utf8").split(
      "--> statement-breakpoint",
    );
    for (const statement of statements)
      if (statement.trim()) await tx.execute(sql.raw(statement));
    await tx.execute(
      sql`INSERT INTO pliris_migrations(name) VALUES(${entry.tag})`,
    );
  });
  console.log(`Migration checked: ${entry.tag}`);
}
process.exit(0);
