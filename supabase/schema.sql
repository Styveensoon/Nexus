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

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- Perfil completo del colaborador (alimenta al futuro Semillero IA).
-- Convención de avatar_url: null = sin elegir, "default:avatar_01.png" = uno
-- de los avatares prediseñados en assets/images/avatares, URL real = foto subida.
alter table profiles
  add column if not exists avatar_url text,
  add column if not exists avatar_color text not null default '#2563EB',
  add column if not exists nickname text,
  add column if not exists bio text,
  add column if not exists timezone text,
  add column if not exists role text,
  add column if not exists custom_role text,
  add column if not exists skills text[] not null default '{}',
  add column if not exists skill_levels jsonb not null default '{}'::jsonb,
  add column if not exists languages text[] not null default '{}',
  add column if not exists language_levels jsonb not null default '{}'::jsonb,
  -- badges: [{ id, name, color }] — no editable desde el cliente todavía;
  -- quién los otorga (team leaders/admins) es trabajo pendiente.
  add column if not exists badges jsonb not null default '[]'::jsonb;

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
drop policy if exists "organizations_select_authenticated" on organizations;
create policy "organizations_select_authenticated" on organizations
  for select to authenticated using (true);

drop policy if exists "organizations_insert_owner" on organizations;
create policy "organizations_insert_owner" on organizations
  for insert to authenticated with check (auth.uid() = owner_id);

drop policy if exists "organizations_update_owner" on organizations;
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

drop policy if exists "organization_members_select_own" on organization_members;
create policy "organization_members_select_own" on organization_members
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "organization_members_insert_own" on organization_members;
create policy "organization_members_insert_own" on organization_members
  for insert to authenticated with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- avatars: bucket de Storage para fotos de perfil subidas por el usuario
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

drop policy if exists "avatar_public_read" on storage.objects;
create policy "avatar_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatar_insert_own" on storage.objects;
create policy "avatar_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar_update_own" on storage.objects;
create policy "avatar_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar_delete_own" on storage.objects;
create policy "avatar_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ----------------------------------------------------------------------------
-- OPCIONAL: solo si luego quieres mostrar el conteo real de miembros del equipo
-- en el Dashboard. Con la política de arriba cada usuario solo ve su propia fila,
-- así que un count() siempre da 1. Correr manualmente en el SQL Editor cuando se
-- quiera habilitar (y agregar getOrganizationMemberCount en src/lib/organizations.ts).
-- ----------------------------------------------------------------------------
-- create or replace function my_organization_ids()
-- returns setof uuid
-- language sql security definer stable
-- as $$ select organization_id from organization_members where user_id = auth.uid() $$;
--
-- create policy "organization_members_select_org" on organization_members
--   for select to authenticated
--   using (organization_id in (select my_organization_ids()));
