"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Blocks,
  Building2,
  ChefHat,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/locations", label: "Locations", icon: MapPin },
  { href: "/admin/operations", label: "Operations", icon: ChefHat },
  { href: "/admin/roles", label: "Roles", icon: ShieldCheck },
  { href: "/admin/modules", label: "Modules", icon: Blocks },
];

const FOOT = [
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
];

function Item({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Building2;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onPointerDown={() => haptic("light")}
      className={cn(
        "press group relative flex h-11 w-11 items-center justify-center rounded-[14px]",
        active
          ? "btn-lime"
          : "text-white/45 hover:bg-white/[0.07] hover:text-white",
      )}
    >
      <Icon size={18} strokeWidth={2.1} className="relative z-10" />
      <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-[10px] bg-[#14170f] px-2.5 py-1.5 text-[12px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 lg:block">
        {label}
      </span>
    </Link>
  );
}

export function Rail() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <>
      {/* Desktop rail */}
      <aside className="fixed left-4 top-4 bottom-4 z-40 hidden w-[68px] flex-col items-center rounded-[24px] py-4 glass-dark md:flex">
        <Link href="/" aria-label="Vini POS home" className="press mb-5">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-[13px]"
            style={{
              background:
                "linear-gradient(180deg, var(--lime-bright), var(--lime-deep))",
              boxShadow: "0 6px 18px -4px rgb(121 188 13 / .7)",
            }}
          >
            <span className="text-[17px] font-extrabold text-[var(--lime-ink)]">
              V
            </span>
          </span>
        </Link>

        <nav className="flex flex-col items-center gap-1.5">
          {NAV.map((n) => (
            <Item key={n.href} {...n} active={isActive(n.href)} />
          ))}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-1.5">
          <div className="my-2 h-px w-7 bg-white/10" />
          {FOOT.map((n) => (
            <Item key={n.href} {...n} active={isActive(n.href)} />
          ))}
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-[20px] px-2 py-2 glass-dark md:hidden">
        {NAV.slice(0, 5).map((n) => (
          <Item key={n.href} {...n} active={isActive(n.href)} />
        ))}
      </nav>
    </>
  );
}
