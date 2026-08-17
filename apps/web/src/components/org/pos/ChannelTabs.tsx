"use client";

import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import type { OrderChannel } from "@/lib/pos";

export type ChannelFilter = "all" | OrderChannel;

export const CHANNEL_TABS: { key: ChannelFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "dine_in", label: "Dine In" },
  { key: "delivery", label: "Delivery" },
  { key: "pickup", label: "Pick Up" },
  { key: "online", label: "Online" },
  { key: "swiggy", label: "Swiggy" },
  { key: "zomato", label: "Zomato" },
  { key: "other", label: "Other" },
];

export function ChannelTabs({
  value,
  onChange,
  counts,
}: {
  value: ChannelFilter;
  onChange: (c: ChannelFilter) => void;
  counts: Partial<Record<ChannelFilter, number>>;
}) {
  return (
    <div
      role="tablist"
      aria-label="Order channels"
      className="glass-inset flex gap-1 overflow-x-auto rounded-full p-1"
    >
      {CHANNEL_TABS.map((t) => {
        const active = value === t.key;
        const count = counts[t.key];
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onPointerDown={() => haptic("light")}
            onClick={() => onChange(t.key)}
            className={cn(
              "press relative flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold whitespace-nowrap transition-colors",
              active
                ? "btn-lime"
                : "text-ink-2 hover:bg-[rgb(18_21_15_/_0.05)] hover:text-ink",
            )}
          >
            <span className="relative z-10">{t.label}</span>
            {typeof count === "number" && count > 0 && (
              <span
                className={cn(
                  "relative z-10 rounded-full px-1.5 py-0.5 text-[11px] font-extrabold tnum",
                  active ? "bg-[rgb(26_40_0_/_0.16)]" : "bg-[rgb(18_21_15_/_0.08)] text-muted",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
