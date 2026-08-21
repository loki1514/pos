"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  BadgeCheck,
  CheckCircle2,
  Globe,
  LoaderCircle,
  Plus,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type { OrgDomain } from "@/lib/tenant";
import {
  addOrgDomainAction,
  markDomainVerifiedAction,
  removeOrgDomainAction,
  type DomainState,
} from "@/app/admin/organizations/[id]/actions";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";

const INITIAL: DomainState = { ok: false, error: null };

const FIELD =
  "glass-inset h-10 w-full rounded-[12px] px-3.5 text-[14px] font-medium " +
  "outline-none transition-shadow placeholder:text-muted/70 " +
  "focus:shadow-[inset_0_0_0_2px_var(--lime-deep)]";

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onPointerDown={() => haptic("medium")}
      className="press btn-lime inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[12px] px-4 text-[13.5px] font-bold disabled:opacity-50"
    >
      {pending ? (
        <LoaderCircle size={14} className="animate-spin" />
      ) : (
        <Plus size={14} strokeWidth={2.8} />
      )}
      <span className="relative z-10">Add domain</span>
    </button>
  );
}

function DomainRow({
  organizationId,
  domain,
}: {
  organizationId: string;
  domain: OrgDomain;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const verified = domain.verified_at !== null;

  const run = (fn: () => Promise<DomainState>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <li className="glass-inset rounded-[14px] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="tnum min-w-0 truncate text-[14.5px] font-bold text-ink">
          {domain.domain}
        </span>

        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-bold capitalize",
            domain.kind === "subdomain"
              ? "border border-[var(--line-strong)] text-ink-2"
              : "border border-[var(--line-strong)] text-ink-2",
          )}
        >
          {domain.kind === "subdomain" ? "vinipos.com subdomain" : "custom"}
        </span>

        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
          style={
            verified
              ? { background: "rgb(79 191 106 / 0.14)", color: "var(--ok)" }
              : { background: "rgb(242 169 59 / 0.14)", color: "var(--warn)" }
          }
        >
          {verified ? (
            <CheckCircle2 size={10} strokeWidth={2.8} />
          ) : (
            <LoaderCircle size={10} />
          )}
          {verified ? "Verified" : "Pending DNS"}
        </span>

        {domain.is_primary && (
          <Star
            size={14}
            className="fill-[var(--warn)] text-[var(--warn)]"
            aria-label="Primary domain"
          />
        )}

        <span className="ml-auto flex items-center gap-1.5">
          {!verified && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => markDomainVerifiedAction(organizationId, domain.id))
              }
              className="press glass press-glass inline-flex h-8 items-center gap-1 rounded-[10px] px-2.5 text-[12px] font-bold disabled:opacity-50"
            >
              <BadgeCheck size={12} />
              Mark verified
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            aria-label={`Remove ${domain.domain}`}
            onClick={() => {
              if (
                window.confirm(
                  `Remove ${domain.domain}? Traffic to this host will stop resolving to the org.`,
                )
              ) {
                haptic("medium");
                run(() => removeOrgDomainAction(organizationId, domain.id));
              }
            }}
            className="press inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-muted hover:bg-[rgb(226_86_75_/_0.1)] hover:text-[var(--danger)] disabled:opacity-50"
          >
            {pending ? (
              <LoaderCircle size={13} className="animate-spin" />
            ) : (
              <Trash2 size={13} />
            )}
          </button>
        </span>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold"
          style={{ color: "var(--danger)" }}
        >
          <TriangleAlert size={12} />
          {error}
        </p>
      )}
    </li>
  );
}

export function OrgDomainsCard({
  organizationId,
  domains,
  wired,
}: {
  organizationId: string;
  domains: OrgDomain[];
  /** false when the tenant data layer threw (stub not merged yet). */
  wired: boolean;
}) {
  const action = addOrgDomainAction.bind(null, organizationId);
  const [state, formAction] = useActionState(action, INITIAL);
  const [kind, setKind] = useState<"subdomain" | "custom">("subdomain");

  return (
    <div className="glass rounded-[var(--r-xl)] p-5 sm:p-6">
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]"
            style={{ background: "#14170f" }}
          >
            <Globe size={15} className="text-[var(--lime)]" />
          </span>
          <h2 className="t-h3">Domains</h2>
        </div>

        <p className="mt-3 max-w-xl t-small text-muted">
          Every org gets &lt;slug&gt;.vinipos.com free. Custom domains (e.g.
          pos.krave.com) are added here — client points a CNAME to
          cname.vercel-dns.com.
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
            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
            Domain data is not wired yet — the org_domains table lands with the
            data-layer merge.
          </div>
        ) : domains.length === 0 ? (
          <p className="mt-4 rounded-[12px] px-3.5 py-3 text-[13px] text-muted glass-inset">
            No domains yet. Every org gets &lt;slug&gt;.vinipos.com free. Custom
            domains (e.g. pos.krave.com) are added here — client points a CNAME
            to cname.vercel-dns.com.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {domains.map((d) => (
              <DomainRow key={d.id} organizationId={organizationId} domain={d} />
            ))}
          </ul>
        )}

        <form
          action={formAction}
          className="mt-4 flex flex-wrap items-end gap-2.5"
        >
          <div className="min-w-[220px] flex-1">
            <label htmlFor="domain" className="t-label mb-1.5 block text-muted">
              {kind === "subdomain" ? "Subdomain slug" : "Custom domain"}
            </label>
            <input
              id="domain"
              name="domain"
              required
              placeholder={
                kind === "subdomain" ? "krave" : "pos.krave.com"
              }
              className={FIELD}
            />
            {kind === "subdomain" && (
              <p className="mt-1.5 t-small text-muted">
                Becomes &lt;slug&gt;.vinipos.com
              </p>
            )}
          </div>
          <div>
            <label htmlFor="kind" className="t-label mb-1.5 block text-muted">
              Kind
            </label>
            <select
              id="kind"
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as "subdomain" | "custom")}
              className="glass-inset h-10 rounded-[12px] px-3 text-[13.5px] font-semibold outline-none"
            >
              <option value="subdomain">&lt;slug&gt;.vinipos.com</option>
              <option value="custom">Custom domain</option>
            </select>
          </div>
          <AddButton />
        </form>

        {state.error && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2.5 rounded-[12px] px-3 py-2.5 text-[13px] font-medium"
            style={{
              background: "rgb(226 86 75 / 0.1)",
              color: "var(--danger)",
              border: "1px solid rgb(226 86 75 / 0.24)",
            }}
          >
            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
            {state.error}
          </div>
        )}
      </div>
    </div>
  );
}
