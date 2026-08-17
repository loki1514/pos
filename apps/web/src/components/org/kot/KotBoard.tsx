"use client";

import * as React from "react";
import {
  Bike,
  Check,
  ChefHat,
  Clock,
  Flame,
  Globe,
  Info,
  Phone,
  Search,
  ShoppingBag,
  Store,
  Truck,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { KotStatus, KotTicket, OrderChannel } from "@/lib/pos";
import {
  getKotBoard,
  setKotStatusAction,
  settleOrderAction,
  type BoardItem,
  type BoardOrder,
  type KotBoardData,
} from "@/app/org/kot/actions";

/* ------------------------------------------------------------------ */
/* Presentation maps                                                   */
/* ------------------------------------------------------------------ */

const CHANNEL_META: Record<
  OrderChannel,
  { label: string; icon: React.ComponentType<{ size?: number | string; className?: string }> }
> = {
  dine_in: { label: "Dine In", icon: UtensilsCrossed },
  delivery: { label: "Delivery", icon: Truck },
  pickup: { label: "Pick Up", icon: ShoppingBag },
  online: { label: "Online", icon: Globe },
  swiggy: { label: "Swiggy", icon: Bike },
  zomato: { label: "Zomato", icon: Bike },
  other: { label: "Other Kitchen", icon: Store },
};

const STATUS_META: Record<
  KotStatus,
  { label: string; next: KotStatus | null; cta: string; fg: string; bg: string; line: string }
> = {
  new: {
    label: "New",
    next: "preparing",
    cta: "Start Preparing",
    fg: "var(--info)",
    bg: "rgb(76 147 232 / 0.10)",
    line: "rgb(76 147 232 / 0.35)",
  },
  preparing: {
    label: "Preparing",
    next: "ready",
    cta: "Mark Ready",
    fg: "var(--warn)",
    bg: "rgb(242 169 59 / 0.10)",
    line: "rgb(242 169 59 / 0.4)",
  },
  ready: {
    label: "Ready",
    next: "delivered",
    cta: "Mark Delivered",
    fg: "var(--ok)",
    bg: "rgb(79 191 106 / 0.10)",
    line: "rgb(79 191 106 / 0.4)",
  },
  delivered: {
    label: "Delivered",
    next: null,
    cta: "Delivered",
    fg: "var(--muted)",
    bg: "rgb(18 21 15 / 0.04)",
    line: "var(--line)",
  },
};

function addOnLabel(a: unknown): string | null {
  if (typeof a === "string") return a;
  if (a && typeof a === "object") {
    const o = a as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name : null;
    const group = typeof o.group === "string" ? o.group : null;
    if (group && name) return `[${group}: ${name}]`;
    if (name) return name;
  }
  return null;
}

function formatElapsed(since: string, now: number): string {
  const secs = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatMoney(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** Short two-tone chime for a newly arrived ticket. Best-effort, no-op if audio is blocked. */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const play = (freq: number, t0: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.15, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.4);
    };
    const t = ctx.currentTime;
    play(880, t);
    play(1174.66, t + 0.12);
    setTimeout(() => void ctx.close(), 900);
  } catch {
    /* audio unavailable */
  }
}

/* ------------------------------------------------------------------ */
/* Board                                                               */
/* ------------------------------------------------------------------ */

