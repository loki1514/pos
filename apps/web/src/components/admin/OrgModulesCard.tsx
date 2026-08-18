"use client";

import { useState, useTransition } from "react";
import { Hammer, LoaderCircle, Lock, Puzzle, TriangleAlert } from "lucide-react";
import type { Module } from "@/lib/tenant";
import { setOrgModuleAction } from "@/app/admin/organizations/[id]/actions";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";

export type OrgModule = Module & { enabled: boolean };

/** Preferred display order for module groups; unknown groups append after. */
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

/**
 * Submodules that actually exist in the product today. Everything else gets
 * "Coming soon" styling. Keyed as "<group lowercased> > <submodule lowercased>".
 */
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

function ModuleToggle({
  organizationId,
  mod,
}: {
  organizationId: string;
  mod: OrgModule;
}) {
  const [enabled, setEnabled] = useState(mod.enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (mod.is_core) {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold"
        style={{ background: "rgb(79 191 106 / 0.14)", color: "var(--ok)" }}
        title="Core module — always on"
      >
        <Lock size={11} strokeWidth={2.8} />
        Core
      </span>
    );
  }

  const flip = () => {
    const next = !enabled;
    haptic("light");
    setEnabled(next); // optimistic
    setError(null);
    startTransition(async () => {
      const res = await setOrgModuleAction(organizationId, mod.key, next);
      if (!res.ok) {
        setEnabled(!next); // roll back
        setError(res.error);
      }
    });
  };

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`${mod.name} module`}
        disabled={pending}
        onClick={flip}
        className={cn(
          "press relative h-8 w-14 rounded-full transition-colors disabled:opacity-60",
          enabled ? "btn-lime" : "glass-inset",
        )}
      >
        <span
          className={cn(
            "relative z-10 flex h-full items-center px-1 transition-transform",
            enabled ? "justify-end" : "justify-start",
          )}
        >
          {pending ? (
            <LoaderCircle size={16} className="animate-spin text-ink-2" />
          ) : (
            <span
              className={cn(
                "h-6 w-6 rounded-full shadow-sm transition-colors",
                enabled ? "bg-[#14170f]" : "bg-white",
              )}
            />
          )}
        </span>
      </button>
      {error && (
        <span
          role="alert"
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold"
          style={{ color: "var(--danger)" }}
        >
          <TriangleAlert size={11} />
          {error}
        </span>
      )}
    </span>
  );
}

export function OrgModulesCard({
  organizationId,
  modules,
  wired,
}: {
  organizationId: string;
  modules: OrgModule[];
  /** false when the tenant data layer threw (stub not merged yet). */
  wired: boolean;
}) {
  const groups = new Map<string, OrgModule[]>();
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
    <div className="glass rounded-[var(--r-xl)] p-5 sm:p-6">
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]"
            style={{ background: "#14170f" }}
          >
            <Puzzle size={15} className="text-[var(--lime)]" />
          </span>
          <h2 className="t-h3">Modules</h2>
          <span className="ml-auto t-small text-muted">
            {modules.filter((m) => m.enabled).length} of {modules.length} on
          </span>
        </div>

        <p className="mt-3 t-small text-muted">
          Turn optional modules on or off for this organization. Core modules
          are always on.
        </p>

        {!wired ? (
          <div
            className="mt-4 flex items-start gap-2.5 rounded-[12px] px-3.5 py-3 text-[13px] font-medium"
            style={{
              background: "rgb(242 169 59 / 0.12)",
              color: "var(--warn)",
              border: "1px solid rgb(242 169 59 / 0.26)",
            }}
          >
            <Hammer size={14} className="mt-0.5 shrink-0" />
            Module data is not wired yet — the control-plane tables land with
            the data-layer merge. Toggles will work then.
          </div>
        ) : modules.length === 0 ? (
          <p className="mt-4 t-small text-muted">
            No modules registered yet. Seed the module registry first.
          </p>
        ) : (
          <div className="mt-4 space-y-5">
            {ordered.map(([group, list]) => (
              <section key={group}>
                <h3 className="t-label text-muted">{group}</h3>
                <ul className="mt-2 space-y-2">
                  {list.map((mod) => (
                    <li
                      key={mod.key}
                      className="glass-inset flex items-start justify-between gap-4 rounded-[14px] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14.5px] font-bold text-ink">
                            {mod.name}
                          </span>
                          {!mod.is_core && mod.enabled && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                              style={{
                                background: "rgb(79 191 106 / 0.14)",
                                color: "var(--ok)",
                              }}
                            >
                              On
                            </span>
                          )}
                        </div>
                        {mod.submodules.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
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
                                          background:
                                            "rgb(242 169 59 / 0.10)",
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
                      <ModuleToggle organizationId={organizationId} mod={mod} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
