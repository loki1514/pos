import type { Metadata } from "next";
import { Smartphone } from "lucide-react";
import { Planned } from "@/components/admin/Planned";

export const metadata: Metadata = { title: "Captain Order" };

export default function Page() {
  return (
    <Planned
      icon={Smartphone}
      title="Captain Order"
      phase="Phase 3 · Operations"
      position="2 of 8"
      blurb="Waitstaff take orders at the table from a phone — straight to the kitchen."
      scope={["Table-wise order taking","Send to kitchen as KOT","Captain performance"]}
    />
  );
}
