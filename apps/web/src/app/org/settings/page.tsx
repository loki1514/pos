import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { Planned } from "@/components/admin/Planned";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return (
    <Planned
      icon={Settings}
      title="Settings"
      phase="Phase 5 · Organization"
      position="1 of 1"
      blurb="Organization profile, tax details and preferences."
      scope={["Edit profile and legal details","Invoice and GST settings","Danger zone"]}
    />
  );
}
