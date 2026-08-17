import type { Metadata } from "next";
import { QrCode } from "lucide-react";
import { Planned } from "@/components/admin/Planned";

export const metadata: Metadata = { title: "QR Ordering" };

export default function Page() {
  return (
    <Planned
      icon={QrCode}
      title="QR Ordering"
      phase="Phase 3 · Operations"
      position="7 of 8"
      blurb="Guests scan, order and pay from their own phone."
      scope={["Per-table QR codes","Guest menu and cart","Pay-at-table"]}
    />
  );
}
