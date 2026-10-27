-- ============================================================
-- NF Store — Supabase Schema
-- Run this in Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================

-- Categories (e.g. Netflix, Shahid, Gaming Accounts, Software)
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Products
create table products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete set null,
  name text not null,
  description text,
  price_omr numeric(10,3) not null check (price_omr >= 0),
  compare_at_price_omr numeric(10,3),       -- optional "was" price for discount display
  image_url text,
  stock int not null default 0,              -- units available (e.g. account slots)
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Orders
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,          -- human-friendly e.g. NF-10234
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  payment_method text not null check (payment_method in ('bank_transfer','online_link')),
  payment_status text not null default 'pending' check (payment_status in ('pending','under_review','confirmed','rejected')),
  order_status text not null default 'processing' check (order_status in ('processing','delivered','cancelled')),
  proof_url text,                              -- uploaded transfer receipt / payment proof
  reference_note text,                         -- e.g. transaction ref the customer typed in
  total_omr numeric(10,3) not null,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Order items (snapshot of product at time of purchase)
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,                  -- snapshot, survives product edits/deletion
  unit_price_omr numeric(10,3) not null,
  quantity int not null check (quantity > 0),
  delivered_payload text                        -- where admin pastes the actual account/code once ready
);

-- Store settings (single row: bank details, payment link, contact info)
create table store_settings (
  id int primary key default 1,
  bank_name text,
  bank_account_name text,
  bank_iban text,
  online_payment_link text,                    -- e.g. Thawani / PayPal.me link
  whatsapp_number text,
  instagram_handle text,
  check (id = 1)
);
insert into store_settings (id) values (1);

-- Admin users (maps to Supabase auth.users who are allowed into /admin)
create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Order number generator
-- ============================================================
create sequence order_number_seq start 1001;
create or replace function set_order_number()
returns trigger as $$
begin
  if new.order_number is null then
    new.order_number := 'NF-' || nextval('order_number_seq');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_order_number
before insert on orders
for each row execute function set_order_number();

-- ============================================================
-- updated_at auto-touch
-- ============================================================
create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_products_touch before update on products
for each row execute function touch_updated_at();

create trigger trg_orders_touch before update on orders
for each row execute function touch_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table categories enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table store_settings enable row level security;
alter table admins enable row level security;

-- Public (anon) can READ categories, active products, and store_settings
create policy "public read categories" on categories for select using (true);
create policy "public read active products" on products for select using (is_active = true);
create policy "public read store settings" on store_settings for select using (true);

-- Public (anon) can INSERT orders + order_items (checkout), but not read/update others' orders
create policy "public can create orders" on orders for insert with check (true);
create policy "public can create order items" on order_items for insert with check (true);

-- Admins (authenticated + present in admins table) get full access everywhere
create policy "admins full access categories" on categories for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

create policy "admins full access products" on products for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

create policy "admins full access orders" on orders for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

create policy "admins full access order_items" on order_items for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

create policy "admins full access store_settings" on store_settings for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

create policy "admins can see admins table" on admins for select
  using (exists (select 1 from admins a where a.user_id = auth.uid()));

-- ============================================================
-- Storage bucket for payment proof uploads (run separately if needed)
-- Supabase Dashboard > Storage > create bucket "payment-proofs" (public)
-- ============================================================
