"use client";

import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";

type Variant = "lime" | "glass" | "ghost" | "dark";
type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13.5px] rounded-[10px] gap-1.5",
  md: "h-11 px-5 text-[14.5px] rounded-[14px] gap-2",
  lg: "h-[52px] px-7 text-[15.5px] rounded-[16px] gap-2.5",
};

const VARIANTS: Record<Variant, string> = {
  lime: "btn-lime press press-lime font-bold",
  glass: "glass press press-glass text-ink font-semibold",
  ghost:
    "press text-ink-2 font-semibold hover:text-ink hover:bg-[rgb(18_21_15_/_0.045)] border border-transparent",
  dark: "press press-glass font-semibold text-white bg-[#14170f] border border-[rgb(255_255_255_/_0.1)] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.14),0_10px_30px_-10px_rgb(18_21_15_/_0.5)]",
};

const BASE =
  "relative inline-flex items-center justify-center select-none whitespace-nowrap " +
  "disabled:opacity-45 disabled:pointer-events-none";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
  /** Haptic weight fired on pointerdown. `false` disables. */
  feedback?: "light" | "medium" | "heavy" | false;
};

export function Button({
  variant = "glass",
  size = "md",
  className,
  children,
  feedback = "light",
  onPointerDown,
  ...rest
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(BASE, SIZES[size], VARIANTS[variant], className)}
      onPointerDown={(e) => {
        if (feedback) haptic(feedback);
        onPointerDown?.(e);
      }}
      {...rest}
    >
      <span className="relative z-10 inline-flex items-center gap-[inherit]">
        {children}
      </span>
    </button>
  );
}

export function ButtonLink({
  variant = "glass",
  size = "md",
  className,
  children,
  feedback = "light",
  href,
  ...rest
}: CommonProps & { href: string } & Omit<
    React.ComponentProps<typeof Link>,
    "href" | "children" | "className"
  >) {
  return (
    <Link
      href={href}
      className={cn(BASE, SIZES[size], VARIANTS[variant], className)}
      onPointerDown={() => feedback && haptic(feedback)}
      {...rest}
    >
      <span className="relative z-10 inline-flex items-center gap-[inherit]">
        {children}
      </span>
    </Link>
  );
}

/** Square icon button — used in the admin rail and top bar. */
export function IconButton({
  className,
  children,
  label,
  active,
  feedback = "light",
  onPointerDown,
  ...rest
}: {
  label: string;
  active?: boolean;
  feedback?: "light" | "medium" | false;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "press relative inline-flex h-11 w-11 items-center justify-center rounded-[14px]",
        active
          ? "btn-lime"
          : "text-muted hover:text-ink hover:bg-[rgb(18_21_15_/_0.05)]",
        className,
      )}
      onPointerDown={(e) => {
        if (feedback) haptic(feedback);
        onPointerDown?.(e);
      }}
      {...rest}
    >
      <span className="relative z-10">{children}</span>
    </button>
  );
}
