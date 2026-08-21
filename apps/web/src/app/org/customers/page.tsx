import type { Metadata } from "next";
import { HeartHandshake } from "lucide-react";
import { Planned } from "@/components/admin/Planned";

export const metadata: Metadata = { title: "Customers & CRM" };

export default function OrgCustomersPage() {
  return (
    <Planned
      title="Customers & CRM"
      phase="Phase 4 — Extensions"
      position="marketing_crm"
      icon={HeartHandshake}
      blurb="Guest profiles, campaigns, offers and loyalty for this organization."
      scope={[
        "Customer directory built from order history",
        "Campaigns — SMS and email pushes to guest segments",
        "Offers and discount codes, redeemable at POS",
        "Loyalty points accrual and redemption",
      ]}
    />
  );
}
