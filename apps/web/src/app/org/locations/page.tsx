import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { Planned } from "@/components/admin/Planned";

export const metadata: Metadata = { title: "Locations" };

export default function Page() {
  return (
    <Planned
      icon={Building2}
      title="Locations"
      phase="Phase 2 · Organization"
      position="2 of 6"
      blurb="Outlets and stores under this organization — addresses, GSTIN per outlet, and per-location status."
      scope={["Add and edit locations","Per-outlet contact and tax details","Activate / suspend a location"]}
    />
  );
}
