import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { dashboard } from "@/lib/service";
import { Hub } from "@/components/hub";
import { BrandMark } from "@/components/brand-mark";
import type { HubData } from "@/components/types";
export const dynamic = "force-dynamic";
export default async function Home() {
  if (
    !process.env.AUTH_SECRET ||
    (!process.env.DATABASE_URL && process.env.LOCAL_DEMO !== "1")
  )
    return (
      <main className="setup">
        <BrandMark />
        <h1>Ready to connect.</h1>
        <p>
          Run the local demo setup or configure your database and authentication
          secret to open this private workspace.
        </p>
        <p>The setup instructions are in README.md.</p>
      </main>
    );
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const data = await dashboard();
  return (
    <Hub
      initial={JSON.parse(JSON.stringify(data)) as HubData}
      user={{
        id: session.user.id,
        name: session.user.name,
        role: session.user.role as "ADMIN" | "PRODUCER" | "REVIEWER",
      }}
      localDemo={process.env.LOCAL_DEMO === "1" && !process.env.DATABASE_URL}
    />
  );
}
