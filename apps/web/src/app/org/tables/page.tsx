import type { Metadata } from "next";
import { Utensils } from "lucide-react";
import { Planned } from "@/components/admin/Planned";

export const metadata: Metadata = { title: "Dining Areas" };

export default function Page() {
  return (
    <Planned
      icon={Utensils}
      title="Dining Areas"
      phase="Phase 3 · Operations"
      position="6 of 8"
      blurb="Floors, sections and tables with live occupancy."
      scope={["Table layout editor","Status: free, running, billed","Merge and move tables"]}
    />
  );
}
