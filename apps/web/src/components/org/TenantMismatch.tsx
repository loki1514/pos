import Link from "next/link";
import { Building2, ShieldAlert } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

/**
 * Shown when the hostname resolves to one organization but the signed-in user
 * belongs to another — e.g. visiting apple.vinipos.com with a Saffron House
 * login.
 *
 * Deliberately a full stop rather than a dismissible toast: the failure mode
 * being prevented is serving one tenant's data under another tenant's domain,
 * and a toast leaves that data on screen. Nothing tenant-scoped renders
 * behind this.
 */
export function TenantMismatch({
  hostOrgName,
  userOrgName,
  userOrgHost,
}: {
  /** Organization the URL points at. */
  hostOrgName: string;
  /** Organization the signed-in user actually belongs to. */
  userOrgName: string;
  /** Where this user should be instead, if we know it. */
  userOrgHost: string | null;
}) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-5 py-16">
      <div className="relative z-10 w-full max-w-[460px] rise">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={40} withWordmark={false} />
        </div>

        <div className="glass rounded-[var(--r-2xl)] p-6 sm:p-7">
          <div className="relative z-10">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-[14px]"
              style={{ background: "rgb(242 169 59 / 0.16)" }}
            >
              <ShieldAlert size={19} className="text-[var(--warn)]" />
            </span>

            <h1 className="t-h3 mt-4">
              These credentials don&apos;t belong to this organization
            </h1>

            <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
              Check the address before continuing — you&apos;re signed in to a
              different organization than the one this link points at.
            </p>

            <div className="mt-5 space-y-2">
              <Row label="This address is for" value={hostOrgName} tone="warn" />
              <Row label="You're signed in to" value={userOrgName} tone="ok" />
            </div>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              {userOrgHost ? (
                <a
                  href={`https://${userOrgHost}/org`}
                  className="press btn-lime inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[13px] px-4 text-[14px] font-extrabold"
                >
                  <span className="relative z-10 inline-flex items-center gap-2">
                    <Building2 size={15} strokeWidth={2.6} />
                    Go to {userOrgName}
                  </span>
                </a>
              ) : (
                <Link
                  href="/org"
                  className="press btn-lime inline-flex h-11 flex-1 items-center justify-center rounded-[13px] px-4 text-[14px] font-extrabold"
                >
                  <span className="relative z-10">Go to {userOrgName}</span>
                </Link>
              )}

              <form action="/api/auth/logout" method="post" className="flex-1">
                <button
                  type="submit"
                  className="press glass-inset h-11 w-full rounded-[13px] px-4 text-[14px] font-bold text-muted hover:text-ink"
                >
                  Sign in as someone else
                </button>
              </form>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[12.5px] leading-relaxed text-muted">
          Nothing from {hostOrgName} has been loaded.
        </p>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "warn" | "ok";
}) {
  return (
    <div className="glass-inset flex items-center gap-3 rounded-[13px] px-3.5 py-2.5">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: tone === "warn" ? "var(--warn)" : "var(--ok)" }}
      />
      <span className="t-small shrink-0 text-muted">{label}</span>
      <span className="ml-auto truncate text-[14px] font-bold">{value}</span>
    </div>
  );
}
