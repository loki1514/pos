import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { Planned } from "@/components/admin/Planned";

export const metadata: Metadata = { title: "Permissions" };

export default function Page() {
  return (
    <Planned
      icon={ShieldCheck}
      title="Permissions"
      phase="Phase 2 · Organization"
      position="3 of 6"
      blurb="What each role can see and do inside this organization."
      scope={["View role capabilities","Assign roles to members","Custom roles per organization"]}
    />
  );
}
