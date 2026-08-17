-- ============================================================================
-- 0006 — POS domain (Phase 3: Operations)
--
-- The operational core of the point of sale: menu (categories + items),
-- dining tables, orders with their line items, and kitchen order tickets
-- (KOTs). Everything is organization-scoped and inherits the tenancy
-- boundary established in 0001.
--
-- Access model: any active member of the organization may read; mutations go
-- through the same membership check. Fine-grained per-role restrictions
-- (e.g. only kitchen updates KOT status) are enforced at the application
-- layer for now — the screens that need them land in later phases.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Per-organization counters
--
-- order_no / kot_no must be per-org, human-friendly running numbers. One row
-- per (organization, kind); next_org_seq() upserts atomically so concurrent
-- cashiers on the same org never collide.
-- ----------------------------------------------------------------------------

create table public.org_counters (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind            text not null,
  value           bigint not null default 0,

  primary key (organization_id, kind)
);

comment on table public.org_counters is
  'Per-organization running counters (order numbers, KOT numbers). Mutated only via next_org_seq().';

alter table public.org_counters enable row level security;

create policy org_counters_member_select
  on public.org_counters for select
  using (organization_id = public.current_org_id());

create policy org_counters_platform_admin_all
  on public.org_counters for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create or replace function public.next_org_seq(org uuid, counter_kind text)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_value bigint;
begin
  insert into public.org_counters (organization_id, kind, value)
  values (org, counter_kind, 1)
  on conflict (organization_id, kind)
  do update set value = org_counters.value + 1
  returning value into next_value;

  return next_value;
end;
$$;

comment on function public.next_org_seq(uuid, text) is
  'Atomically returns the next per-organization number for a counter kind (order, kot).';

grant execute on function public.next_org_seq(uuid, text) to authenticated, service_role;
grant select, insert, update on public.org_counters to authenticated;
grant all privileges on public.org_counters to service_role;

-- ----------------------------------------------------------------------------
-- Menu categories
-- ----------------------------------------------------------------------------

create table public.menu_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),

  constraint menu_categories_name_not_blank check (length(btrim(name)) > 0)
);

comment on table public.menu_categories is
  'Menu sections (Hot Beverages, Pizzas, ...). Ordered by sort_order for the POS grid.';

create index menu_categories_organization_id_idx on public.menu_categories (organization_id);

alter table public.menu_categories enable row level security;

create policy menu_categories_platform_admin_all
  on public.menu_categories for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy menu_categories_member_select
  on public.menu_categories for select
  using (organization_id = public.current_org_id());

create policy menu_categories_member_insert
  on public.menu_categories for insert
  with check (organization_id = public.current_org_id());

create policy menu_categories_member_update
  on public.menu_categories for update
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy menu_categories_member_delete
  on public.menu_categories for delete
  using (organization_id = public.current_org_id());

grant select, insert, update, delete on public.menu_categories to authenticated;
grant all privileges on public.menu_categories to service_role;

-- ----------------------------------------------------------------------------
-- Menu items
-- ----------------------------------------------------------------------------

create table public.menu_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  category_id     uuid references public.menu_categories (id) on delete set null,
  name            text not null,
  sku             text,
  price           numeric(10, 2) not null,
  image_url       text,
  is_available    boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint menu_items_name_not_blank check (length(btrim(name)) > 0),
  constraint menu_items_price_non_negative check (price >= 0)
);

comment on table public.menu_items is
  'Sellable menu entries. image_url points into the public item-images storage bucket.';

create index menu_items_organization_id_idx on public.menu_items (organization_id);
create index menu_items_category_id_idx on public.menu_items (category_id);

create trigger menu_items_set_updated_at
  before update on public.menu_items
  for each row execute function public.set_updated_at();

alter table public.menu_items enable row level security;

create policy menu_items_platform_admin_all
  on public.menu_items for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy menu_items_member_select
  on public.menu_items for select
  using (organization_id = public.current_org_id());

create policy menu_items_member_insert
  on public.menu_items for insert
  with check (organization_id = public.current_org_id());

create policy menu_items_member_update
  on public.menu_items for update
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy menu_items_member_delete
  on public.menu_items for delete
  using (organization_id = public.current_org_id());

grant select, insert, update, delete on public.menu_items to authenticated;
grant all privileges on public.menu_items to service_role;

-- ----------------------------------------------------------------------------
-- Dining tables
-- ----------------------------------------------------------------------------

create table public.dining_tables (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  label           text not null,
  seats           int not null default 4,
  is_active       boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),

  constraint dining_tables_label_not_blank check (length(btrim(label)) > 0),
  constraint dining_tables_seats_positive check (seats > 0),
  constraint dining_tables_org_label_unique unique (organization_id, label)
);

comment on table public.dining_tables is
  'Physical tables for dine-in orders. Floor/section grouping lands with the table layout editor.';

create index dining_tables_organization_id_idx on public.dining_tables (organization_id);

alter table public.dining_tables enable row level security;

create policy dining_tables_platform_admin_all
  on public.dining_tables for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy dining_tables_member_select
  on public.dining_tables for select
  using (organization_id = public.current_org_id());

create policy dining_tables_member_insert
  on public.dining_tables for insert
  with check (organization_id = public.current_org_id());

create policy dining_tables_member_update
  on public.dining_tables for update
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy dining_tables_member_delete
  on public.dining_tables for delete
  using (organization_id = public.current_org_id());

grant select, insert, update, delete on public.dining_tables to authenticated;
grant all privileges on public.dining_tables to service_role;

-- ----------------------------------------------------------------------------
-- Orders
-- ----------------------------------------------------------------------------

