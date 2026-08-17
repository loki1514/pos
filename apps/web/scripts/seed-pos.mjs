/**
 * Seed demo POS data (categories, menu items, tables, orders, KOTs) for the
 * demo organization. Idempotent: skips everything if menu_items already
 * exist for the org.
 *
 *   node scripts/seed-pos.mjs
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service role
 * bypasses RLS — never ship this key to the browser).
 */
import { createClient } from "@supabase/supabase-js";

// supabase-js constructs a realtime client eagerly and requires a WebSocket
// constructor (native only in Node 22+). This script never uses realtime, so
// a stub keeps Node 20 working.
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class {
    constructor() {
      throw new Error("WebSocket is not available in the seed script.");
    }
  };
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const fail = (step, error) => {
  console.error(`${step}: ${error.message}`);
  process.exit(1);
};

// --- organization -----------------------------------------------------------

const { data: orgs, error: orgErr } = await supabase
  .from("organizations")
  .select("id, name, slug, type")
  .order("created_at", { ascending: true })
  .limit(1);
if (orgErr) fail("organizations select", orgErr);

let org = orgs?.[0];
if (!org) {
  const { data, error } = await supabase
    .from("organizations")
    .insert({ name: "Niks Cafe", slug: "niks-cafe", type: "franchise", status: "active" })
    .select("id, name")
    .single();
  if (error) fail("organizations insert", error);
  org = data;
  console.log(`Created organization: ${org.name} (${org.id})`);
} else {
  console.log(`Using organization: ${org.name} (${org.id})`);
}

// --- idempotency ------------------------------------------------------------

const { count: existing, error: cntErr } = await supabase
  .from("menu_items")
  .select("id", { count: "exact", head: true })
  .eq("organization_id", org.id);
if (cntErr) fail("menu_items count", cntErr);
if ((existing ?? 0) > 0) {
  console.log(`menu_items already seeded for ${org.name} (${existing} items) — skipping.`);
  process.exit(0);
}

// --- categories + items -----------------------------------------------------

const menu = [
  { name: "Hot Beverages", items: [
    { name: "Cappuccino", price: 140 },
    { name: "Espresso", price: 120 },
    { name: "Masala Chai", price: 80 },
  ]},
  { name: "Cold Beverages", items: [
    { name: "Cold Coffee", price: 160 },
    { name: "Fresh Lime Soda", price: 90 },
  ]},
  { name: "Breakfast", items: [
    { name: "Aloo Paratha", price: 160 },
    { name: "Masala Dosa", price: 180 },
  ]},
  { name: "Sandwiches", items: [
    { name: "Club Sandwich", price: 220 },
    { name: "Peri Peri Fries With Cheese", price: 180 },
  ]},
  { name: "Pizzas", items: [
    { name: 'Margherita Pizza (Thin 8" Small)', price: 320 },
    { name: "Spicy Penne Veggie Arabiata", price: 240 },
    { name: "Biryani Bowl", price: 280 },
  ]},
  { name: "Desserts", items: [
    { name: "Blueberry Cheesecake", price: 220 },
    { name: "Choco Lava Cake", price: 150 },
  ]},
];

const itemIdByName = new Map();
for (let i = 0; i < menu.length; i++) {
  const cat = menu[i];
  const { data: catRow, error } = await supabase
    .from("menu_categories")
    .insert({ organization_id: org.id, name: cat.name, sort_order: i })
    .select("id")
    .single();
  if (error) fail(`category ${cat.name}`, error);

  const rows = cat.items.map((it, j) => ({
    organization_id: org.id,
    category_id: catRow.id,
    name: it.name,
    price: it.price,
    image_url: null,
    sort_order: j,
  }));
  const { data: itemRows, error: itErr } = await supabase
    .from("menu_items")
    .insert(rows)
    .select("id, name");
  if (itErr) fail(`items of ${cat.name}`, itErr);
  for (const r of itemRows) itemIdByName.set(r.name, r.id);
}
console.log(`Seeded ${menu.length} categories, ${itemIdByName.size} menu items.`);

// --- dining tables ----------------------------------------------------------

