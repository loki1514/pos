import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { Planned } from "@/components/admin/Planned";

export const metadata: Metadata = { title: "POS Billing" };

export default function Page() {
  return (
    <Planned
      icon={Receipt}
      title="POS Billing"
      phase="Phase 3 · Operations"
      position="5 of 8"
      blurb="The billing screen from the reference layout — pending tables, order summary, payments."
      scope={["Table and quick billing","Cash, UPI, card and split tenders","GST invoicing"]}
    />
  );
}
