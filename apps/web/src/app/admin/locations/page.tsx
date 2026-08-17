import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { Planned } from "@/components/admin/Planned";

export const metadata: Metadata = { title: "Locations" };

export default function LocationsPage() {
  return (
    <Planned
      title="Organization Locations"
      phase="Phase 1 — Vini Super Admin"
      position="6 of 7"
      icon={MapPin}
      blurb="The individual outlets operating under each organization."
      scope={[
        "Create locations under an organization",
        "Address, timezone, currency and tax profile per location",
        "Enable the modules each location actually uses",
        "Per-location POS, KOT and Captain settings",
        "Go-live status and operating hours",
      ]}
    />
  );
}
