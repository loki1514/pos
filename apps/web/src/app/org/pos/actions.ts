"use server";

/**
 * Server actions for the POS billing screen. The interactive client calls
 * these; each delegates to the typed helpers in src/lib/pos.ts (session
 * validated there, writes via service_role mirroring src/lib/org.ts).
 * revalidatePath("/org/pos") keeps the pending-orders strip fresh on the
 * next router.refresh().
 */
import { revalidatePath } from "next/cache";
import {
  addOrderItem,
  createOrder,
  getOrderWithItems,
  recalcOrderTotals,
  removeOrderItem,
  sendOrderToKitchen,
  setOrderItemQty,
  settleOrder,
  updateOrderDetails,
  type NewOrder,
  type NewOrderLine,
  type OrderDetailsPatch,
  type PaymentMethod,
} from "@/lib/pos";

function clean(err: unknown): string {
  const msg = err instanceof Error ? err.message : "Something went wrong.";
  return msg.replace(/^\w+(\s\([\w ]+\))?:\s*/, "");
}

export async function createPosOrder(input: NewOrder) {
  try {
    const order = await createOrder(input);
    const { items } = await getOrderWithItems(order.id);
    revalidatePath("/org/pos");
    return { ok: true as const, data: { order, items } };
  } catch (err) {
    return { ok: false as const, error: clean(err) };
  }
}

export async function addPosItem(orderId: string, line: NewOrderLine) {
  try {
    await addOrderItem(orderId, line);
    const order = await recalcOrderTotals(orderId);
    const { items } = await getOrderWithItems(orderId);
    revalidatePath("/org/pos");
    return { ok: true as const, data: { order, items } };
  } catch (err) {
    return { ok: false as const, error: clean(err) };
  }
}

export async function setPosItemQty(orderId: string, itemId: string, qty: number) {
  try {
    if (!Number.isInteger(qty) || qty < 1) throw new Error("Quantity must be at least 1.");
    const order = await setOrderItemQty(orderId, itemId, qty);
    const { items } = await getOrderWithItems(orderId);
    revalidatePath("/org/pos");
    return { ok: true as const, data: { order, items } };
  } catch (err) {
    return { ok: false as const, error: clean(err) };
  }
}

export async function removePosItem(orderId: string, itemId: string) {
  try {
    const order = await removeOrderItem(orderId, itemId);
    const { items } = await getOrderWithItems(orderId);
    revalidatePath("/org/pos");
    return { ok: true as const, data: { order, items } };
  } catch (err) {
    return { ok: false as const, error: clean(err) };
  }
}

export async function updatePosOrderDetails(orderId: string, patch: OrderDetailsPatch) {
  try {
    const order = await updateOrderDetails(orderId, patch);
    revalidatePath("/org/pos");
    return { ok: true as const, data: { order } };
  } catch (err) {
    return { ok: false as const, error: clean(err) };
  }
}

export async function sendPosOrderToKitchen(orderId: string) {
  try {
    const kot = await sendOrderToKitchen(orderId);
    const { order, items } = await getOrderWithItems(orderId);
    revalidatePath("/org/pos");
    revalidatePath("/org/kot");
    return { ok: true as const, data: { kot, order, items } };
  } catch (err) {
    return { ok: false as const, error: clean(err) };
  }
}

export async function settlePosOrder(orderId: string, method: PaymentMethod) {
  try {
    await settleOrder(orderId, method);
    revalidatePath("/org/pos");
    revalidatePath("/org/orders");
    return { ok: true as const, data: null };
  } catch (err) {
    return { ok: false as const, error: clean(err) };
  }
}

/** Loads a pending order's lines when the biller taps Open. */
export async function loadPosOrder(orderId: string) {
  try {
    const data = await getOrderWithItems(orderId);
    return { ok: true as const, data };
  } catch (err) {
    return { ok: false as const, error: clean(err) };
  }
}
