import type { Metadata } from "next";
import { Monitor } from "lucide-react";
import { Planned } from "@/components/admin/Planned";

export const metadata: Metadata = { title: "Kitchen Display" };

export default function Page() {
  return (
    <Planned
      icon={Monitor}
      title="Kitchen Display"
      phase="Phase 3 · Operations"
      position="4 of 8"
      blurb="A screen in the kitchen replacing printed tickets."
      scope={["Live ticket board","Bump on ready","Overdue highlights"]}
    />
  );
}
