import type { Metadata } from "next";
import { Users } from "lucide-react";
import { getMyOrg, listOrgMembers, listRoles } from "@/lib/org";
import { listInvites } from "@/lib/invites";
import { InviteCard } from "@/components/shared/InviteCard";
import { createOrgInviteAction } from "./actions";

export const metadata: Metadata = { title: "Users & Roles" };
export const dynamic = "force-dynamic";

const ROLE_TONE: Record<string, { bg: string; fg: string }> = {
  org_admin: { bg: "rgb(180 238 42 / 0.18)", fg: "var(--lime-deep)" },
};

export default async function OrgUsersPage() {
  const org = await getMyOrg();
  const [members, roles, invites] = org
    ? await Promise.all([
        listOrgMembers(org.id),
        listRoles(),
        listInvites(org.id),
      ])
    : [[], [], []];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="t-h1">Users &amp; Roles</h1>
        <p className="mt-2 text-[15px] text-muted">
          Everyone who can sign in to {org?.name ?? "this organization"}, and
          invite links for the ones who haven&apos;t joined yet.
        </p>
      </div>

      <div className="glass rounded-[var(--r-xl)] p-4 sm:p-5">
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 px-1 pb-3">
            <Users size={16} className="text-[var(--lime-deep)]" />
            <h2 className="t-h3">Members</h2>
            <span className="t-small ml-auto text-muted">
              {members.length} {members.length === 1 ? "member" : "members"}
            </span>
          </div>

          <ul className="divide-y divide-[var(--line)]">
            {members.map((m) => {
              const tone = ROLE_TONE[m.role.slug] ?? {
                bg: "rgb(76 147 232 / 0.14)",
                fg: "var(--info)",
              };
              const label = m.full_name?.trim() || m.email;
              return (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold"
                    style={{ background: "#14170f", color: "var(--lime)" }}
                  >
                    {label.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-bold leading-tight">
                      {label}
                    </span>
                    {m.full_name && (
                      <span className="block truncate text-[12px] text-muted">
                        {m.email}
                      </span>
                    )}
                  </span>
                  <span
                    className="ml-auto shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    {m.role.name}
                  </span>
                  <span
                    className="hidden shrink-0 rounded-full border border-[var(--line-strong)] px-2 py-0.5 text-[11px] font-bold capitalize text-muted sm:inline-block"
                  >
                    {m.status}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {org && (
        <InviteCard
          organizationId={org.id}
          createAction={createOrgInviteAction}
          roles={roles}
          invites={invites}
        />
      )}
    </div>
  );
}
