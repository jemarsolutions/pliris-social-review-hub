import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
if (existsSync(".env"))
  throw new Error(".env already exists. Keep it; use db:migrate and db:seed.");
mkdirSync(".local", { recursive: true });
const admin = randomBytes(18).toString("base64url"),
  reviewer = randomBytes(18).toString("base64url");
const env = `LOCAL_DEMO=1\nLOCAL_DB_PATH=.local/database\nAUTH_SECRET=${randomBytes(32).toString("hex")}\nNEXT_PUBLIC_APP_URL=http://localhost:3000\nSEED_ADMIN_EMAIL=mac@example.test\nSEED_REVIEWER_EMAIL=john@example.test\nSEED_ADMIN_PASSWORD=${admin}\nSEED_REVIEWER_PASSWORD=${reviewer}\n`;
writeFileSync(".env", env, { mode: 0o600 });
writeFileSync(
  ".local/demo-accounts.txt",
  `Local demo only. Never commit or share this file.\nMac: mac@example.test\nPassword: ${admin}\nJohn: john@example.test\nPassword: ${reviewer}\n`,
  { mode: 0o600 },
);
execFileSync("npm", ["run", "db:migrate"], { stdio: "inherit" });
execFileSync("npm", ["run", "db:seed"], { stdio: "inherit" });
console.log(
  "Demo ready. Private login details are in .local/demo-accounts.txt. Run npm run dev -- --port 3000.",
);
