"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const LINKS = [
  { label: "Platform", href: "#platform" },
  { label: "Modules", href: "#modules" },
  { label: "Workflows", href: "#workflows" },
  { label: "Roles", href: "#roles" },
];

export function Nav() {
  const [lifted, setLifted] = useState(false);

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        className={cn(
          "flex w-full max-w-6xl items-center gap-3 rounded-[22px] px-3 py-2.5 transition-all duration-500",
          lifted ? "glass" : "border border-transparent",
        )}
      >
        <Link href="/" className="relative z-10 shrink-0 pl-1.5">
          <Logo size={30} />
        </Link>

        <div className="relative z-10 mx-auto hidden items-center gap-0.5 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="press rounded-[11px] px-3.5 py-2 text-[14px] font-semibold text-muted transition-colors hover:bg-[rgb(18_21_15_/_0.05)] hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="relative z-10 ml-auto flex items-center gap-2 md:ml-0">
          <ButtonLink href="/login" variant="ghost" size="sm">
            Sign in
          </ButtonLink>
          <ButtonLink href="/login" variant="lime" size="sm">
            Open console
          </ButtonLink>
        </div>
      </nav>
    </header>
  );
}
