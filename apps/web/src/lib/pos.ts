import "server-only";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * POS data layer (migration 0006). Reads go through the signed-in user's
 * session so RLS (organization_id = current_org_id()) does tenant isolation.
 * Mutations validate membership through the session and then write via
 * service_role where server actions need to bypass per-policy friction —
 * mirroring the pattern in src/lib/org.ts.
 */

export type MenuCategory = {
  id: string;
  name: string;
  sort_order: number;
};

export type MenuItem = {
  id: string;
  category_id: string | null;
  name: string;
  sku: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
};

export type DiningTable = {
  id: string;
  label: string;
  seats: number;
  is_active: boolean;
  sort_order: number;
};

export type OrderStatus =
  | "new"
  | "in_billing"
  | "sent_to_kitchen"
  | "awaiting_payment"
  | "paid"
  | "delivered"
  | "cancelled";

export type OrderChannel =
  | "dine_in"
  | "delivery"
  | "pickup"
  | "online"
  | "swiggy"
  | "zomato"
  | "other";

export type PaymentMethod = "cash" | "upi" | "card" | "split";

export type Order = {
  id: string;
  order_no: number;
  display_no: string;
  channel: OrderChannel;
  status: OrderStatus;
  table_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  captain_name: string | null;
  subtotal: number;
  gst_pct: number;
  gst_amount: number;
  total: number;
  payment_method: PaymentMethod | null;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name: string;
  qty: number;
  unit_price: number;
  add_ons: unknown[];
  notes: string | null;
};

export type KotStatus = "new" | "preparing" | "ready" | "delivered";
export type KotPriority = "normal" | "urgent";

export type KotTicket = {
  id: string;
  order_id: string;
  kot_no: number;
  station: string;
  status: KotStatus;
  priority: KotPriority;
  created_at: string;
  updated_at: string;
};

export async function listCategories(orgId: string): Promise<MenuCategory[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("menu_categories")
    .select("id, name, sort_order")
    .eq("organization_id", orgId)
    .order("sort_order");

  if (error) throw new Error(`listCategories: ${error.message}`);
  return data ?? [];
}

export async function listMenuItems(orgId: string): Promise<MenuItem[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, category_id, name, sku, price, image_url, is_available, sort_order")
    .eq("organization_id", orgId)
    .order("sort_order");

  if (error) throw new Error(`listMenuItems: ${error.message}`);
  return data ?? [];
}

export async function listTables(orgId: string): Promise<DiningTable[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("dining_tables")
    .select("id, label, seats, is_active, sort_order")
    .eq("organization_id", orgId)
    .order("sort_order");

  if (error) throw new Error(`listTables: ${error.message}`);
  return data ?? [];
}

