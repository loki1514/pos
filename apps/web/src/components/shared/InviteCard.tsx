"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Check,
  Copy,
  Link2,
  LoaderCircle,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import type { InviteSummary } from "@/lib/invites";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/cn";

export type InviteActionState = {
  ok: boolean;
  error: string | null;
  url: string | null;
};

const INITIAL: InviteActionState = { ok: false, error: null, url: null };

function GenerateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      onPointerDown={() => haptic("medium")}
      disabled={pending}
      className="press btn-lime inline-flex h-10 items-center gap-2 rounded-[12px] px-4 text-[13px] font-extrabold disabled:opacity-50"
    >
      {pending ? (
        <LoaderCircle size={14} className="animate-spin" />
      ) : (
        <UserPlus size={14} strokeWidth={2.6} />
      )}
      Generate link
    </button>
  );
}

function InviteStatus({ invite }: { invite: InviteSummary }) {
  const tone = {
    used: { bg: "rgb(79 191 106 / 0.14)", fg: "var(--ok)" },
    expired: { bg: "rgb(226 86 75 / 0.12)", fg: "var(--danger)" },
    open: { bg: "rgb(76 147 232 / 0.14)", fg: "var(--info)" },
  }[invite.state];

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold capitalize"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {invite.state}
    </span>
  );
}

/**
 * Shared by both the super-admin org detail page and the org admin's own
 * Users & Roles page. The two surfaces differ only in who is authorized to
 * call the action — the action itself is passed in already bound to a
 * (organizationId, roleId) pair, so this component never needs to know
 * which caller it's rendering for.
 */
type CreateAction = (
  organizationId: string,
  roleId: string,
  prevState: InviteActionState,
) => Promise<InviteActionState>;

export function InviteCard({
  title = "Invite links",
  organizationId,
  createAction,
  roles,
  invites,
}: {
  title?: string;
  organizationId: string;
  /** The org-scoped and super-admin actions share this exact shape — only the authorization inside differs. */
  createAction: CreateAction;
  roles: { id: string; name: string; slug: string }[];
  invites: InviteSummary[];
}) {
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  // Re-bound on every render so the action always closes over the currently
  // selected role — matches how this worked before the component was shared.
  const action = createAction.bind(null, organizationId, roleId);
  const [state, formAction] = useActionState(action, INITIAL);
  const [copied, setCopied] = useState(false);

  return (
    <div className="glass rounded-[var(--r-xl)] p-5 sm:p-6">
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]"
            style={{ background: "#14170f" }}
          >
            <Link2 size={15} className="text-[var(--lime)]" />
          </span>
          <h2 className="t-h3">{title}</h2>
        </div>

        <p className="mt-3 t-small text-muted">
          Generate a signup link for a role and send it to the person. They set
          their own email and password, then sign in through the normal login.
          Each link works once and expires in 7 days.
        </p>

        <form action={formAction} className="mt-4 flex flex-wrap items-center gap-2.5">
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            aria-label="Role for the invite"
            className="glass-inset h-10 rounded-[12px] px-3 text-[13.5px] font-semibold outline-none"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <GenerateButton />
        </form>

        {state.url && (
          <div className="mt-3">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(state.url!);
                haptic("light");
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }}
              className="press glass-inset flex w-full items-center justify-between gap-3 rounded-[12px] px-3.5 py-2.5 text-left"
            >
              <span className="tnum truncate text-[13px] font-bold">{state.url}</span>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 text-[11.5px] font-bold",
                  copied ? "text-[var(--ok)]" : "text-muted",
                )}
              >
                {copied ? (
                  <>
                    <Check size={12} strokeWidth={3} /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={12} /> Copy
                  </>
                )}
              </span>
            </button>
          </div>
        )}

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

        {invites.length > 0 && (
          <ul className="mt-5 divide-y divide-[var(--line)]">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-bold leading-tight">
                    {inv.role_name}
                  </span>
                  <span className="block truncate text-[12px] text-muted">
                    {inv.accepted_email ??
                      `Created ${new Date(inv.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                  </span>
                </span>
                <span className="ml-auto">
                  <InviteStatus invite={inv} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
