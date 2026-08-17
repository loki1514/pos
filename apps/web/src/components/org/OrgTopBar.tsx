"use client";

import { Bell, LogOut, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  active: { bg: "rgb(79 191 106 / 0.14)", fg: "var(--ok)" },
  onboarding: { bg: "rgb(76 147 232 / 0.14)", fg: "var(--info)" },
  suspended: { bg: "rgb(226 86 75 / 0.12)", fg: "var(--danger)" },
};

export function OrgTopBar({
  email,
  status,
}: {
  email: string;
  status: string;
}) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.onboarding;
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 -mx-4 mb-6 bg-[linear-gradient(180deg,var(--canvas)_0%,var(--canvas)_78%,transparent_100%)] px-4 pb-5 pt-4 sm:-mx-6 sm:px-6">
      <div className="glass flex items-center gap-3 rounded-[18px] p-2.5 pl-16 lg:pl-2.5">
        <div className="relative z-10 flex flex-1 items-center gap-2.5">
          <label className="glass-inset flex h-10 flex-1 items-center gap-2.5 rounded-[13px] px-3.5 sm:max-w-xs">
            <Search size={15} className="shrink-0 text-muted" />
            <input
              type="search"
              placeholder="Search…"
              aria-label="Search"
              className="w-full bg-transparent text-[14px] outline-none placeholder:text-muted/75"
            />
          </label>

          <span
            className={cn(
              "hidden items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-bold capitalize sm:inline-flex",
            )}
            style={{ background: tone.bg, color: tone.fg }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.fg }} />
            {status}
          </span>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <button
            aria-label="Notifications"
            onPointerDown={() => haptic("light")}
            className="press inline-flex h-10 w-10 items-center justify-center rounded-[13px] text-muted hover:bg-[rgb(18_21_15_/_0.06)] hover:text-ink"
          >
            <Bell size={17} />
          </button>

          <div className="mx-0.5 hidden h-7 w-px bg-[var(--line)] sm:block" />

          <span
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold sm:flex"
            style={{ background: "#14170f", color: "var(--lime)" }}
          >
            {initials}
          </span>

          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              onPointerDown={() => haptic("light")}
              className="press inline-flex h-10 w-10 items-center justify-center rounded-[13px] text-muted hover:bg-[rgb(226_86_75_/_0.1)] hover:text-[var(--danger)]"
            >
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