create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  -- Per-organization running number from next_org_seq(); display_no is the
  -- customer-facing label derived from it ('ORD-65005545').
  order_no        bigint not null,
  display_no      text not null,

  channel         text not null default 'dine_in'
    check (channel in ('dine_in', 'delivery', 'pickup', 'online', 'swiggy', 'zomato', 'other')),
  status          text not null default 'new'
    check (status in ('new', 'in_billing', 'sent_to_kitchen', 'awaiting_payment', 'paid', 'delivered', 'cancelled')),

  table_id        uuid references public.dining_tables (id) on delete set null,
  customer_name   text,
  customer_phone  text,
  captain_name    text,

  subtotal        numeric(10, 2) not null default 0,
  gst_pct         numeric(4, 2)  not null default 5,
  gst_amount      numeric(10, 2) not null default 0,
  total           numeric(10, 2) not null default 0,
  payment_method  text check (payment_method is null or payment_method in ('cash', 'upi', 'card', 'split')),

  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint orders_org_order_no_unique unique (organization_id, order_no)
);

comment on table public.orders is
  'Orders across all channels (dine-in, delivery aggregators, pickup). GST totals are denormalized snapshots.';

create index orders_organization_id_idx on public.orders (organization_id);
create index orders_org_status_idx on public.orders (organization_id, status);
create index orders_table_id_idx on public.orders (table_id);
create index orders_created_at_idx on public.orders (created_at desc);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

alter table public.orders enable row level security;

create policy orders_platform_admin_all
  on public.orders for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy orders_member_select
  on public.orders for select
  using (organization_id = public.current_org_id());

create policy orders_member_insert
  on public.orders for insert
  with check (organization_id = public.current_org_id());

create policy orders_member_update
  on public.orders for update
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

-- No member delete: orders are cancelled via status, never hard-deleted.
create policy orders_platform_admin_delete
  on public.orders for delete
  using (public.is_platform_admin());

grant select, insert, update on public.orders to authenticated;
grant all privileges on public.orders to service_role;

-- ----------------------------------------------------------------------------
-- Order items
--
-- Line items snapshot name/price at order time so later menu edits do not
-- rewrite history. RLS is enforced through the parent order's organization
-- (the item row itself carries no organization_id).
-- ----------------------------------------------------------------------------

create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  name         text not null,
  qty          int not null check (qty > 0),
  unit_price   numeric(10, 2) not null check (unit_price >= 0),
  add_ons      jsonb not null default '[]'::jsonb,
  notes        text,
  created_at   timestamptz not null default now()
);

comment on table public.order_items is
  'Order lines. name/unit_price are snapshots; menu_item_id stays as a soft link when the menu item survives.';

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_menu_item_id_idx on public.order_items (menu_item_id);

alter table public.order_items enable row level security;

create policy order_items_platform_admin_all
  on public.order_items for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy order_items_member_select
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.organization_id = public.current_org_id()
    )
  );

create policy order_items_member_insert
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.organization_id = public.current_org_id()
    )
  );

create policy order_items_member_update
  on public.order_items for update
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.organization_id = public.current_org_id()
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.organization_id = public.current_org_id()
    )
  );

create policy order_items_member_delete
  on public.order_items for delete
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.organization_id = public.current_org_id()
    )
  );

grant select, insert, update, delete on public.order_items to authenticated;
grant all privileges on public.order_items to service_role;

-- ----------------------------------------------------------------------------
-- KOT tickets
-- ----------------------------------------------------------------------------

create table public.kot_tickets (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  order_id        uuid not null references public.orders (id) on delete cascade,
  kot_no          bigint not null,
  station         text not null default 'main',
  status          text not null default 'new'
    check (status in ('new', 'preparing', 'ready', 'delivered')),
  priority        text not null default 'normal'
    check (priority in ('normal', 'urgent')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint kot_tickets_org_kot_no_unique unique (organization_id, kot_no)
);

comment on table public.kot_tickets is
  'Kitchen order tickets. One order may fan out to multiple stations later; today everything is station main.';

create index kot_tickets_organization_id_idx on public.kot_tickets (organization_id);
create index kot_tickets_order_id_idx on public.kot_tickets (order_id);
create index kot_tickets_org_status_idx on public.kot_tickets (organization_id, status);

create trigger kot_tickets_set_updated_at
  before update on public.kot_tickets
  for each row execute function public.set_updated_at();

alter table public.kot_tickets enable row level security;

create policy kot_tickets_platform_admin_all
  on public.kot_tickets for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy kot_tickets_member_select
  on public.kot_tickets for select
  using (organization_id = public.current_org_id());

create policy kot_tickets_member_insert
  on public.kot_tickets for insert
  with check (organization_id = public.current_org_id());

create policy kot_tickets_member_update
  on public.kot_tickets for update
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy kot_tickets_member_delete
  on public.kot_tickets for delete
  using (organization_id = public.current_org_id());

grant select, insert, update, delete on public.kot_tickets to authenticated;
grant all privileges on public.kot_tickets to service_role;

-- ----------------------------------------------------------------------------
-- Realtime
--
-- POS and KDS screens subscribe to order/KOT changes.
-- ----------------------------------------------------------------------------

alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.kot_tickets;

-- ----------------------------------------------------------------------------
-- Storage: menu item images
--
-- Public bucket so POS grids render images without signed URLs. Writes are
-- limited to signed-in users; org-level scoping lands with the menu editor
-- (paths will be <organization_id>/<file>).
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do nothing;

create policy item_images_public_read
  on storage.objects for select
  using (bucket_id = 'item-images');

create policy item_images_authenticated_insert
  on storage.objects for insert to authenticated
  with check (bucket_id = 'item-images');

create policy item_images_authenticated_update
  on storage.objects for update to authenticated
  using (bucket_id = 'item-images')
  with check (bucket_id = 'item-images');

create policy item_images_authenticated_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'item-images');
