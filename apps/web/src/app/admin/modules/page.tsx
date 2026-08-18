import type { Metadata } from "next";
import { Blocks, Hammer, Lock, Users } from "lucide-react";
import { listModulesWithOrgCounts, type Module } from "@/lib/tenant";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Modules" };

type ModuleWithCount = Module & { orgsEnabled: number };

const GROUP_ORDER = [
  "Dashboard",
  "Orders",
  "POS",
  "KDS / KOT",
  "Menu",
  "Inventory",
  "Finance",
  "Marketing / CRM",
  "Staff",
  "Settings",
];

/** Submodules that exist in the product today; everything else is coming soon. */
const BUILT_SUBMODULES = new Set([
  "orders > live orders",
  "pos > billing",
  "kds / kot > kitchen screen",
  "menu > items",
]);

function groupRank(group: string): number {
  const i = GROUP_ORDER.findIndex(
    (g) => g.toLowerCase() === group.toLowerCase(),
  );
  return i === -1 ? GROUP_ORDER.length : i;
}

export default async function ModulesPage() {
  // The tenant data layer may still be a stub pre-merge — render an honest
  // empty state instead of failing the page.
  let modules: ModuleWithCount[] = [];
  let wired = true;
  try {
    modules = await listModulesWithOrgCounts();
  } catch {
    wired = false;
  }

  const groups = new Map<string, ModuleWithCount[]>();
  for (const m of modules) {
    const list = groups.get(m.group) ?? [];
    list.push(m);
    groups.set(m.group, list);
  }
  const ordered = [...groups.entries()].sort(
    (a, b) => groupRank(a[0]) - groupRank(b[0]),
  );
  for (const [, list] of ordered) {
    list.sort((a, b) => a.sort_order - b.sort_order);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="t-h1">Module registry</h1>
        <p className="mt-2 text-[15.5px] text-muted">
          The full platform module tree. Core modules ship with every org;
          optional ones are toggled per organization.
        </p>
      </div>

      {!wired ? (
        <div className="glass rounded-[var(--r-xl)] p-6 sm:p-8">
          <div className="relative z-10 flex items-start gap-4">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]"
              style={{ background: "#14170f" }}
            >
              <Blocks size={20} className="text-[var(--lime)]" />
            </span>
            <div>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold"
                style={{
                  background: "rgb(242 169 59 / 0.14)",
                  color: "var(--warn)",
                }}
              >
                <Hammer size={12} strokeWidth={2.8} />
                Not wired yet
              </span>
              <h2 className="t-h3 mt-3">Registry tables land with the data-layer merge</h2>
              <p className="mt-2 max-w-lg t-small text-muted">
                The <code>modules</code> and <code>org_modules</code> tables and
                the <code>lib/tenant.ts</code> implementation are being built on
                the data branch. Once merged, this page shows the full module
                tree with per-org enablement counts.
              </p>
            </div>
          </div>
        </div>
      ) : modules.length === 0 ? (
        <div className="glass rounded-[var(--r-xl)] p-6 sm:p-8">
          <div className="relative z-10">
            <h2 className="t-h3">No modules registered</h2>
            <p className="mt-2 t-small text-muted">
              Seed the module registry (migration) to populate this page.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {ordered.map(([group, list]) => (
            <section key={group}>
              <h2 className="t-label text-muted">{group}</h2>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                {list.map((mod) => (
                  <div
                    key={mod.key}
                    className="glass rounded-[var(--r-xl)] p-5"
                  >
                    <div className="relative z-10">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15.5px] font-bold text-ink">
                          {mod.name}
                        </span>
                        {mod.is_core ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                            style={{
                              background: "rgb(79 191 106 / 0.14)",
                              color: "var(--ok)",
                            }}
                          >
                            <Lock size={9} strokeWidth={3} />
                            Core
                          </span>
                        ) : (
                          <span className="rounded-full border border-[var(--line-strong)] px-2 py-0.5 text-[11px] font-bold text-ink-2">
                            Optional
                          </span>
                        )}
                        <span className="tnum ml-auto inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted">
                          <Users size={12} />
                          {mod.orgsEnabled}{" "}
                          {mod.orgsEnabled === 1 ? "org" : "orgs"}
                        </span>
                      </div>
                      {mod.submodules.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {mod.submodules.map((sub) => {
                            const built = BUILT_SUBMODULES.has(
                              `${mod.group.toLowerCase()} > ${sub.toLowerCase()}`,
                            );
                            return (
                              <span
                                key={sub}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
                                  built
                                    ? "border border-[var(--line-strong)] text-ink-2"
                                    : "text-muted",
                                )}
                                style={
                                  built
                                    ? undefined
                                    : {
                                        background: "rgb(242 169 59 / 0.10)",
                                        border:
                                          "1px dashed rgb(242 169 59 / 0.4)",
                                      }
                                }
                              >
                                {!built && <Hammer size={9} />}
                                {sub}
                                {!built && (
                                  <span className="opacity-75">
                                    · Coming soon
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
