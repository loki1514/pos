import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMyOrg } from "@/lib/org";
import { KotBoard } from "@/components/org/kot/KotBoard";
import { getKotBoard } from "./actions";

export const metadata: Metadata = { title: "Kitchen (KOT)" };

export default async function KotPage() {
  const org = await getMyOrg();
  if (!org) redirect("/login?next=/org/kot");
  if (org.myRole !== "kitchen" && org.myRole !== "org_admin") redirect("/org");

  const initial = await getKotBoard();

  return (
    <main className="pb-8">
      <KotBoard orgId={org.id} initial={initial} />
    </main>
  );
}
