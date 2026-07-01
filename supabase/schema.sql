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
-- Visibilidad de perfiles/miembros dentro de la misma organización.
-- Antes cada usuario solo veía su propia fila (un count() de miembros daba
-- siempre 1). Ahora se puede ver a cualquier compañero de organización — lo
-- necesita el Semillero para evaluar skills/idiomas/badges de todo el equipo
-- al sugerir quién debería participar en un proyecto.
-- ----------------------------------------------------------------------------
create or replace function my_organization_ids()
returns setof uuid
language sql security definer stable
as $$ select organization_id from organization_members where user_id = auth.uid() $$;

drop policy if exists "organization_members_select_org" on organization_members;
create policy "organization_members_select_org" on organization_members
  for select to authenticated
  using (organization_id in (select my_organization_ids()));

drop policy if exists "profiles_select_org_members" on profiles;
create policy "profiles_select_org_members" on profiles
  for select to authenticated
  using (
    id in (
      select user_id from organization_members
      where organization_id in (select my_organization_ids())
    )
  );

-- ----------------------------------------------------------------------------
-- El Semillero: chats de ideación con IA. El usuario describe una idea, la IA
-- (vía la Edge Function `semillero-chat`, ver supabase/functions/) la pule y,
-- cuando ya tiene contexto suficiente, sugiere equipo/líder/primeros pasos
-- usando el roster real de la organización. Solo el owner de la organización
-- puede crear chats — es la vista de admin/creador, no de cualquier miembro.
-- ----------------------------------------------------------------------------
create table if not exists semillero_chats (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nueva idea',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table semillero_chats enable row level security;

drop policy if exists "semillero_chats_select_own" on semillero_chats;
create policy "semillero_chats_select_own" on semillero_chats
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "semillero_chats_insert_owner" on semillero_chats;
create policy "semillero_chats_insert_owner" on semillero_chats
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from organizations o where o.id = organization_id and o.owner_id = auth.uid())
  );

drop policy if exists "semillero_chats_update_own" on semillero_chats;
create policy "semillero_chats_update_own" on semillero_chats
  for update to authenticated using (auth.uid() = user_id);

drop policy if exists "semillero_chats_delete_own" on semillero_chats;
create policy "semillero_chats_delete_own" on semillero_chats
  for delete to authenticated using (auth.uid() = user_id);

-- team_suggestion: cuando la IA ya sugirió equipo, se guarda estructurado acá
-- (además del texto conversacional en content) para poder re-renderizar la
-- tarjeta de sugerencia sin volver a llamar a la IA al reabrir el chat.
create table if not exists semillero_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references semillero_chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  team_suggestion jsonb,
  created_at timestamptz not null default now()
);

alter table semillero_messages enable row level security;

drop policy if exists "semillero_messages_select_own" on semillero_messages;
create policy "semillero_messages_select_own" on semillero_messages
  for select to authenticated
  using (chat_id in (select id from semillero_chats where user_id = auth.uid()));

drop policy if exists "semillero_messages_insert_own" on semillero_messages;
create policy "semillero_messages_insert_own" on semillero_messages
  for insert to authenticated
  with check (chat_id in (select id from semillero_chats where user_id = auth.uid()));

-- Necesaria para "Regenerar respuesta": borra el mensaje del asistente viejo
-- antes de insertar el nuevo.
drop policy if exists "semillero_messages_delete_own" on semillero_messages;
create policy "semillero_messages_delete_own" on semillero_messages
  for delete to authenticated
  using (chat_id in (select id from semillero_chats where user_id = auth.uid()));

