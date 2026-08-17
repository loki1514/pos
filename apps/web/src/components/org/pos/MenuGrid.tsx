"use client";

import * as React from "react";
import { ImageOff, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import type { MenuCategory, MenuItem } from "@/lib/pos";
import { inr } from "./format";

export function MenuGrid({
  categories,
  items,
  onPick,
}: {
  categories: MenuCategory[];
  items: MenuItem[];
  onPick: (item: MenuItem) => void;
}) {
  const [categoryId, setCategoryId] = React.useState<string>("all");
  const [query, setQuery] = React.useState("");

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (categoryId !== "all" && it.category_id !== categoryId) return false;
      if (!q) return true;
      return (
        it.name.toLowerCase().includes(q) ||
        (it.sku ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, categoryId, query]);

  return (
    <div className="space-y-3">
      {/* Search */}
      <label className="glass-inset flex h-12 items-center gap-2.5 rounded-[var(--r-md)] px-4">
        <Search size={17} className="shrink-0 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or SKU…"
          className="w-full bg-transparent text-[15px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-muted"
        />
      </label>

      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {[{ id: "all", name: "All Items" }, ...categories].map((c) => {
          const active = categoryId === c.id;
          return (
            <button
              key={c.id}
              onPointerDown={() => haptic("light")}
              onClick={() => setCategoryId(c.id)}
              className={cn(
                "press h-11 shrink-0 rounded-[var(--r-md)] border px-4 text-[14px] font-bold whitespace-nowrap transition-colors",
                active
                  ? "border-transparent bg-[#14170f] text-white shadow-[inset_0_1px_0_rgb(255_255_255_/_0.14)]"
                  : "glass-solid text-ink-2 hover:text-ink",
              )}
            >
              <span className="relative z-10">{c.name}</span>
            </button>
          );
        })}
      </div>

      {/* Item grid */}
      {visible.length === 0 ? (
        <div className="glass-solid rounded-[var(--r-lg)] px-6 py-12 text-center">
          <p className="relative z-10 text-[14.5px] font-semibold text-muted">
            No dishes match{query ? ` “${query}”` : " this filter"}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
          {visible.map((it) => (
            <button
              key={it.id}
              disabled={!it.is_available}
              onPointerDown={() => haptic("light")}
              onClick={() => onPick(it)}
              className={cn(
                "press glass-solid group relative flex min-h-[132px] flex-col overflow-hidden rounded-[var(--r-lg)] text-left",
                "disabled:opacity-45 disabled:pointer-events-none",
              )}
            >
              <span className="relative z-10 block h-[72px] w-full overflow-hidden bg-[var(--canvas-2)]">
                {it.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.image_url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-muted">
                    <ImageOff size={20} strokeWidth={1.5} />
                  </span>
                )}
                {!it.is_available && (
                  <span className="absolute inset-x-0 bottom-0 bg-[rgb(18_21_15_/_0.72)] py-0.5 text-center text-[10.5px] font-bold tracking-wide text-white uppercase">
                    Sold out
                  </span>
                )}
              </span>
              <span className="relative z-10 flex flex-1 flex-col justify-between gap-1 p-3">
                <span className="line-clamp-2 text-[14.5px] leading-snug font-bold">
                  {it.name}
                </span>
                <span className="flex items-center justify-between">
                  <span className="tnum text-[15px] font-extrabold text-[var(--lime-deep)]">
                    {inr(it.price)}
                  </span>
                  {it.sku && (
                    <span className="text-[11px] font-semibold text-muted">
                      {it.sku}
                    </span>
                  )}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
