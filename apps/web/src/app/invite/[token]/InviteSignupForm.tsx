"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react";
import { acceptInviteAction, type AcceptState } from "@/app/invite/actions";
import { haptic } from "@/lib/haptics";

const INITIAL: AcceptState = { ok: false, error: null, orgName: null };

const FIELD =
  "glass-inset h-11 w-full rounded-[13px] px-3.5 text-[14.5px] outline-none placeholder:text-muted/75 focus:border-[var(--lime-deep)]";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onPointerDown={() => haptic("medium")}
      className="press btn-lime inline-flex h-11 w-full items-center justify-center gap-2 rounded-[13px] text-[14.5px] font-extrabold disabled:opacity-50"
    >
      {pending && <LoaderCircle size={15} className="animate-spin" />}
      Create account
    </button>
  );
}

export function InviteSignupForm({
  token,
  roleName,
}: {
  token: string;
  roleName: string;
}) {
  const action = acceptInviteAction.bind(null, token);
  const [state, formAction] = useActionState(action, INITIAL);

  if (state.ok) {
    return (
      <div className="text-center">
        <span
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "rgb(79 191 106 / 0.14)" }}
        >
          <CheckCircle2 size={22} className="text-[var(--ok)]" />
        </span>
        <h2 className="t-h3 mt-4">You&apos;re in</h2>
        <p className="mt-2 text-[14.5px] text-muted">
          Your {roleName} account for {state.orgName} is ready. Sign in with
          the email and password you just set.
        </p>
        <Link
          href="/login"
          className="press btn-lime mt-6 inline-flex h-11 w-full items-center justify-center rounded-[13px] text-[14.5px] font-extrabold"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="fullName" className="t-label mb-1.5 block text-muted">
          Full name
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          autoComplete="name"
          placeholder="Asha Rao"
          className={FIELD}
        />
      </div>
      <div>
        <label htmlFor="email" className="t-label mb-1.5 block text-muted">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={FIELD}
        />
      </div>
      <div>
        <label htmlFor="password" className="t-label mb-1.5 block text-muted">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className={FIELD}
        />
      </div>

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

      <SubmitButton />
    </form>
  );
}
