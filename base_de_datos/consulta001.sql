-- ============================================================
-- DevProject Manager — Auth Schema
-- Correr en: Supabase Dashboard > SQL Editor
-- ============================================================


-- ------------------------------------------------------------
-- 1. ENUMS
-- ------------------------------------------------------------

create type public.rol_usuario as enum (
  'admin',
  'project_manager',
  'developer',
  'viewer'
);

create type public.estado_usuario as enum (
  'activo',
  'inactivo',
  'suspendido'
);

create type public.nivel_experiencia as enum (
  'junior',
  'semi_senior',
  'senior',
  'lead'
);


-- ------------------------------------------------------------
-- 2. TABLA: profiles
-- Se llena automáticamente via trigger al hacer sign up
-- ------------------------------------------------------------

create table public.profiles (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  nombre           text,
  apellido         text,
  avatar_url       text,
  rol              public.rol_usuario not null default 'developer',
  estado           public.estado_usuario not null default 'activo',
  creado_at        timestamp with time zone default now(),
  actualizado_at   timestamp with time zone default now(),

  constraint profiles_user_id_key unique (user_id)
);


-- ------------------------------------------------------------
-- 3. TABLA: perfil_desarrollador
-- El usuario la completa después del registro
-- ------------------------------------------------------------

create table public.perfil_desarrollador (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  especialidad       text,
  habilidades        text[],
  nivel_experiencia  public.nivel_experiencia,
  bio                text,
  actualizado_at     timestamp with time zone default now(),

  constraint perfil_desarrollador_user_id_key unique (user_id)
);


-- ------------------------------------------------------------
-- 4. TRIGGER: crear profile automáticamente al hacer sign up
-- ------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, nombre, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ------------------------------------------------------------
-- 5. FUNCIÓN: actualizar updated_at automáticamente
-- ------------------------------------------------------------

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger set_perfil_dev_updated_at
  before update on public.perfil_desarrollador
  for each row execute procedure public.handle_updated_at();


-- ------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------

-- profiles
alter table public.profiles enable row level security;

create policy "Usuario ve su propio perfil"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Usuario edita su propio perfil"
  on public.profiles for update
  using (auth.uid() = user_id);

-- perfil_desarrollador
alter table public.perfil_desarrollador enable row level security;

create policy "Usuario ve su perfil de desarrollador"
  on public.perfil_desarrollador for select
  using (auth.uid() = user_id);

create policy "Usuario crea su perfil de desarrollador"
  on public.perfil_desarrollador for insert
  with check (auth.uid() = user_id);

create policy "Usuario edita su perfil de desarrollador"
  on public.perfil_desarrollador for update
  using (auth.uid() = user_id);