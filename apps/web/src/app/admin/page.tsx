import type { Metadata } from "next";
import { Building2, MapPin, ReceiptText, Users } from "lucide-react";
import { CreateOrgSheet } from "@/components/admin/CreateOrgSheet";
import { OrgTable } from "@/components/admin/OrgTable";
import { StatTile } from "@/components/admin/StatTile";
import { listOrganizations } from "@/lib/organizations";

export const metadata: Metadata = { title: "Master Admin" };
export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const organizations = await listOrganizations();
  const active = organizations.filter((o) => o.status === "active").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-h1">Master Admin</h1>
          <p className="mt-2 text-[15.5px] text-muted">
            Every organization on the Vini POS platform.
          </p>
        </div>
        {organizations.length > 0 && <CreateOrgSheet />}
      </div>

      {/* KPIs — locations/users/orders stay at 0 until those modules exist */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Organizations"
          value={String(organizations.length)}
          icon={Building2}
          hint={`${active} active`}
        />
        <StatTile label="Locations" value="0" icon={MapPin} hint="not built yet" />
        <StatTile label="Users" value="0" icon={Users} hint="not built yet" />
        <StatTile label="Orders today" value="0" icon={ReceiptText} hint="not built yet" />
      </div>

      {organizations.length === 0 ? (
        <div className="glass flex flex-col items-center rounded-[var(--r-2xl)] px-6 py-16 text-center">
          <div className="relative z-10 flex flex-col items-center">
            <span
              className="flex h-16 w-16 items-center justify-center rounded-[20px]"
              style={{ background: "#14170f" }}
            >
              <Building2 size={26} className="text-[var(--lime)]" />
            </span>
            <h2 className="t-h2 mt-6">Create your first organization</h2>
            <p className="mt-2 max-w-sm text-[15px] text-muted">
              Everything in Vini POS — locations, users, roles, workflows —
              grows from the organization you create here.
            </p>
            <div className="mt-7">
              <CreateOrgSheet />
            </div>
          </div>
        </div>
      ) : (
        <OrgTable organizations={organizations} />
      )}
    </div>
  );
}
