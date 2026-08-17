"use client";

import * as React from "react";
import { Bike, ChefHat, Minus, Plus, ShoppingCart, Store, Trash2, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import type { DiningTable, Order, OrderChannel, OrderItem, PaymentMethod } from "@/lib/pos";
import { inr } from "./format";

const MODES: { key: OrderChannel; label: string; icon: React.ReactNode }[] = [
  { key: "dine_in", label: "Dine In", icon: <UtensilsCrossed size={15} /> },
  { key: "pickup", label: "Takeaway", icon: <Store size={15} /> },
  { key: "delivery", label: "Delivery", icon: <Bike size={15} /> },
];

const PAYMENTS: { key: PaymentMethod; label: string }[] = [
  { key: "cash", label: "Cash" },
  { key: "upi", label: "UPI" },
  { key: "card", label: "Card" },
  { key: "split", label: "Split" },
];

const TENDER_QUICK = [100, 200, 500, 2000];

export function OrderSummary({
  order,
  lines,
  tables,
  channel,
  tableId,
  customerName,
  customerPhone,
  paymentMethod,
  tendered,
  busy,
  onMode,
  onTable,
  onCustomerName,
  onCustomerPhone,
  onQty,
  onRemove,
  onPaymentMethod,
  onTendered,
  onSettle,
  onSendToKitchen,
  onNewBill,
}: {
  order: Order | null;
  lines: OrderItem[];
  tables: DiningTable[];
  channel: OrderChannel;
  tableId: string | null;
  customerName: string;
  customerPhone: string;
  paymentMethod: PaymentMethod;
  tendered: number | null;
  busy: boolean;
  onMode: (c: OrderChannel) => void;
  onTable: (id: string | null) => void;
  onCustomerName: (v: string) => void;
  onCustomerPhone: (v: string) => void;
  onQty: (item: OrderItem, qty: number) => void;
  onRemove: (item: OrderItem) => void;
  onPaymentMethod: (m: PaymentMethod) => void;
  onTendered: (v: number | null) => void;
  onSettle: () => void;
  onSendToKitchen: () => void;
  onNewBill: () => void;
}) {
  const subtotal = order ? Number(order.subtotal) : 0;
  const gstPct = order ? Number(order.gst_pct) : 5;
  const gstAmount = order ? Number(order.gst_amount) : 0;
  const total = order ? Number(order.total) : 0;
  const empty = lines.length === 0;
  const isIntegration = !MODES.some((m) => m.key === channel);
  const change = tendered !== null ? tendered - total : null;

  return (
    <aside className="glass flex flex-col rounded-[var(--r-xl)] lg:sticky lg:top-4 lg:max-h-[calc(100dvh-120px)]">
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
          <h2 className="t-h3">Order Summary</h2>
          {order && (
            <span className="tnum rounded-full bg-[#14170f] px-2 py-0.5 text-[11px] font-bold text-white">
              {order.display_no}
            </span>
          )}
          {order && (
            <button
              onClick={onNewBill}
              className="press t-label ml-auto rounded-full border border-[var(--line-strong)] px-2.5 py-1 text-muted hover:text-ink"
            >
              New bill
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {/* Mode toggle */}
          <div className="glass-inset grid grid-cols-3 gap-1 rounded-[var(--r-md)] p-1">
            {MODES.map((m) => {
              const active = channel === m.key;
              return (
                <button
                  key={m.key}
                  onPointerDown={() => haptic("light")}
                  onClick={() => onMode(m.key)}
                  className={cn(
                    "press flex h-11 items-center justify-center gap-1.5 rounded-[10px] text-[13.5px] font-bold",
                    active ? "btn-lime" : "text-ink-2 hover:text-ink",
                  )}
                >
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    {m.icon}
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
          {isIntegration && (
            <p className="t-small px-1 font-semibold text-muted">
              Channel: <span className="font-bold text-ink capitalize">{channel}</span> — set
              by the integration tab above.
            </p>
          )}

          {/* Table + customer */}
          {channel === "dine_in" && (
            <label className="block">
              <span className="t-label text-muted">Table</span>
              <select
                value={tableId ?? ""}
                onChange={(e) => onTable(e.target.value || null)}
                className="glass-inset mt-1 h-11 w-full rounded-[var(--r-md)] px-3 text-[14.5px] font-semibold text-ink outline-none"
              >
                <option value="">No table — quick bill</option>
                {tables
                  .filter((t) => t.is_active)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} · {t.seats} seats
                    </option>
                  ))}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input
              value={customerName}
              onChange={(e) => onCustomerName(e.target.value)}
              placeholder="Customer name (optional)"
              className="glass-inset h-11 rounded-[var(--r-md)] px-3 text-[14px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-muted"
            />
            <input
              value={customerPhone}
              onChange={(e) => onCustomerPhone(e.target.value)}
              placeholder="Phone (optional)"
              inputMode="tel"
              className="glass-inset h-11 rounded-[var(--r-md)] px-3 text-[14px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-muted"
            />
          </div>

          {/* Lines */}
          {empty ? (
            <div className="flex flex-col items-center gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--line-strong)] px-4 py-10 text-center">
              <ShoppingCart size={26} strokeWidth={1.6} className="text-muted" />
              <p className="text-[14.5px] font-bold">Cart is empty</p>
              <p className="t-small text-muted">Tap any dish to start a bill.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {lines.map((l) => (
                <li key={l.id} className="flex items-center gap-2.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] leading-tight font-bold">{l.name}</p>
                    <p className="tnum text-[12px] font-semibold text-muted">
                      {inr(l.unit_price)}
                      {l.notes ? ` · ${l.notes}` : ""}
                      {Array.isArray(l.add_ons) && l.add_ons.length > 0
                        ? ` · +${l.add_ons.length} add-on${l.add_ons.length > 1 ? "s" : ""}`
                        : ""}
                    </p>
                  </div>
                  <div className="glass-inset flex items-center gap-0.5 rounded-full p-0.5">
                    <button
                      aria-label={`Decrease ${l.name}`}
                      disabled={busy}
                      onClick={() => (l.qty <= 1 ? onRemove(l) : onQty(l, l.qty - 1))}
                      className="press flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:text-ink disabled:opacity-40"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="tnum w-6 text-center text-[14px] font-extrabold">
                      {l.qty}
                    </span>
                    <button
                      aria-label={`Increase ${l.name}`}
                      disabled={busy}
                      onClick={() => onQty(l, l.qty + 1)}
                      className="press flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:text-ink disabled:opacity-40"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="tnum w-[72px] text-right text-[14px] font-extrabold">
                    {inr(l.qty * l.unit_price)}
                  </span>
                  <button
                    aria-label={`Remove ${l.name}`}
                    disabled={busy}
                    onClick={() => onRemove(l)}
                    className="press flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-[var(--danger)] disabled:opacity-40"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Totals + payment */}
        <div className="space-y-3 border-t border-[var(--line)] px-4 py-3">
          <div className="space-y-1">
            <div className="tnum flex justify-between text-[13.5px] font-semibold text-muted">
              <span>Subtotal</span>
              <span>{inr(subtotal)}</span>
            </div>
            <div className="tnum flex justify-between text-[13.5px] font-semibold text-muted">
              <span>GST ({gstPct}%)</span>
              <span>{inr(gstAmount)}</span>
            </div>
            <div className="tnum flex items-baseline justify-between pt-1">
              <span className="text-[16px] font-extrabold">Total</span>
              <span className="text-[26px] leading-none font-extrabold tracking-tight">
                {inr(total)}
              </span>
            </div>
          </div>

          {/* Payment methods */}
          <div className="grid grid-cols-4 gap-1.5">
            {PAYMENTS.map((p) => {
              const active = paymentMethod === p.key;
              return (
                <button
                  key={p.key}
                  onPointerDown={() => haptic("light")}
                  onClick={() => onPaymentMethod(p.key)}
                  className={cn(
                    "press h-12 rounded-[var(--r-md)] border text-[13.5px] font-bold",
                    active
                      ? "border-transparent bg-[#14170f] text-white shadow-[inset_0_1px_0_rgb(255_255_255_/_0.14)]"
                      : "glass-solid text-ink-2 hover:text-ink",
                  )}
                >
                  <span className="relative z-10">{p.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tendered (cash) */}
          {paymentMethod === "cash" && (
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                {TENDER_QUICK.map((amt) => (
                  <button
                    key={amt}
                    onPointerDown={() => haptic("light")}
                    onClick={() => onTendered(amt)}
                    className={cn(
                      "press tnum h-10 flex-1 rounded-[10px] border text-[13px] font-bold",
                      tendered === amt
                        ? "border-transparent bg-[#14170f] text-white"
                        : "glass-solid text-ink-2 hover:text-ink",
                    )}
                  >
                    <span className="relative z-10">₹{amt}</span>
                  </button>
                ))}
                <button
                  onPointerDown={() => haptic("light")}
                  onClick={() => onTendered(Math.ceil(total))}
                  className="press h-10 flex-1 rounded-[10px] border border-[var(--line-strong)] text-[13px] font-bold text-ink-2 hover:text-ink"
                >
                  Exact
                </button>
              </div>
              {change !== null && change >= 0 && (
                <p className="tnum text-right text-[13px] font-bold text-[var(--ok)]">
                  Change to return: {inr(change)}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button
              disabled={empty || busy}
              onPointerDown={() => haptic("medium")}
              onClick={onSettle}
              className="press btn-lime h-[54px] rounded-[var(--r-md)] text-[16px] font-extrabold disabled:opacity-45 disabled:pointer-events-none"
            >
              <span className="relative z-10">Proceed to Pay · {inr(total)}</span>
            </button>
            <button
              disabled={empty || busy}
              onPointerDown={() => haptic("medium")}
              onClick={onSendToKitchen}
              className="press flex h-[54px] items-center gap-2 rounded-[var(--r-md)] border border-transparent bg-[#14170f] px-5 text-[15px] font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255_/_0.14)] disabled:opacity-45 disabled:pointer-events-none"
            >
              <ChefHat size={17} />
              Send to Kitchen
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
