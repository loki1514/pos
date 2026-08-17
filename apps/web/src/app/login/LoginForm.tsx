"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { haptic } from "@/lib/haptics";

const FIELD =
  "glass-inset h-12 w-full rounded-[14px] px-4 text-[15px] font-medium " +
  "outline-none transition-shadow placeholder:text-muted/70 " +
  "focus:shadow-[inset_0_0_0_2px_var(--lime-deep)]";

/** Where each role lands, and which paths it is actually allowed to reach. */
const ROLE_HOME: Record<string, string> = {
  super_admin: "/admin",
  org_admin: "/org",
};

const ROLE_ALLOWED: Record<string, string[]> = {
  super_admin: ["/admin"],
  org_admin: ["/org"],
};

/**
 * A captured `next` is only honoured when the signed-in role can actually
 * reach it. Otherwise an org admin arriving at /login?next=/admin would be
 * sent to /admin, bounced back by proxy.ts, and loop forever.
 * Also rejects protocol-relative URLs, which would be an open redirect.
 */
function resolveDestination(role: string, next: string | null): string {
  const home = ROLE_HOME[role] ?? "/";
  if (!next) return home;
  if (!next.startsWith("/") || next.startsWith("//")) return home;

  const allowed = ROLE_ALLOWED[role] ?? [];
  return allowed.some((prefix) => next.startsWith(prefix)) ? next : home;
}

function Form() {
  const router = useRouter();
  const params = useSearchParams();
  const explicitNext = params.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        role?: string;
      };

      if (!res.ok) {
        setError(data.error ?? "Sign in failed. Try again.");
        haptic("warn");
        setBusy(false);
        return;
      }

      haptic("success");
      router.replace(resolveDestination(data.role ?? "", explicitNext));
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="t-label mb-2 block text-muted">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@vinipos.com"
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="password" className="t-label mb-2 block text-muted">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={reveal ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
            className={`${FIELD} pr-12`}
          />
          <button
            type="button"
            aria-label={reveal ? "Hide password" : "Show password"}
            onClick={() => setReveal((v) => !v)}
            className="press absolute right-1.5 top-1.5 inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-muted hover:bg-[rgb(18_21_15_/_0.06)] hover:text-ink"
          >
            {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-[13px] px-3.5 py-3 text-[13.5px] font-medium"
          style={{
            background: "rgb(226 86 75 / 0.1)",
            color: "var(--danger)",
            border: "1px solid rgb(226 86 75 / 0.24)",
          }}
        >
          <TriangleAlert size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <Button
        type="submit"
        variant="lime"
        size="lg"
        disabled={busy}
        feedback="medium"
        className="w-full"
      >
        {busy ? (
          <>
            <LoaderCircle size={17} className="animate-spin" />
            Signing in…
          </>
        ) : (
          <>
            Sign in
            <ArrowRight size={17} strokeWidth={2.6} />
          </>
        )}
      </Button>
    </form>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={<div className="h-[300px]" />}>
      <Form />
    </Suspense>
  );
}
