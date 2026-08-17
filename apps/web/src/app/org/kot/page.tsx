import type { Metadata } from "next";
import { ChefHat } from "lucide-react";
import { Planned } from "@/components/admin/Planned";

export const metadata: Metadata = { title: "Kitchen (KOT)" };

export default function Page() {
  return (
    <Planned
      icon={ChefHat}
      title="Kitchen (KOT)"
      phase="Phase 3 · Operations"
      position="3 of 8"
      blurb="Kitchen order tickets — what to cook, in what order, for which table."
      scope={["KOT print and re-print","Course-wise firing","Prep-time tracking"]}
    />
  );
}
