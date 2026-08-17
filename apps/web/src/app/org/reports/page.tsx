import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { Planned } from "@/components/admin/Planned";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return (
    <Planned
      icon={BarChart3}
      title="Reports"
      phase="Phase 4 · Business"
      position="3 of 3"
      blurb="Sales, orders, customers and delivery reporting — the investor view too."
      scope={["Sales and order reports","Customer reports","Export to CSV"]}
    />
  );
}
