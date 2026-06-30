-- Ejecutar en el SQL Editor de tu proyecto de Supabase.
-- Crea las tablas y políticas necesarias para el registro de usuarios,
-- creación de organizaciones (workspaces) y unión por código de invitación.

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- profiles: datos del usuario, espejo de auth.users
-- ----------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- Crea automáticamente el profile cuando se registra un usuario en auth.users
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ----------------------------------------------------------------------------
-- organizations: workspaces
-- ----------------------------------------------------------------------------
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#2563EB',
  logo_url text,
  invite_code text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table organizations enable row level security;

-- Cualquier usuario autenticado puede leer organizaciones (necesario para
-- buscar el workspace por código de invitación antes de unirse).
create policy "organizations_select_authenticated" on organizations
  for select to authenticated using (true);

create policy "organizations_insert_owner" on organizations
  for insert to authenticated with check (auth.uid() = owner_id);

create policy "organizations_update_owner" on organizations
  for update to authenticated using (auth.uid() = owner_id);

-- ----------------------------------------------------------------------------
-- organization_members: relación usuario <-> workspace
-- ----------------------------------------------------------------------------
create table if not exists organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

alter table organization_members enable row level security;

create policy "organization_members_select_own" on organization_members
  for select to authenticated using (auth.uid() = user_id);

create policy "organization_members_insert_own" on organization_members
  for insert to authenticated with check (auth.uid() = user_id);
