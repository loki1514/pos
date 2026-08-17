"use client";

import { ArrowRight, Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import type { Order, OrderStatus } from "@/lib/pos";
import { elapsed, inr } from "./format";

const STATUS_STYLE: Record<OrderStatus, { bg: string; fg: string; label: string }> = {
  new: { bg: "rgb(76 147 232 / 0.14)", fg: "var(--info)", label: "New" },
  in_billing: { bg: "rgb(18 21 15 / 0.07)", fg: "var(--muted)", label: "Billing" },
  sent_to_kitchen: { bg: "rgb(242 169 59 / 0.16)", fg: "var(--warn)", label: "In kitchen" },
  awaiting_payment: { bg: "rgb(226 86 75 / 0.14)", fg: "var(--danger)", label: "Due" },
  paid: { bg: "rgb(79 191 106 / 0.16)", fg: "var(--ok)", label: "Paid" },
  delivered: { bg: "rgb(79 191 106 / 0.16)", fg: "var(--ok)", label: "Delivered" },
  cancelled: { bg: "rgb(18 21 15 / 0.07)", fg: "var(--muted)", label: "Cancelled" },
};

export function PendingStrip({
  orders,
  tableLabel,
  itemCounts,
  activeOrderId,
  now,
  onOpen,
}: {
  orders: Order[];
  tableLabel: (tableId: string | null) => string | null;
  itemCounts: Map<string, number>;
  activeOrderId: string | null;
  now: number;
  onOpen: (order: Order) => void;
}) {
  if (orders.length === 0) return null;

  return (
    <section aria-label="Pending orders" className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="t-label text-muted">Pending orders</h2>
        <span className="t-small tnum text-muted">{orders.length} open</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {orders.map((o) => {
          const st = STATUS_STYLE[o.status] ?? STATUS_STYLE.new;
          const table = tableLabel(o.table_id);
          const active = o.id === activeOrderId;
          return (
            <div
              key={o.id}
              className={cn(
                "glass-solid flex w-[240px] shrink-0 flex-col gap-2 rounded-[var(--r-lg)] p-3.5",
                active && "ring-2 ring-[var(--lime-deep)]",
              )}
            >
              <div className="relative z-10 flex items-center gap-2">
                <span className="tnum text-[15px] font-extrabold">{o.display_no}</span>
                <span
                  className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{ background: st.bg, color: st.fg }}
                >
                  {st.label}
                </span>
              </div>
              <div className="relative z-10 flex items-center gap-2 text-[12.5px] font-semibold text-muted">
                <span className="truncate">
                  {table ?? o.customer_name ?? "Quick bill"}
                </span>
                <span className="ml-auto inline-flex shrink-0 items-center gap-1 tnum">
                  <Clock size={12} />
                  {elapsed(o.created_at, now)}
                </span>
              </div>
              <div className="relative z-10 flex items-center gap-2">
                <span className="t-small tnum text-muted">
                  {itemCounts.get(o.id) ?? 0} items
                </span>
                <span className="tnum ml-auto text-[15px] font-extrabold">
                  {inr(o.total)}
                </span>
                <button
                  onPointerDown={() => haptic("light")}
                  onClick={() => onOpen(o)}
                  className="press btn-lime inline-flex h-9 items-center gap-1 rounded-[10px] px-3 text-[13px] font-bold"
                >
                  <span className="relative z-10 inline-flex items-center gap-1">
                    Open <ArrowRight size={14} />
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
