"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import type {
  DiningTable,
  MenuCategory,
  MenuItem,
  Order,
  OrderChannel,
  OrderItem,
  PaymentMethod,
} from "@/lib/pos";
import {
  addPosItem,
  createPosOrder,
  loadPosOrder,
  removePosItem,
  sendPosOrderToKitchen,
  setPosItemQty,
  settlePosOrder,
  updatePosOrderDetails,
} from "@/app/org/pos/actions";
import { ChannelTabs, type ChannelFilter } from "./ChannelTabs";
import { MenuGrid } from "./MenuGrid";
import { OrderSummary } from "./OrderSummary";
import { PendingStrip } from "./PendingStrip";

export function PosScreen({
  orgId,
  categories,
  menuItems,
  tables,
  pendingOrders,
  pendingItems,
}: {
  orgId: string;
  categories: MenuCategory[];
  menuItems: MenuItem[];
  tables: DiningTable[];
  pendingOrders: Order[];
  pendingItems: OrderItem[];
}) {
  const router = useRouter();

  // Filters
  const [tab, setTab] = React.useState<ChannelFilter>("all");

  // Current bill
  const [order, setOrder] = React.useState<Order | null>(null);
  const [lines, setLines] = React.useState<OrderItem[]>([]);
  const [channel, setChannel] = React.useState<OrderChannel>("dine_in");
  const [tableId, setTableId] = React.useState<string | null>(null);
  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("cash");
  const [tendered, setTendered] = React.useState<number | null>(null);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Elapsed-time ticker for the pending strip
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const tableLabel = React.useCallback(
    (id: string | null) => tables.find((t) => t.id === id)?.label ?? null,
    [tables],
  );

  const itemCounts = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const it of pendingItems) {
      m.set(it.order_id, (m.get(it.order_id) ?? 0) + it.qty);
    }
    return m;
  }, [pendingItems]);

  const counts = React.useMemo(() => {
    const c: Partial<Record<ChannelFilter, number>> = { all: pendingOrders.length };
    for (const o of pendingOrders) c[o.channel] = (c[o.channel] ?? 0) + 1;
    return c;
  }, [pendingOrders]);

  const visiblePending = React.useMemo(
    () => (tab === "all" ? pendingOrders : pendingOrders.filter((o) => o.channel === tab)),
    [pendingOrders, tab],
  );

  function resetBill() {
    setOrder(null);
    setLines([]);
    setTableId(null);
    setCustomerName("");
    setCustomerPhone("");
    setTendered(null);
  }

  /** Picking a channel tab both filters pending orders and sets the channel for new bills. */
  function pickTab(t: ChannelFilter) {
    setTab(t);
    if (t !== "all") setChannel(t);
  }

  // Debounced customer sync — order details persist as the biller types.
  const orderRef = React.useRef(order);
  orderRef.current = order;
  React.useEffect(() => {
    const o = orderRef.current;
    if (!o) return;
    if (
      (customerName || null) === o.customer_name &&
      (customerPhone || null) === o.customer_phone
    ) {
      return;
    }
    const t = setTimeout(async () => {
      const cur = orderRef.current;
      if (!cur) return;
      const res = await updatePosOrderDetails(cur.id, {
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
      });
      if (res.ok) setOrder(res.data.order);
    }, 700);
    return () => clearTimeout(t);
  }, [customerName, customerPhone]);

  async function run<T extends { ok: boolean; error?: string }>(
    fn: () => Promise<T>,
  ): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return null;
      }
      return res;
    } finally {
      setBusy(false);
    }
  }

  async function pickItem(item: MenuItem) {
    if (busy) return;
    const line = {
      menu_item_id: item.id,
      name: item.name,
      qty: 1,
      unit_price: Number(item.price),
    };

    if (!order) {
      const res = await run(() =>
        createPosOrder({
          organizationId: orgId,
          channel,
          table_id: channel === "dine_in" ? tableId : null,
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          lines: [line],
        }),
      );
      if (res?.ok) {
        setOrder(res.data.order);
        setLines(res.data.items);
        router.refresh();
      }
      return;
    }

    const existing = lines.find(
      (l) =>
        l.menu_item_id === item.id &&
        !l.notes &&
        (!Array.isArray(l.add_ons) || l.add_ons.length === 0),
    );
    if (existing) {
      await changeQty(existing, existing.qty + 1);
    } else {
      const res = await run(() => addPosItem(order.id, line));
      if (res?.ok) {
        setOrder(res.data.order);
        setLines(res.data.items);
      }
    }
  }

  async function changeQty(item: OrderItem, qty: number) {
    if (!order) return;
    const res = await run(() => setPosItemQty(order.id, item.id, qty));
    if (res?.ok) {
      setOrder(res.data.order);
      setLines(res.data.items);
    }
  }

  async function removeLine(item: OrderItem) {
    if (!order) return;
    const res = await run(() => removePosItem(order.id, item.id));
    if (res?.ok) {
      setOrder(res.data.order);
      setLines(res.data.items);
    }
  }

  async function pickMode(c: OrderChannel) {
    setChannel(c);
    if (!order) return;
    const res = await run(() =>
      updatePosOrderDetails(order.id, {
        channel: c,
        ...(c !== "dine_in" ? { table_id: null } : {}),
      }),
    );
    if (res?.ok) {
      setOrder(res.data.order);
      if (c !== "dine_in") setTableId(null);
    }
  }

  async function pickTable(id: string | null) {
    setTableId(id);
    if (!order) return;
    const res = await run(() => updatePosOrderDetails(order.id, { table_id: id }));
    if (res?.ok) setOrder(res.data.order);
  }

  async function openOrder(o: Order) {
    if (busy) return;
    const res = await run(() => loadPosOrder(o.id));
    if (res?.ok) {
      setOrder(res.data.order);
      setLines(res.data.items);
      setChannel(res.data.order.channel);
      setTableId(res.data.order.table_id);
      setCustomerName(res.data.order.customer_name ?? "");
      setCustomerPhone(res.data.order.customer_phone ?? "");
      setTendered(null);
    }
  }

  async function settle() {
    if (!order) return;
    const res = await run(() => settlePosOrder(order.id, paymentMethod));
    if (res?.ok) {
      resetBill();
      router.refresh();
    }
  }

  async function sendToKitchen() {
    if (!order) return;
    const res = await run(() => sendPosOrderToKitchen(order.id));
    if (res?.ok) {
      setOrder(res.data.order);
      setLines(res.data.items);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="t-h2 mr-auto">POS Billing</h1>
        <ChannelTabs value={tab} onChange={pickTab} counts={counts} />
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-[var(--r-md)] border border-[rgb(226_86_75_/_0.35)] bg-[rgb(226_86_75_/_0.1)] px-4 py-2.5 text-[13.5px] font-semibold text-[var(--danger)]"
        >
          <TriangleAlert size={15} />
          {error}
        </div>
      )}

      <PendingStrip
        orders={visiblePending}
        tableLabel={tableLabel}
        itemCounts={itemCounts}
        activeOrderId={order?.id ?? null}
        now={now}
        onOpen={openOrder}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <MenuGrid categories={categories} items={menuItems} onPick={pickItem} />
        <OrderSummary
          order={order}
          lines={lines}
          tables={tables}
          channel={channel}
          tableId={tableId}
          customerName={customerName}
          customerPhone={customerPhone}
          paymentMethod={paymentMethod}
          tendered={tendered}
          busy={busy}
          onMode={pickMode}
          onTable={pickTable}
          onCustomerName={setCustomerName}
          onCustomerPhone={setCustomerPhone}
          onQty={changeQty}
          onRemove={removeLine}
          onPaymentMethod={setPaymentMethod}
          onTendered={setTendered}
          onSettle={settle}
          onSendToKitchen={sendToKitchen}
          onNewBill={resetBill}
        />
      </div>
    </div>
  );
}
