"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Check,
  Copy,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import {
  regeneratePasswordAction,
  type RegenerateState,
} from "@/app/admin/organizations/actions";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/cn";

const INITIAL: RegenerateState = { ok: false, error: null, credentials: null };

function CopyRow({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        haptic("light");
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="press glass-inset flex w-full items-center justify-between gap-3 rounded-[12px] px-3.5 py-2.5 text-left"
    >
      <span className="tnum truncate text-[14px] font-bold">{value}</span>
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
  );
}

function RegenerateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      onPointerDown={() => haptic("medium")}
      disabled={pending}
      className="press glass press-glass inline-flex h-9 items-center gap-1.5 rounded-[11px] px-3 text-[12.5px] font-bold disabled:opacity-50"
    >
      {pending ? (
        <LoaderCircle size={13} className="animate-spin" />
      ) : (
        <RefreshCw size={13} />
      )}
      Regenerate password
    </button>
  );
}

export function AdminCredentialCard({
  organizationId,
  adminEmail,
}: {
  organizationId: string;
  adminEmail: string | null;
}) {
  const action = regeneratePasswordAction.bind(null, organizationId);
  const [state, formAction] = useActionState(action, INITIAL);

  return (
    <div className="glass rounded-[var(--r-xl)] p-5 sm:p-6">
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]"
              style={{ background: "#14170f" }}
            >
              <KeyRound size={15} className="text-[var(--lime)]" />
            </span>
            <h2 className="t-h3">Admin login</h2>
          </div>

          {adminEmail && (
            <form action={formAction}>
              <RegenerateButton />
            </form>
          )}
        </div>

        {!adminEmail ? (
          <p className="mt-4 t-small text-muted">
            No admin login exists for this organization yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <div>
              <span className="t-label mb-1.5 block text-muted">Email</span>
              <CopyRow value={adminEmail} />
            </div>

            {state.credentials && (
              <div>
                <span className="t-label mb-1.5 block text-muted">
                  New password
                </span>
                <CopyRow value={state.credentials.password} />
                <p className="mt-2 t-small text-muted">
                  Shown once. The previous password no longer works.
                </p>
              </div>
            )}

            {state.error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-[12px] px-3 py-2.5 text-[13px] font-medium"
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
        )}
      </div>
    </div>
  );
}