const tableRows = Array.from({ length: 8 }, (_, i) => ({
  organization_id: org.id,
  label: `T-${String(i + 1).padStart(2, "0")}`,
  seats: 4,
  sort_order: i,
}));
const { data: tables, error: tErr } = await supabase
  .from("dining_tables")
  .insert(tableRows)
  .select("id, label");
if (tErr) fail("dining_tables", tErr);
console.log(`Seeded ${tables.length} dining tables.`);

// --- orders + items + kots --------------------------------------------------

async function nextSeq(kind) {
  const { data, error } = await supabase.rpc("next_org_seq", { org: org.id, counter_kind: kind });
  if (error) fail(`next_org_seq(${kind})`, error);
  return data;
}

const GST = 5;
function totals(lines) {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
  const gst_amount = Math.round(subtotal * GST) / 100;
  return { subtotal, gst_pct: GST, gst_amount, total: subtotal + gst_amount };
}

const demoOrders = [
  {
    channel: "dine_in", status: "sent_to_kitchen", table: "T-01", captain: "Ravi",
    customer_name: null, customer_phone: null, kot: { status: "preparing", priority: "urgent" },
    lines: [
      { name: 'Margherita Pizza (Thin 8" Small)', qty: 1, unit_price: 320 },
      { name: "Cappuccino", qty: 3, unit_price: 140 },
      { name: "Peri Peri Fries With Cheese", qty: 1, unit_price: 180 },
    ],
  },
  {
    channel: "swiggy", status: "sent_to_kitchen", table: null, captain: null,
    customer_name: "Ananya S", customer_phone: "+919876543210",
    kot: { status: "new", priority: "normal" },
    lines: [
      { name: "Biryani Bowl", qty: 2, unit_price: 280 },
      { name: "Fresh Lime Soda", qty: 2, unit_price: 90 },
    ],
  },
  {
    channel: "dine_in", status: "new", table: "T-04", captain: "Meera",
    customer_name: null, customer_phone: null, kot: { status: "new", priority: "normal" },
    lines: [
      { name: "Masala Dosa", qty: 2, unit_price: 180 },
      { name: "Masala Chai", qty: 2, unit_price: 80 },
    ],
  },
  {
    channel: "dine_in", status: "delivered", table: "T-07", captain: "Ravi",
    customer_name: null, customer_phone: null, payment_method: "upi",
    kot: { status: "delivered", priority: "normal" },
    lines: [
      { name: "Club Sandwich", qty: 1, unit_price: 220 },
      { name: "Cold Coffee", qty: 2, unit_price: 160 },
      { name: "Choco Lava Cake", qty: 1, unit_price: 150 },
    ],
  },
];

const tableIdByLabel = new Map(tables.map((t) => [t.label, t.id]));
let seededOrders = 0;
for (const o of demoOrders) {
  const orderNo = await nextSeq("order");
  const kotNo = await nextSeq("kot");
  const display = `ORD-${String(65005500 + Number(orderNo)).slice(-8)}`;
  const row = {
    organization_id: org.id,
    order_no: orderNo,
    display_no: display,
    channel: o.channel,
    status: o.status,
    table_id: o.table ? tableIdByLabel.get(o.table) : null,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    captain_name: o.captain,
    payment_method: o.payment_method ?? null,
    ...totals(o.lines),
  };
  const { data: order, error: oErr } = await supabase
    .from("orders")
    .insert(row)
    .select("id")
    .single();
  if (oErr) fail(`order ${display}`, oErr);

  const items = o.lines.map((l) => ({
    order_id: order.id,
    menu_item_id: itemIdByName.get(l.name) ?? null,
    name: l.name,
    qty: l.qty,
    unit_price: l.unit_price,
  }));
  const { error: liErr } = await supabase.from("order_items").insert(items);
  if (liErr) fail(`items of ${display}`, liErr);

  const { error: kErr } = await supabase.from("kot_tickets").insert({
    organization_id: org.id,
    order_id: order.id,
    kot_no: kotNo,
    status: o.kot.status,
    priority: o.kot.priority,
  });
  if (kErr) fail(`kot of ${display}`, kErr);
  seededOrders++;
}

console.log(`Seeded ${seededOrders} demo orders with items and KOT tickets. Done.`);
