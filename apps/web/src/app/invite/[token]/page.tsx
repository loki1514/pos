import type { Metadata } from "next";
import Link from "next/link";
import { Link2Off, TimerOff } from "lucide-react";
import { Aurora } from "@/components/ui/Aurora";
import { Logo } from "@/components/brand/Logo";
import { InviteSignupForm } from "./InviteSignupForm";
import { getInviteDetails } from "@/lib/invites";

export const metadata: Metadata = { title: "Accept invite" };
export const dynamic = "force-dynamic";

function DeadLink({
  icon: Icon,
  title,
  blurb,
}: {
  icon: typeof Link2Off;
  title: string;
  blurb: string;
}) {
  return (
    <div className="text-center">
      <span
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-[16px]"
        style={{ background: "#14170f" }}
      >
        <Icon size={20} className="text-[var(--warn)]" />
      </span>
      <h1 className="t-h2 mt-4">{title}</h1>
      <p className="mt-2 text-[14.5px] text-muted">{blurb}</p>
      <Link
        href="/login"
        className="press mt-6 inline-flex h-10 items-center rounded-[12px] px-4 text-[13.5px] font-bold text-muted hover:text-ink"
      >
        Back to sign in
      </Link>
    </div>
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await getInviteDetails(token);

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-5 py-10">
      <Aurora />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo size={30} />
        </div>

        <div className="glass rise rounded-[var(--r-2xl)] p-6 sm:p-7">
          <div className="relative z-10">
            {!invite ? (
              <DeadLink
                icon={Link2Off}
                title="Link not found"
                blurb="This invite link doesn't exist. Check the link you were sent, or ask for a new one."
              />
            ) : invite.used ? (
              <DeadLink
                icon={Link2Off}
                title="Already used"
                blurb="This invite link has already been used to create an account. Sign in instead, or ask for a fresh link."
              />
            ) : invite.expired ? (
              <DeadLink
                icon={TimerOff}
                title="Link expired"
                blurb="Invite links live for 7 days. Ask your administrator to generate a new one."
              />
            ) : (
              <>
                <h1 className="t-h2">Join {invite.orgName}</h1>
                <p className="mt-2 text-[14.5px] text-muted">
                  You&apos;ve been invited as{" "}
                  <span className="font-bold text-ink">{invite.roleName}</span>.
                  Set your details below — you&apos;ll use them to sign in.
                </p>
                <div className="mt-5">
                  <InviteSignupForm token={token} roleName={invite.roleName} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
