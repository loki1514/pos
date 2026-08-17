import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { Planned } from "@/components/admin/Planned";

export const metadata: Metadata = { title: "Live Orders" };

export default function Page() {
  return (
    <Planned
      icon={ClipboardList}
      title="Live Orders"
      phase="Phase 3 · Operations"
      position="1 of 8"
      blurb="Every order across dine-in, takeaway, delivery and QR — in real time."
      scope={["Order view and KOT view","Channel filters: dine-in, delivery, pickup, online","Order status timeline"]}
    />
  );
}
