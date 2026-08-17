import type { Metadata } from "next";
import { Package } from "lucide-react";
import { Planned } from "@/components/admin/Planned";

export const metadata: Metadata = { title: "Inventory" };

export default function Page() {
  return (
    <Planned
      icon={Package}
      title="Inventory"
      phase="Phase 4 · Business"
      position="1 of 3"
      blurb="Stock, recipes and purchase — tied to what you sell."
      scope={["Stock levels and alerts","Recipe costing","Purchase orders"]}
    />
  );
}
