import type { Metadata } from "next";
import {
  ChefHat,
  ClipboardList,
  Crown,
  Receipt,
  ShieldCheck,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const metadata: Metadata = { title: "Roles" };
export const dynamic = "force-dynamic";

const ROLE_ICON: Record<string, LucideIcon> = {
  org_admin: Crown,
  manager: ClipboardList,
  biller: Receipt,
  captain: Smartphone,
  kitchen: ChefHat,
};

export default async function RolesPage() {
  const { data: roles, error } = await supabaseAdmin
    .from("roles")
    .select("id, slug, name, description, is_system")
    .order("created_at");

  if (error) throw new Error(`RolesPage: ${error.message}`);

  const system = (roles ?? []).filter((r) => r.is_system);
  const custom = (roles ?? []).filter((r) => !r.is_system);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="t-h1">Roles</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-muted">
          Every org user signs in with one of these roles. System roles ship
          with the platform; organizations can define their own later without a
          release — the permission checks read from this table, not from code.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {system.map((role) => {
          const Icon = ROLE_ICON[role.slug] ?? ShieldCheck;
          return (
            <div key={role.id} className="glass rounded-[var(--r-lg)] p-5">
              <div className="relative z-10">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]"
                    style={{ background: "#14170f" }}
                  >
                    <Icon size={17} className="text-[var(--lime)]" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-[15px] font-extrabold">
                      {role.name}
                    </h2>
                    <p className="tnum truncate text-[12px] text-muted">
                      {role.slug}
                    </p>
                  </div>
                  <span
                    className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
                    style={{
                      background: "rgb(180 238 42 / 0.16)",
                      color: "var(--lime-deep)",
                    }}
                  >
                    System
                  </span>
                </div>
                <p className="mt-3 text-[13.5px] text-ink-2">
                  {role.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {custom.length > 0 && (
        <div className="glass rounded-[var(--r-xl)] p-5 sm:p-6">
          <div className="relative z-10">
            <h2 className="t-h3">Custom roles</h2>
            <ul className="mt-3 space-y-2">
              {custom.map((role) => (
                <li key={role.id} className="text-[14px] font-semibold">
                  {role.name}
                  <span className="ml-2 t-small font-normal text-muted">
                    {role.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="glass rounded-[var(--r-xl)] p-5 sm:p-6">
        <div className="relative z-10">
          <h2 className="t-h3">Assigning roles</h2>
          <p className="mt-2 max-w-2xl text-[14px] text-muted">
            Roles are assigned when someone joins an organization. Open an
            organization and generate an{" "}
            <Link
              href="/admin/organizations"
              className="font-bold text-ink underline decoration-[var(--lime-deep)] underline-offset-2"
            >
              invite link
            </Link>{" "}
            for the role you want — the person signs up through it and lands in
            that role. Custom role creation UI lands in a later phase; new
            roles are rows in the <code>roles</code> table until then.
          </p>
        </div>
      </div>
    </div>
  );
}
