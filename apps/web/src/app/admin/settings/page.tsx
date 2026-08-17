import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { Planned } from "@/components/admin/Planned";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <Planned
      title="Platform Settings"
      phase="Phase 1 — Vini Super Admin"
      position="7 of 7"
      icon={Settings}
      blurb="Platform-level configuration owned by Vini, not by organizations."
      scope={[
        "Platform admin roster",
        "Default module set applied to a new organization",
        "Integration credentials — Swiggy, Zomato, payment gateways",
        "Branding and domain defaults",
        "Audit log of super admin actions",
      ]}
    />
  );
}