-- Necesaria para persistir createdProjectId/createdTeamId en team_suggestion
-- después de crear el proyecto/equipo real desde una sugerencia, así
-- "Ver proyecto"/"Ver equipo" sobrevive a salir de la pantalla y volver.
drop policy if exists "semillero_messages_update_own" on semillero_messages;
create policy "semillero_messages_update_own" on semillero_messages
  for update to authenticated
  using (chat_id in (select id from semillero_chats where user_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- projects: entregable real de una idea, creado a mano o desde una sugerencia
-- de equipo de El Semillero (ver team_suggestion arriba). Solo el owner de la
-- organización puede crear/editar/borrar — mismo criterio que semillero_chats.
-- ----------------------------------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  color text not null default '#2563EB',
  status text not null default 'planning' check (status in ('planning', 'active', 'on_hold', 'completed')),
  leader_id uuid references auth.users(id) on delete set null,
  -- primeros pasos sugeridos por la IA al crear el proyecto (si aplica)
  first_steps text[] not null default '{}',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table projects enable row level security;

drop policy if exists "projects_select_org" on projects;
create policy "projects_select_org" on projects
  for select to authenticated
  using (organization_id in (select my_organization_ids()));

drop policy if exists "projects_insert_owner" on projects;
create policy "projects_insert_owner" on projects
  for insert to authenticated
  with check (
    auth.uid() = created_by
    and exists (select 1 from organizations o where o.id = organization_id and o.owner_id = auth.uid())
  );

drop policy if exists "projects_update_owner" on projects;
create policy "projects_update_owner" on projects
  for update to authenticated
  using (exists (select 1 from organizations o where o.id = organization_id and o.owner_id = auth.uid()));

drop policy if exists "projects_delete_owner" on projects;
create policy "projects_delete_owner" on projects
  for delete to authenticated
  using (exists (select 1 from organizations o where o.id = organization_id and o.owner_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- project_members: quién participa en cada proyecto y con qué rol (líder u
-- otro rol sugerido por la IA, o null si se agregó a mano).
-- ----------------------------------------------------------------------------
create table if not exists project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_in_team text,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

alter table project_members enable row level security;

drop policy if exists "project_members_select_org" on project_members;
create policy "project_members_select_org" on project_members
  for select to authenticated
  using (project_id in (select id from projects where organization_id in (select my_organization_ids())));

drop policy if exists "project_members_insert_owner" on project_members;
create policy "project_members_insert_owner" on project_members
  for insert to authenticated
  with check (
    project_id in (
      select p.id from projects p
      join organizations o on o.id = p.organization_id
      where o.owner_id = auth.uid()
    )
  );

drop policy if exists "project_members_delete_owner" on project_members;
create policy "project_members_delete_owner" on project_members
  for delete to authenticated
  using (
    project_id in (
      select p.id from projects p
      join organizations o on o.id = p.organization_id
      where o.owner_id = auth.uid()
    )
  );

-- Un proyecto también puede llevar metas, áreas afectadas e ícono propio
-- (mismo patrón que avatar_url de profiles: null | URL subida/pegada).
alter table projects
  add column if not exists goals text[] not null default '{}',
  add column if not exists areas text[] not null default '{}',
  add column if not exists icon_url text;

-- ----------------------------------------------------------------------------
-- teams: equipos reales de la organización (no confundir con el "equipo
-- sugerido" del Semillero, que vive solo en team_suggestion/project_members).
-- Un proyecto manual puede llevar uno o más de estos equipos (project_teams).
-- ----------------------------------------------------------------------------
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  color text not null default '#2563EB',
  icon_url text,
  leader_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table teams enable row level security;

drop policy if exists "teams_select_org" on teams;
create policy "teams_select_org" on teams
  for select to authenticated
  using (organization_id in (select my_organization_ids()));

drop policy if exists "teams_insert_owner" on teams;
create policy "teams_insert_owner" on teams
  for insert to authenticated
  with check (
    auth.uid() = created_by
    and exists (select 1 from organizations o where o.id = organization_id and o.owner_id = auth.uid())
  );

drop policy if exists "teams_update_owner" on teams;
create policy "teams_update_owner" on teams
  for update to authenticated
  using (exists (select 1 from organizations o where o.id = organization_id and o.owner_id = auth.uid()));

drop policy if exists "teams_delete_owner" on teams;
create policy "teams_delete_owner" on teams
  for delete to authenticated
  using (exists (select 1 from organizations o where o.id = organization_id and o.owner_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- team_members: integrantes de cada equipo y su rol dentro de ese equipo
-- (uno de 6 roles comunes o uno personalizado, ver TEAM_ROLE_OPTIONS en
-- src/lib/teams.ts; el encargado además queda marcado en teams.leader_id).
-- ----------------------------------------------------------------------------
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_in_team text,
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

alter table team_members enable row level security;

drop policy if exists "team_members_select_org" on team_members;
create policy "team_members_select_org" on team_members
  for select to authenticated
  using (team_id in (select id from teams where organization_id in (select my_organization_ids())));

drop policy if exists "team_members_insert_owner" on team_members;
create policy "team_members_insert_owner" on team_members
  for insert to authenticated
  with check (
    team_id in (
      select t.id from teams t
      join organizations o on o.id = t.organization_id
      where o.owner_id = auth.uid()
    )
  );

drop policy if exists "team_members_delete_owner" on team_members;
create policy "team_members_delete_owner" on team_members
  for delete to authenticated
  using (
    team_id in (
      select t.id from teams t
      join organizations o on o.id = t.organization_id
      where o.owner_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- project_teams: qué equipos participan en cada proyecto (un proyecto manual
-- puede llevar uno o más equipos ya formados; el creado desde El Semillero
-- sigue usando project_members directo, ver arriba).
-- ----------------------------------------------------------------------------
create table if not exists project_teams (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, team_id)
);

alter table project_teams enable row level security;

drop policy if exists "project_teams_select_org" on project_teams;
create policy "project_teams_select_org" on project_teams
  for select to authenticated
  using (project_id in (select id from projects where organization_id in (select my_organization_ids())));

drop policy if exists "project_teams_insert_owner" on project_teams;
create policy "project_teams_insert_owner" on project_teams
  for insert to authenticated
  with check (
    project_id in (
      select p.id from projects p
      join organizations o on o.id = p.organization_id
      where o.owner_id = auth.uid()
    )
  );

drop policy if exists "project_teams_delete_owner" on project_teams;
create policy "project_teams_delete_owner" on project_teams
  for delete to authenticated
  using (
    project_id in (
      select p.id from projects p
      join organizations o on o.id = p.organization_id
      where o.owner_id = auth.uid()
    )
  );
