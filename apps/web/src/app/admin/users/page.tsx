import type { Metadata } from "next";
import { Users } from "lucide-react";
import { Planned } from "@/components/admin/Planned";

export const metadata: Metadata = { title: "Users" };

export default function UsersPage() {
  return (
    <Planned
      title="Organization Users"
      phase="Phase 1 — Vini Super Admin"
      position="5 of 7"
      icon={Users}
      blurb="Users belonging to each organization, and the roles they hold."
      scope={[
        "List and search users across an organization",
        "Invite an organization admin, who then provisions their own staff",
        "Assign roles — biller, captain, kitchen, manager",
        "Scope a user to one or more locations",
        "Suspend or reactivate access without deleting history",
      ]}
    />
  );
}
