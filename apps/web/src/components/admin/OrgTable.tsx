"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, ChevronRight, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import type { Organization, OrgStatus } from "@/lib/organizations";
import { CreateOrgSheet } from "@/components/admin/CreateOrgSheet";

const STATUS: Record<OrgStatus, { label: string; bg: string; fg: string }> = {
  active: { label: "Active", bg: "rgb(79 191 106 / 0.14)", fg: "var(--ok)" },
  onboarding: { label: "Onboarding", bg: "rgb(76 147 232 / 0.14)", fg: "var(--info)" },
  suspended: { label: "Suspended", bg: "rgb(226 86 75 / 0.12)", fg: "var(--danger)" },
};

const FILTERS = ["All", "franchise", "investor"] as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function OrgTable({ organizations }: { organizations: Organization[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const rows =
    filter === "All"
      ? organizations
      : organizations.filter((o) => o.type === filter);

  return (
    <div className="glass-solid rounded-[var(--r-xl)]">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 p-5 pb-4">
        <div className="mr-auto">
          <h2 className="t-h3">Organizations</h2>
          <p className="mt-1 t-small text-muted">
            {rows.length} of {organizations.length} shown
          </p>
        </div>

        <div className="glass-inset inline-flex gap-1 rounded-[13px] p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onPointerDown={() => haptic("light")}
              onClick={() => setFilter(f)}
              className={cn(
                "press rounded-[10px] px-3 py-1.5 text-[12.5px] font-bold capitalize transition-colors",
                f === filter ? "btn-lime" : "text-muted hover:text-ink",
              )}
            >
              <span className="relative z-10">{f}</span>
            </button>
          ))}
        </div>

        <button
          aria-label="Filter options"
          className="press glass press-glass inline-flex h-9 items-center gap-1.5 rounded-[13px] px-3 text-[13px] font-semibold"
        >
          <SlidersHorizontal size={14} />
          <span className="hidden sm:inline">Filter</span>
        </button>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <EmptyState hasAny={organizations.length > 0} />
      ) : (
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left">
            <thead>
              <tr className="border-y border-[var(--line)]">
                {["Organization", "Type", "Status", "Contact", "Created", ""].map(
                  (h, i) => (
                    <th
                      key={h || i}
                      scope="col"
                      className="t-label px-5 py-3 font-bold text-muted"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((org) => {
                const s = STATUS[org.status];
                return (
                  <tr
                    key={org.id}
                    tabIndex={0}
                    role="link"
                    onClick={() => router.push(`/admin/organizations/${org.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/admin/organizations/${org.id}`);
                      }
                    }}
                    className="group cursor-pointer border-b border-[var(--line)] outline-none transition-colors last:border-0 hover:bg-[rgb(180_238_42_/_0.07)] focus-visible:bg-[rgb(180_238_42_/_0.09)]"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]"
                          style={{ background: "#14170f" }}
                        >
                          <Building2 size={15} className="text-[var(--lime)]" />
                        </span>
                        <span className="min-w-0">
                          <span className="block max-w-[220px] truncate text-[14.5px] font-bold leading-tight">
                            {org.name}
                          </span>
                          <span className="block text-[12px] text-muted">
                            /{org.slug}
                          </span>
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-full border border-[var(--line-strong)] px-2.5 py-1 text-[12px] font-bold capitalize">
                        {org.type}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold"
                        style={{ background: s.bg, color: s.fg }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: s.fg }}
                        />
                        {s.label}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-[13.5px] text-ink-2">
                      {org.contact_email || (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    <td className="tnum px-5 py-4 text-[13.5px] text-muted">
                      {formatDate(org.created_at)}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <ChevronRight
                        size={16}
                        className="ml-auto text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="glass-inset mb-4 flex h-14 w-14 items-center justify-center rounded-[18px]">
        <Building2 size={22} className="text-muted" />
      </span>
      <h3 className="t-h3">
        {hasAny ? "No organizations match this filter" : "No organizations yet"}
      </h3>
      <p className="mt-2 max-w-xs t-small text-muted">
        {hasAny
          ? "Try a different type filter."
          : "Everything in Vini POS grows from an organization. Create the first one to begin."}
      </p>
      {!hasAny && (
        <div className="mt-6">
          <CreateOrgSheet />
        </div>
      )}
    </div>
  );
}
