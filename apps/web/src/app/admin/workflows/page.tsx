import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Globe2 } from "lucide-react";
import {
  listModules,
  listOrgModules,
  listOrgWorkflows,
  listRoleModuleAccess,
  listWorkflowTemplates,
} from "@/lib/tenant";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { listOrganizations } from "@/lib/organizations";
import { WorkflowsManager } from "@/components/admin/workflows/WorkflowsManager";

export const metadata: Metadata = { title: "Workflows" };
export const dynamic = "force-dynamic";

/**
 * Two scopes, chosen with ?org=:
 *
 *   (absent)  platform templates — organization_id NULL, inherited by every
 *             org that has no override of the same key.
 *   <uuid>    that organization's own workflows.
 *
 * The scope is in the URL rather than component state so a link to
 * "Saffron House's workflows" is shareable and survives a reload.
 */
export default async function WorkflowsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org: orgParam } = await searchParams;
  const organizations = await listOrganizations();

  const selected = orgParam
    ? organizations.find((o) => o.id === orgParam) ?? null
    : null;

  const workflows = selected
    ? await listOrgWorkflows(selected.id)
    : await listWorkflowTemplates();

  const scopeLabel = selected ? selected.name : "All organizations";

  // Real roles + modules so a Permissions block ticks actual data, not a guess.
  let roles: { slug: string; name: string; id: string }[] = [];
  let modules: {
    key: string;
    name: string;
    submodules: { key: string; name: string }[];
    enabled: boolean;
  }[] = [];
  let roleAccess: { roleSlug: string; moduleKeys: string[] }[] = [];

  try {
    const [roleRows, catalog, toggles, access] = await Promise.all([
      supabaseAdmin.from("roles").select("id, slug, name").order("created_at"),
      listModules(),
      selected ? listOrgModules(selected.id) : Promise.resolve([]),
      listRoleModuleAccess(selected?.id ?? null),
    ]);

    roles = roleRows.data ?? [];

    // A module is "enabled" for this scope when the org says so; core modules
    // default on. At platform scope everything is offered.
    const byKey = new Map(toggles.map((t) => [t.module_key, t]));
    modules = catalog.map((m) => ({
      key: m.key,
      name: m.name,
      submodules: (m.submodules ?? []) as { key: string; name: string }[],
      enabled: selected ? (byKey.get(m.key)?.enabled ?? m.is_core) : true,
    }));

    // Role → the modules that role may actually open (org row wins over the
    // platform default), so "generate for Kitchen" produces Kitchen's flow.
    const roleById = new Map(roles.map((r) => [r.id, r.slug]));
    const resolved = new Map<string, Map<string, boolean>>();
    for (const rule of access) {
      const slug = roleById.get(rule.role_id);
      if (!slug) continue;
      if (!resolved.has(slug)) resolved.set(slug, new Map());
      const forRole = resolved.get(slug)!;
      if (rule.organization_id !== null || !forRole.has(rule.module_key)) {
        forRole.set(rule.module_key, rule.visible);
      }
    }
    roleAccess = [...resolved.entries()]
      .map(([roleSlug, m]) => ({
        roleSlug,
        moduleKeys: [...m.entries()].filter(([, v]) => v).map(([k]) => k),
      }))
      .filter((r) => r.moduleKeys.length > 0);
  } catch {
    // Control-plane tables missing — the canvas still works, just without
    // pre-populated palette entries.
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="t-h1">Workflows</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-muted">
          Workflows are versioned JSON. In-flight orders keep the version they
          started with — editing creates a new version, which starts active.
        </p>
      </div>

      {/* Scope picker — which organization am I configuring? */}
      <div className="glass rounded-[var(--r-xl)] p-4 sm:p-5">
        <div className="relative z-10">
          <div className="t-label mb-3 text-muted">Configuring for</div>

          <div className="flex flex-wrap gap-2">
            <ScopeChip
              href="/admin/workflows"
              active={!selected}
              icon={<Globe2 size={14} />}
              label="All organizations"
              hint="platform template"
            />
            {organizations.map((o) => (
              <ScopeChip
                key={o.id}
                href={`/admin/workflows?org=${o.id}`}
                active={selected?.id === o.id}
                icon={<Building2 size={14} />}
                label={o.name}
                hint={o.type}
              />
            ))}
          </div>

          <p className="mt-3 t-small text-muted">
            {selected
              ? `Workflows here belong to ${selected.name} alone and override any platform template sharing the same key.`
              : "Platform templates apply to every organization that hasn't defined its own version of the same key."}
          </p>
        </div>
      </div>

      <WorkflowsManager
        templates={workflows}
        organizationId={selected?.id ?? null}
        scopeLabel={scopeLabel}
        roles={roles}
        modules={modules}
        roleAccess={roleAccess}
      />
    </div>
  );
}

function ScopeChip({
  href,
  active,
  icon,
  label,
  hint,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "press btn-lime inline-flex items-center gap-2 rounded-[13px] px-3.5 py-2 text-[13px] font-extrabold"
          : "press glass-inset inline-flex items-center gap-2 rounded-[13px] px-3.5 py-2 text-[13px] font-bold text-muted hover:text-ink"
      }
    >
      <span className="relative z-10 inline-flex items-center gap-2">
        {icon}
        {label}
        <span className="rounded-full bg-[rgb(18_21_15_/_0.12)] px-1.5 py-0.5 text-[10px] font-bold capitalize opacity-70">
          {hint}
        </span>
      </span>
    </Link>
  );
}
