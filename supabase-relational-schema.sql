alter table public.users add column if not exists store_slug text;
alter table public.users add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.users add column if not exists payload jsonb not null default '{}'::jsonb;

alter table public.stores add column if not exists visits bigint not null default 0;
alter table public.stores add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.stores add column if not exists payload jsonb not null default '{}'::jsonb;

alter table public.products add column if not exists stock integer not null default 0;
alter table public.products add column if not exists category text not null default '';
alter table public.products add column if not exists sku text not null default '';
alter table public.products add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.products add column if not exists payload jsonb not null default '{}'::jsonb;

alter table public.orders add column if not exists product_id text not null default '';
alter table public.orders add column if not exists product_name text not null default '';
alter table public.orders add column if not exists customer_email text not null default '';
alter table public.orders add column if not exists customer_phone text not null default '';
alter table public.orders add column if not exists amount numeric(12, 2) not null default 0;
alter table public.orders add column if not exists status text not null default 'pending';
alter table public.orders add column if not exists order_number text not null default '';
alter table public.orders add column if not exists tracking_code text not null default '';
alter table public.orders add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.orders add column if not exists payload jsonb not null default '{}'::jsonb;

create table if not exists public.customers (
  id text primary key,
  store_slug text not null references public.stores(slug) on delete cascade,
  email text not null default '',
  phone text not null default '',
  name text not null default '',
  password_hash text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists stores_owner_id_idx on public.stores (owner_id);
create index if not exists products_store_slug_idx on public.products (store_slug);
create index if not exists orders_store_slug_idx on public.orders (store_slug);
create index if not exists customers_store_slug_idx on public.customers (store_slug);
create index if not exists customers_email_idx on public.customers (email);
create unique index if not exists users_email_unique_idx on public.users (lower(email));

update public.users
set store_slug = coalesce(store_slug, ''),
    updated_at = coalesce(updated_at, created_at, timezone('utc', now())),
    payload = coalesce(payload, '{}'::jsonb);

update public.stores
set visits = coalesce(visits, 0),
    updated_at = coalesce(updated_at, created_at, timezone('utc', now())),
    payload = coalesce(payload, '{}'::jsonb);

update public.products
set stock = coalesce(stock, 0),
    category = coalesce(category, ''),
    sku = coalesce(sku, ''),
    updated_at = coalesce(updated_at, created_at, timezone('utc', now())),
    payload = coalesce(payload, '{}'::jsonb);

update public.orders
set product_id = coalesce(product_id, ''),
    product_name = coalesce(product_name, ''),
    customer_email = coalesce(customer_email, ''),
    customer_phone = coalesce(customer_phone, ''),
    amount = coalesce(amount, total, 0),
    status = coalesce(nullif(status, ''), 'pending'),
    order_number = coalesce(order_number, ''),
    tracking_code = coalesce(tracking_code, ''),
    updated_at = coalesce(updated_at, created_at, timezone('utc', now())),
    payload = coalesce(payload, '{}'::jsonb);

alter table public.users enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.customers enable row level security;

drop policy if exists service_role_only on public.users;
create policy service_role_only on public.users for all to service_role using (true) with check (true);

drop policy if exists service_role_only on public.stores;
create policy service_role_only on public.stores for all to service_role using (true) with check (true);

drop policy if exists service_role_only on public.products;
create policy service_role_only on public.products for all to service_role using (true) with check (true);

drop policy if exists service_role_only on public.orders;
create policy service_role_only on public.orders for all to service_role using (true) with check (true);

drop policy if exists service_role_only on public.customers;
create policy service_role_only on public.customers for all to service_role using (true) with check (true);