export function KotBoard({ orgId, initial }: { orgId: string; initial: KotBoardData }) {
  const [data, setData] = React.useState<KotBoardData>(initial);
  const [channel, setChannel] = React.useState<OrderChannel | "all">("all");
  const [query, setQuery] = React.useState("");
  const [oosDismissed, setOosDismissed] = React.useState(false);
  const [live, setLive] = React.useState<"connecting" | "live" | "polling">("connecting");
  const [now, setNow] = React.useState(() => Date.now());
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [infoOrder, setInfoOrder] = React.useState<BoardOrder | null>(null);
  const knownTicketIds = React.useRef(new Set(initial.tickets.map((t) => t.id)));

  const refresh = React.useCallback(async () => {
    try {
      const next = await getKotBoard();
      setData((prev) => {
        const fresh = next.tickets.filter((t) => !knownTicketIds.current.has(t.id) && t.status === "new");
        if (prev.tickets.length >= 0 && fresh.length > 0) {
          haptic("warn");
          chime();
        }
        knownTicketIds.current = new Set(next.tickets.map((t) => t.id));
        return next;
      });
    } catch {
      /* transient — next refresh will retry */
    }
  }, []);

  /* Ticking clock for elapsed timers */
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  /* Realtime subscription with 15s polling fallback */
  React.useEffect(() => {
    const supabase = supabaseBrowser();
    let polling: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (polling) return;
      setLive("polling");
      polling = setInterval(() => void refresh(), 15000);
    };

    const channel = supabase
      .channel(`kot-board-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kot_tickets", filter: `organization_id=eq.${orgId}` },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `organization_id=eq.${orgId}` },
        () => void refresh(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setLive("live");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          startPolling();
        }
      });

    return () => {
      if (polling) clearInterval(polling);
      void supabase.removeChannel(channel);
    };
  }, [orgId, refresh]);

  const orderById = React.useMemo(() => {
    const m = new Map<string, BoardOrder>();
    for (const o of data.orders) m.set(o.id, o);
    return m;
  }, [data.orders]);

  const itemsByOrder = React.useMemo(() => {
    const m = new Map<string, BoardItem[]>();
    for (const i of data.items) {
      const arr = m.get(i.order_id) ?? [];
      arr.push(i);
      m.set(i.order_id, arr);
    }
    return m;
  }, [data.items]);

  const channelsPresent = React.useMemo(() => {
    const set = new Set<OrderChannel>();
    for (const o of data.orders) set.add(o.channel);
    return [...set];
  }, [data.orders]);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.tickets.filter((t) => {
      const o = orderById.get(t.order_id);
      if (!o) return false;
      if (channel !== "all" && o.channel !== channel) return false;
      if (q) {
        const hay = `${o.order_no} ${o.display_no} kot-${t.kot_no}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data.tickets, orderById, channel, query]);

  async function advance(ticket: KotTicket) {
    const next = STATUS_META[ticket.status].next;
    if (!next) return;
    setBusyId(ticket.id);
    // Optimistic update so the board feels instant.
    setData((d) => ({
      ...d,
      tickets:
        next === "delivered"
          ? d.tickets.filter((t) => t.id !== ticket.id)
          : d.tickets.map((t) => (t.id === ticket.id ? { ...t, status: next } : t)),
    }));
    try {
      await setKotStatusAction(ticket.id, next);
    } catch {
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  const showOos = data.ordersWithUnavailableItems.length > 0 && !oosDismissed;

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-h2 text-ink">Kitchen Orders</h1>
          <p className="t-small mt-1 text-muted">
            Total Orders <span className="tnum font-bold text-ink">{visible.length}</span>
            <span
              className={cn(
                "ml-3 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold",
                live === "live" ? "bg-[rgb(79_191_106_/_0.12)] text-[var(--ok)]" : "bg-[rgb(242_169_59_/_0.14)] text-[var(--warn)]",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", live === "live" ? "bg-[var(--ok)]" : "bg-[var(--warn)]")} />
              {live === "live" ? "Live" : live === "polling" ? "Polling" : "Connecting"}
            </span>
          </p>
        </div>

        <label className="glass-inset flex h-11 w-full max-w-xs items-center gap-2.5 rounded-[14px] px-3.5">
          <Search size={16} className="shrink-0 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order no…"
            aria-label="Search by order number"
            className="tnum w-full bg-transparent text-[14px] outline-none placeholder:text-muted/75"
          />
        </label>
      </div>

      {/* Channel tabs */}
      <div className="scroll-thin mb-5 flex gap-2 overflow-x-auto pb-1">
        <ChannelTab active={channel === "all"} onClick={() => setChannel("all")} label="All" />
        {channelsPresent.map((c) => {
          const meta = CHANNEL_META[c];
          const Icon = meta.icon;
          return (
            <ChannelTab
              key={c}
              active={channel === c}
              onClick={() => setChannel(c)}
              label={meta.label}
              icon={<Icon size={14} />}
            />
          );
        })}
      </div>

      {/* OOS alert strip */}
      {showOos && (
        <div
          role="alert"
          className="glass-solid mb-5 flex items-start gap-3 rounded-[16px] border border-[rgb(242_169_59_/_0.4)] bg-[rgb(242_169_59_/_0.08)] p-4"
        >
          <Flame size={18} className="mt-0.5 shrink-0 text-[var(--warn)]" />
          <div className="flex-1">
            <p className="text-[14px] font-bold text-ink">Item unavailable on an active order</p>
            <p className="t-small text-ink-2">
              Mark the unavailable item out of stock immediately so new orders stop coming in for it.
            </p>
          </div>
          <button
            onClick={() => setOosDismissed(true)}
            className="press rounded-[10px] px-3 py-1.5 text-[13px] font-bold text-ink-2 hover:bg-[rgb(18_21_15_/_0.05)]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Cards */}
      {visible.length === 0 ? (
        <div className="glass-solid flex flex-col items-center gap-3 rounded-[24px] px-6 py-16 text-center">
          <ChefHat size={36} className="text-muted" />
          <p className="text-[16px] font-bold text-ink">All caught up</p>
          <p className="t-small text-muted">No active kitchen tickets right now. New tickets appear here automatically.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((ticket) => {
            const order = orderById.get(ticket.order_id);
            if (!order) return null;
            return (
              <KotCard
                key={ticket.id}
                ticket={ticket}
                order={order}
                items={itemsByOrder.get(order.id) ?? []}
                now={now}
                busy={busyId === ticket.id}
                onAdvance={() => void advance(ticket)}
                onInfo={() => setInfoOrder(order)}
                onSettled={() => void refresh()}
              />
            );
          })}
        </div>
      )}

      {infoOrder && (
        <OrderInfoDialog
          order={infoOrder}
          items={itemsByOrder.get(infoOrder.id) ?? []}
          onClose={() => setInfoOrder(null)}
        />
      )}
    </div>
  );
}

function ChannelTab({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      onPointerDown={() => haptic("light")}
      aria-pressed={active}
      className={cn(
        "press inline-flex h-10 shrink-0 items-center gap-2 rounded-[12px] px-4 text-[13.5px] font-bold",
        active ? "btn-lime" : "glass text-ink-2 hover:text-ink",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Ticket card                                                         */
/* ------------------------------------------------------------------ */

function KotCard({
  ticket,
  order,
  items,
  now,
  busy,
  onAdvance,
  onInfo,
  onSettled,
}: {
  ticket: KotTicket;
  order: BoardOrder;
  items: BoardItem[];
  now: number;
  busy: boolean;
  onAdvance: () => void;
  onInfo: () => void;
  onSettled: () => void;
}) {
  const meta = STATUS_META[ticket.status];
  const channel = CHANNEL_META[order.channel];
  const ChannelIcon = channel.icon;
  const elapsed = formatElapsed(ticket.created_at, now);
  const isLate = now - new Date(ticket.created_at).getTime() > 15 * 60 * 1000;

  return (
    <article
      className="glass-solid relative flex flex-col overflow-hidden rounded-[22px]"
      style={{ borderColor: meta.line, background: meta.bg }}
    >
      {ticket.priority === "urgent" && (
        <div className="flex items-center gap-2 bg-[rgb(226_86_75_/_0.12)] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--danger)]">
          <Zap size={14} fill="currentColor" />
          Urgent Order
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Top row: station + timer */}
        <div className="flex items-center justify-between gap-2">
          <span className="t-label text-muted">{ticket.station}</span>
          <span
            className={cn("tnum inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-bold")}
            style={{
              color: isLate ? "var(--danger)" : "var(--ink-2)",
              background: isLate ? "rgb(226 86 75 / 0.10)" : "var(--canvas-2)",
            }}
          >
            <Clock size={13} />
            {elapsed}
          </span>
        </div>

        {/* KOT + order no, table/channel badge */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[19px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
              KOT-{ticket.kot_no}
            </p>
            <p className="tnum t-small text-muted">
              {order.display_no} · #{order.order_no}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#14170f] px-2.5 py-1 text-[11.5px] font-bold text-white">
            <ChannelIcon size={12} />
            {order.table_label ?? channel.label}
          </span>
        </div>

        {/* Captain / customer */}
        {(order.captain_name || order.customer_name) && (
          <p className="t-small text-ink-2">
            {order.captain_name && <span className="font-semibold">{order.captain_name}</span>}
            {order.customer_name && (
              <span className={order.captain_name ? "text-muted" : "font-semibold"}>
                {order.captain_name ? " · " : ""}
                {order.customer_name}
              </span>
            )}
            {order.customer_phone && (
              <span className="tnum ml-1.5 inline-flex items-center gap-1 text-muted">
                <Phone size={11} />
                {order.customer_phone}
              </span>
            )}
          </p>
        )}

        {/* Items */}
        <ul className="hairline space-y-1.5 border-t pt-3">
          {items.map((i) => {
            const addOns = (i.add_ons ?? []).map(addOnLabel).filter(Boolean) as string[];
            return (
              <li key={i.id}>
                <div className="flex items-baseline gap-2 text-[15px] font-semibold text-ink">
                  <span className={cn("tnum shrink-0", i.is_available === false && "text-[var(--danger)] line-through")}>
                    {i.qty} ×
                  </span>
                  <span className={cn(i.is_available === false && "text-[var(--danger)] line-through")}>{i.name}</span>
                </div>
                {addOns.map((a, idx) => (
                  <p key={idx} className="t-small ml-8 text-muted">
                    {a}
                  </p>
                ))}
                {i.notes && <p className="t-small ml-8 italic text-muted">“{i.notes}”</p>}
              </li>
            );
          })}
        </ul>

        {/* Total + status badge */}
        <div className="mt-auto flex items-center justify-between pt-1">
          <span
            className="rounded-full px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-[0.08em]"
            style={{ color: meta.fg, background: meta.bg, border: `1px solid ${meta.line}` }}
          >
            {meta.label}
          </span>
          <span className="tnum text-[16px] font-extrabold text-ink">{formatMoney(order.total)}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {meta.next && (
            <button
              onClick={onAdvance}
              disabled={busy}
              onPointerDown={() => haptic("medium")}
              className="btn-lime press press-lime h-12 flex-1 rounded-[14px] text-[15px] font-bold disabled:opacity-45"
            >
              {busy ? "…" : meta.cta}
            </button>
          )}
          <SettleButton orderId={order.id} status={order.status} onSettled={onSettled} />
          <button
            onClick={onInfo}
            aria-label="Order details"
            title="Order details"
            className="press glass inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-ink-2"
          >
            <Info size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}

function SettleButton({
  orderId,
  status,
  onSettled,
}: {
  orderId: string;
  status: string;
  onSettled: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const settled = status === "paid" || status === "delivered";

  async function settle(method: "cash" | "upi" | "card" | "split") {
    setBusy(true);
    try {
      await settleOrderAction(orderId, method);
      haptic("success");
      setOpen(false);
      onSettled();
    } finally {
      setBusy(false);
    }
  }

  if (settled) {
    return (
      <span className="inline-flex h-12 items-center gap-1.5 rounded-[14px] px-3 text-[13px] font-bold text-[var(--ok)]">
        <Check size={15} />
        Settled
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        onPointerDown={() => haptic("light")}
        className="press h-12 shrink-0 rounded-[14px] border border-[var(--line)] bg-[rgb(18_21_15_/_0.04)] px-3.5 text-[13.5px] font-bold text-ink hover:bg-[rgb(18_21_15_/_0.07)] disabled:opacity-45"
      >
        {busy ? "…" : "Settle & Save"}
      </button>
      {open && (
        <>
          <button aria-hidden className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="glass absolute bottom-full right-0 z-50 mb-2 w-36 overflow-hidden rounded-[14px] p-1">
            {(["cash", "upi", "card", "split"] as const).map((m) => (
              <button
                key={m}
                onClick={() => void settle(m)}
                className="block w-full rounded-[10px] px-3 py-2 text-left text-[13.5px] font-semibold capitalize text-ink hover:bg-[rgb(18_21_15_/_0.05)]"
              >
                {m === "upi" ? "UPI" : m}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Info dialog                                                         */
/* ------------------------------------------------------------------ */

function OrderInfoDialog({
  order,
  items,
  onClose,
}: {
  order: BoardOrder;
  items: BoardItem[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Order details">
      <button aria-label="Close" className="absolute inset-0 bg-[rgb(10_12_8_/_0.45)]" onClick={onClose} />
      <div className="glass-solid relative w-full max-w-md rounded-[24px] p-6">
        <p className="t-label text-muted">Order details</p>
        <h2 className="mt-1 text-[22px] font-extrabold tracking-[-0.02em] text-ink">{order.display_no}</h2>
        <dl className="t-small mt-4 space-y-1.5 text-ink-2">
          <div className="flex justify-between"><dt className="text-muted">Channel</dt><dd className="font-semibold">{CHANNEL_META[order.channel].label}</dd></div>
          {order.table_label && <div className="flex justify-between"><dt className="text-muted">Table</dt><dd className="font-semibold">{order.table_label}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted">Status</dt><dd className="font-semibold capitalize">{order.status.replaceAll("_", " ")}</dd></div>
          {order.customer_name && <div className="flex justify-between"><dt className="text-muted">Customer</dt><dd className="font-semibold">{order.customer_name}</dd></div>}
          {order.customer_phone && <div className="tnum flex justify-between"><dt className="text-muted">Phone</dt><dd className="font-semibold">{order.customer_phone}</dd></div>}
          {order.captain_name && <div className="flex justify-between"><dt className="text-muted">Captain</dt><dd className="font-semibold">{order.captain_name}</dd></div>}
        </dl>
        <ul className="hairline mt-4 space-y-1.5 border-t pt-3">
          {items.map((i) => (
            <li key={i.id} className="flex justify-between text-[14px] font-semibold text-ink">
              <span className="tnum">{i.qty} × {i.name}</span>
              <span className="tnum">{formatMoney(i.qty * i.unit_price)}</span>
            </li>
          ))}
        </ul>
        <div className="hairline mt-3 space-y-1 border-t pt-3 text-[13.5px]">
          <div className="tnum flex justify-between text-muted"><span>Subtotal</span><span>{formatMoney(order.subtotal)}</span></div>
          <div className="tnum flex justify-between text-muted"><span>GST ({order.gst_pct}%)</span><span>{formatMoney(order.gst_amount)}</span></div>
          <div className="tnum flex justify-between text-[16px] font-extrabold text-ink"><span>Total</span><span>{formatMoney(order.total)}</span></div>
        </div>
        <button
          onClick={onClose}
          className="btn-lime press press-lime mt-5 h-11 w-full rounded-[14px] text-[14.5px] font-bold"
        >
          Close
        </button>
      </div>
    </div>
  );
}
