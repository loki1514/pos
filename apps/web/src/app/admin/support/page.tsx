import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";
import { Planned } from "@/components/admin/Planned";

export const metadata: Metadata = { title: "Support" };

export default function SupportPage() {
  return (
    <Planned
      title="Support"
      phase="Later"
      position="unscheduled"
      icon={LifeBuoy}
      blurb="Operational support tooling for the Vini team."
      scope={[
        "Impersonate an organization admin for diagnosis, with an audit trail",
        "Inspect a single order end to end across its workflow",
        "Replay integration webhooks from Swiggy and Zomato",
        "Sync and offline-queue health per location",
      ]}
    />
  );
}
