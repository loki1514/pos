import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import { Planned } from "@/components/admin/Planned";

export const metadata: Metadata = { title: "Payments" };

export default function Page() {
  return (
    <Planned
      icon={CreditCard}
      title="Payments"
      phase="Phase 4 · Business"
      position="2 of 3"
      blurb="Settlements, tenders and reconciliation."
      scope={["Settlement reports","Tender-wise breakdown","Refunds"]}
    />
  );
}
