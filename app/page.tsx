import { headers } from "next/headers";
import Dashboard from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");

  return <Dashboard endpoint={`${proto}://${host}/api/ssbi/push`} />;
}
