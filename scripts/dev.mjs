import { spawn } from "node:child_process";
const incoming = process.argv.slice(2);
const args = incoming
  .filter((v) => v !== "--strictPort")
  .map((v) => (v === "--host" ? "--hostname" : v));
// Accept the supervised Work preview's Vite-style flags without changing Next.js.
const preview = incoming.includes("--strictPort");
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", ...args],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      ...(preview ? { NEXT_PUBLIC_APP_URL: "http://terminal.local:4173" } : {}),
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