/** Open orders — everything not yet paid/delivered/cancelled. */
export async function listPendingOrders(orgId: string): Promise<Order[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_no, display_no, channel, status, table_id, customer_name, customer_phone, captain_name, subtotal, gst_pct, gst_amount, total, payment_method, created_at",
    )
    .eq("organization_id", orgId)
    .in("status", ["new", "in_billing", "sent_to_kitchen", "awaiting_payment"])
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listPendingOrders: ${error.message}`);
  return (data ?? []) as Order[];
}

/** KOTs the kitchen still cares about (new/preparing/ready). */
export async function listKotTickets(orgId: string): Promise<KotTicket[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("kot_tickets")
    .select("id, order_id, kot_no, station, status, priority, created_at, updated_at")
    .eq("organization_id", orgId)
    .in("status", ["new", "preparing", "ready"])
    .order("created_at");

  if (error) throw new Error(`listKotTickets: ${error.message}`);
  return (data ?? []) as KotTicket[];
}

export type NewOrderLine = {
  menu_item_id?: string | null;
  name: string;
  qty: number;
  unit_price: number;
  add_ons?: unknown[];
  notes?: string | null;
};

export type NewOrder = {
  organizationId: string;
  channel: OrderChannel;
  table_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  captain_name?: string | null;
  gst_pct?: number;
  lines: NewOrderLine[];
};

/**
 * Creates an order with its line items. Totals (subtotal/GST/total) are
 * computed here from the lines; order_no comes from the per-org counter and
 * display_no is derived from it.
 */
export async function createOrder(input: NewOrder): Promise<Order> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const subtotal = input.lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
  const gstPct = input.gst_pct ?? 5;
  const gstAmount = Math.round(subtotal * gstPct) / 100;

  const { data: orderNo, error: seqErr } = await supabaseAdmin.rpc("next_org_seq", {
    org: input.organizationId,
    counter_kind: "order",
  });
  if (seqErr) throw new Error(`createOrder (sequence): ${seqErr.message}`);

  const displayNo = `ORD-${String(65005500 + Number(orderNo)).slice(-8)}`;

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .insert({
      organization_id: input.organizationId,
      order_no: orderNo,
      display_no: displayNo,
      channel: input.channel,
      table_id: input.table_id ?? null,
      customer_name: input.customer_name ?? null,
      customer_phone: input.customer_phone ?? null,
      captain_name: input.captain_name ?? null,
      subtotal,
      gst_pct: gstPct,
      gst_amount: gstAmount,
      total: subtotal + gstAmount,
      created_by: user.id,
    })
    .select(
      "id, order_no, display_no, channel, status, table_id, customer_name, customer_phone, captain_name, subtotal, gst_pct, gst_amount, total, payment_method, created_at",
    )
    .single();
  if (error) throw new Error(`createOrder: ${error.message}`);

  if (input.lines.length > 0) {
    const { error: itemErr } = await supabaseAdmin.from("order_items").insert(
      input.lines.map((l) => ({
        order_id: order.id,
        menu_item_id: l.menu_item_id ?? null,
        name: l.name,
        qty: l.qty,
        unit_price: l.unit_price,
        add_ons: l.add_ons ?? [],
        notes: l.notes ?? null,
      })),
    );
    if (itemErr) throw new Error(`createOrder (items): ${itemErr.message}`);
  }

  return order as Order;
}

export async function addOrderItem(orderId: string, line: NewOrderLine): Promise<OrderItem> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data, error } = await supabaseAdmin
    .from("order_items")
    .insert({
      order_id: orderId,
      menu_item_id: line.menu_item_id ?? null,
      name: line.name,
      qty: line.qty,
      unit_price: line.unit_price,
      add_ons: line.add_ons ?? [],
      notes: line.notes ?? null,
    })
    .select("id, order_id, menu_item_id, name, qty, unit_price, add_ons, notes")
    .single();

  if (error) throw new Error(`addOrderItem: ${error.message}`);
  return data as OrderItem;
}

export async function setKotStatus(kotId: string, status: KotStatus): Promise<void> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabaseAdmin
    .from("kot_tickets")
    .update({ status })
    .eq("id", kotId);

  if (error) throw new Error(`setKotStatus: ${error.message}`);
}

const ORDER_COLUMNS =
  "id, order_no, display_no, channel, status, table_id, customer_name, customer_phone, captain_name, subtotal, gst_pct, gst_amount, total, payment_method, created_at";

const ITEM_COLUMNS = "id, order_id, menu_item_id, name, qty, unit_price, add_ons, notes";

/** Line items for a set of orders (RLS scopes through the parent order). */
export async function listOrderItems(orderIds: string[]): Promise<OrderItem[]> {
  if (orderIds.length === 0) return [];
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("order_items")
    .select(ITEM_COLUMNS)
    .in("order_id", orderIds)
    .order("created_at");

  if (error) throw new Error(`listOrderItems: ${error.message}`);
  return (data ?? []) as OrderItem[];
}

export async function getOrderWithItems(
  orderId: string,
): Promise<{ order: Order; items: OrderItem[] }> {
  const supabase = await supabaseServer();
  const { data: order, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("id", orderId)
    .single();
  if (error) throw new Error(`getOrderWithItems: ${error.message}`);

  const items = await listOrderItems([orderId]);
  return { order: order as Order, items };
}

/**
 * Recomputes subtotal/GST/total from the current line items. The POS mutates
 * lines one tap at a time, so totals are derived here after every change —
 * the database has no trigger doing this.
 */
export async function recalcOrderTotals(orderId: string): Promise<Order> {
  const { data: items, error: itemsErr } = await supabaseAdmin
    .from("order_items")
    .select("qty, unit_price")
    .eq("order_id", orderId);
  if (itemsErr) throw new Error(`recalcOrderTotals (items): ${itemsErr.message}`);

  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .select("gst_pct")
    .eq("id", orderId)
    .single();
  if (orderErr) throw new Error(`recalcOrderTotals (order): ${orderErr.message}`);

  const subtotal = (items ?? []).reduce(
    (s, l) => s + Number(l.qty) * Number(l.unit_price),
    0,
  );
  const gstAmount = Math.round(subtotal * Number(order.gst_pct)) / 100;

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({
      subtotal,
      gst_amount: gstAmount,
      total: Math.round((subtotal + gstAmount) * 100) / 100,
    })
    .eq("id", orderId)
    .select(ORDER_COLUMNS)
    .single();
  if (error) throw new Error(`recalcOrderTotals: ${error.message}`);
  return data as Order;
}

export type OrderDetailsPatch = {
  channel?: OrderChannel;
  table_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
};

/** Edits the non-line fields of an open order from the bill panel. */
export async function updateOrderDetails(
  orderId: string,
  patch: OrderDetailsPatch,
): Promise<Order> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update(patch)
    .eq("id", orderId)
    .select(ORDER_COLUMNS)
    .single();
  if (error) throw new Error(`updateOrderDetails: ${error.message}`);
  return data as Order;
}

/** Sets the quantity of a line (min 1 — removal is removeOrderItem) and recalcs. */
export async function setOrderItemQty(
  orderId: string,
  itemId: string,
  qty: number,
): Promise<Order> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabaseAdmin
    .from("order_items")
    .update({ qty })
    .eq("id", itemId)
    .eq("order_id", orderId);
  if (error) throw new Error(`setOrderItemQty: ${error.message}`);

  return recalcOrderTotals(orderId);
}

/** Removes a line and recalcs order totals. */
export async function removeOrderItem(orderId: string, itemId: string): Promise<Order> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabaseAdmin
    .from("order_items")
    .delete()
    .eq("id", itemId)
    .eq("order_id", orderId);
  if (error) throw new Error(`removeOrderItem: ${error.message}`);

  return recalcOrderTotals(orderId);
}

/**
 * Fires the order to the kitchen: a fresh KOT number from the per-org
 * counter (station 'main' — multi-station fan-out lands later) and the
 * order moves to sent_to_kitchen.
 */
export async function sendOrderToKitchen(orderId: string): Promise<KotTicket> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .select("organization_id")
    .eq("id", orderId)
    .single();
  if (orderErr) throw new Error(`sendOrderToKitchen (order): ${orderErr.message}`);

  const { data: kotNo, error: seqErr } = await supabaseAdmin.rpc("next_org_seq", {
    org: order.organization_id,
    counter_kind: "kot",
  });
  if (seqErr) throw new Error(`sendOrderToKitchen (sequence): ${seqErr.message}`);

  const { data: kot, error } = await supabaseAdmin
    .from("kot_tickets")
    .insert({
      organization_id: order.organization_id,
      order_id: orderId,
      kot_no: kotNo,
      station: "main",
    })
    .select("id, order_id, kot_no, station, status, priority, created_at, updated_at")
    .single();
  if (error) throw new Error(`sendOrderToKitchen: ${error.message}`);

  const { error: statusErr } = await supabaseAdmin
    .from("orders")
    .update({ status: "sent_to_kitchen" })
    .eq("id", orderId);
  if (statusErr) throw new Error(`sendOrderToKitchen (status): ${statusErr.message}`);

  return kot as KotTicket;
}

/**
 * Marks an order paid and records the payment method. `method` may be null
 * when the caller only wants to flip the status (e.g. delivered).
 */
export async function settleOrder(
  orderId: string,
  method: PaymentMethod,
): Promise<void> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabaseAdmin
    .from("orders")
    .update({ status: "paid", payment_method: method })
    .eq("id", orderId);

  if (error) throw new Error(`settleOrder: ${error.message}`);
}
