-- EcoTransport / CargoPlus initial Supabase schema
-- Ejecutar en Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company text default 'NEMFIS Green Logistics',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cargo_spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  length numeric not null,
  width numeric not null,
  height numeric not null,
  max_weight numeric not null,
  type text not null check (type in ('container', 'truck', 'pallet', 'trailer', 'platform')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cargo_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  length numeric not null,
  width numeric not null,
  height numeric not null,
  weight numeric not null,
  quantity integer not null default 1,
  color text not null default '#10b981',
  stackable boolean not null default true,
  tiltable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cargo_loads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  selected_space_id uuid references public.cargo_spaces(id) on delete set null,
  loading_mode text not null default 'FIFO' check (loading_mode in ('FIFO', 'LIFO')),
  placed_items jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cargo_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  load_id uuid references public.cargo_loads(id) on delete cascade,
  origin jsonb,
  destination jsonb,
  distance_km numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  container_list jsonb not null default '[]'::jsonb,
  cargas_history jsonb not null default '[]'::jsonb,
  route jsonb not null default '{}'::jsonb,
  selected_container_id text,
  setup_done boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.cargo_spaces enable row level security;
alter table public.cargo_items enable row level security;
alter table public.cargo_loads enable row level security;
alter table public.cargo_routes enable row level security;
alter table public.app_state enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "cargo_spaces_all_own" on public.cargo_spaces;
drop policy if exists "cargo_items_all_own" on public.cargo_items;
drop policy if exists "cargo_loads_all_own" on public.cargo_loads;
drop policy if exists "cargo_routes_all_own" on public.cargo_routes;
drop policy if exists "app_state_all_own" on public.app_state;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "cargo_spaces_all_own" on public.cargo_spaces
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "cargo_items_all_own" on public.cargo_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "cargo_loads_all_own" on public.cargo_loads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "cargo_routes_all_own" on public.cargo_routes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "app_state_all_own" on public.app_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
