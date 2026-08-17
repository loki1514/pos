import type { Metadata } from "next";
import { ChefHat } from "lucide-react";
import { Planned } from "@/components/admin/Planned";

export const metadata: Metadata = { title: "Operations" };

export default function OperationsPage() {
  return (
    <Planned
      title="Operations"
      phase="Phase 3 — Core Operations"
      position="12–16"
      icon={ChefHat}
      blurb="Live POS, KOT, Captain and table operations across the platform."
      scope={[
        "POS and payment flows",
        "KOT — receive, prepare, add delay, mark ready",
        "Captain — mobile table ordering and order status",
        "Tables — floor layout, occupancy, transfers",
        "Low-stock alerts raised by the kitchen to the biller",
      ]}
    />
  );
}
