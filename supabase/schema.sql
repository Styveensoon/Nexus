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
  -- badges: [{ id, name, color }] — legacy, nunca se escribió desde el
  -- cliente ni se lee ya desde ningún lado (ProfileScreen, MemberProfileModal
  -- y la Edge Function semillero-chat ya usan la tabla relacional
  -- `profile_badges` en su lugar). Se deja la columna sin dropear por ahora
  -- para no forzar una migración de limpieza sin necesidad real.
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

-- ----------------------------------------------------------------------------
-- tasks: unidad de trabajo dentro de un proyecto. Se asigna a UNA persona o a
-- UN equipo (nunca ambos), y solo puede crearla/editarla/borrarla el líder de
-- ese proyecto (projects.leader_id) o el owner de la organización — un member
-- normal no puede crear tasks. El asignado (la persona, o cualquier
-- integrante si se asignó a un equipo) solo puede tocar el status; el trigger
-- de abajo es lo que impide que además cambie título/descripción/asignación/
-- fechas/prioridad. Igual que projects/teams, cualquier miembro de la
-- organización puede VER la lista de tasks (solo se restringe quién muta y
-- quién comenta).
-- ----------------------------------------------------------------------------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('backlog', 'pending', 'in_progress', 'in_review', 'testing', 'blocked', 'completed', 'cancelled')),
  assigned_user_id uuid references auth.users(id) on delete set null,
  assigned_team_id uuid references teams(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint tasks_assignee_xor check (
    (assigned_user_id is not null and assigned_team_id is null)
    or (assigned_user_id is null and assigned_team_id is not null)
  )
);

-- Fechas de planificación (para el Calendar) y prioridad, agregadas después
-- del `create table` original. Van como `alter table` por la misma razón que
-- en task_comments más abajo: `create table if not exists` es un no-op si la
-- tabla ya existía de una corrida previa del schema.
alter table tasks
  add column if not exists start_date date,
  add column if not exists due_date date,
  add column if not exists priority text not null default 'medium';

alter table tasks drop constraint if exists tasks_priority_check;
alter table tasks
  add constraint tasks_priority_check check (priority in ('low', 'medium', 'high', 'urgent'));

-- status pasó de 4 a 8 valores (se agregaron backlog/in_review/testing/cancelled)
-- después del `create table` original — mismo criterio que tasks_priority_check:
-- drop + add en vez de un DO $$ IF NOT EXISTS $$, así se actualiza el constraint
-- si ya existía con la lista vieja de valores.
alter table tasks drop constraint if exists tasks_status_check;
alter table tasks
  add constraint tasks_status_check
  check (status in ('backlog', 'pending', 'in_progress', 'in_review', 'testing', 'blocked', 'completed', 'cancelled'));

alter table tasks drop constraint if exists tasks_dates_order_check;
alter table tasks
  add constraint tasks_dates_order_check check (start_date is null or due_date is null or due_date >= start_date);

alter table tasks enable row level security;

drop policy if exists "tasks_select_org" on tasks;
create policy "tasks_select_org" on tasks
  for select to authenticated
  using (project_id in (select id from projects where organization_id in (select my_organization_ids())));

-- Solo el líder del proyecto o el owner de la organización crean tasks, y
-- solo pueden asignarlas a alguien realmente involucrado en ese proyecto:
-- el propio líder, un integrante agregado directo (project_members, flujo
-- Semillero) o un integrante de algún equipo ya asignado (project_teams).
drop policy if exists "tasks_insert_leader_owner" on tasks;
create policy "tasks_insert_leader_owner" on tasks
  for insert to authenticated
  with check (
    auth.uid() = created_by
    and exists (
      select 1 from projects p
      join organizations o on o.id = p.organization_id
      where p.id = project_id and (p.leader_id = auth.uid() or o.owner_id = auth.uid())
    )
    and (
      (
        assigned_user_id is not null
        and (
          assigned_user_id = (select leader_id from projects where id = project_id)
          or exists (select 1 from project_members pm where pm.project_id = project_id and pm.user_id = assigned_user_id)
          or exists (
            select 1 from project_teams pt
            join team_members tm on tm.team_id = pt.team_id
            where pt.project_id = project_id and tm.user_id = assigned_user_id
          )
        )
      )
      or (
        assigned_team_id is not null
        and exists (select 1 from project_teams pt where pt.project_id = project_id and pt.team_id = assigned_team_id)
      )
    )
  );

-- Fila visible/actualizable tanto para líder+owner (edición completa) como
-- para el asignado (solo para poder cambiar el status) — la restricción de
-- QUÉ columnas puede tocar cada quién vive en el trigger de abajo, no acá.
drop policy if exists "tasks_update_involved" on tasks;
create policy "tasks_update_involved" on tasks
  for update to authenticated
  using (
    exists (
      select 1 from projects p
      join organizations o on o.id = p.organization_id
      where p.id = project_id and (p.leader_id = auth.uid() or o.owner_id = auth.uid())
    )
    or assigned_user_id = auth.uid()
    or (assigned_team_id is not null and exists (select 1 from team_members tm where tm.team_id = assigned_team_id and tm.user_id = auth.uid()))
  )
  with check (
    exists (
      select 1 from projects p
      join organizations o on o.id = p.organization_id
      where p.id = project_id and (p.leader_id = auth.uid() or o.owner_id = auth.uid())
    )
    or assigned_user_id = auth.uid()
    or (assigned_team_id is not null and exists (select 1 from team_members tm where tm.team_id = assigned_team_id and tm.user_id = auth.uid()))
  );

drop policy if exists "tasks_delete_leader_owner" on tasks;
create policy "tasks_delete_leader_owner" on tasks
  for delete to authenticated
  using (
    exists (
      select 1 from projects p
      join organizations o on o.id = p.organization_id
      where p.id = project_id and (p.leader_id = auth.uid() or o.owner_id = auth.uid())
    )
  );

-- Enforcement a nivel de columna: si quien actualiza NO es líder/owner del
-- proyecto, solo puede tocar `status` — cualquier otro cambio se rechaza.
-- La policy de arriba ya deja pasar la fila; esto es lo que de verdad impide
-- que el asignado reescriba título/descripción/asignación.
create or replace function enforce_task_update_permissions()
returns trigger
language plpgsql
security definer
as $$
declare
  is_privileged boolean;
begin
  select exists (
    select 1 from projects p
    join organizations o on o.id = p.organization_id
    where p.id = new.project_id and (p.leader_id = auth.uid() or o.owner_id = auth.uid())
  ) into is_privileged;

  if is_privileged then
    return new;
  end if;

  if new.title <> old.title
    or new.description is distinct from old.description
    or new.project_id <> old.project_id
    or new.assigned_user_id is distinct from old.assigned_user_id
    or new.assigned_team_id is distinct from old.assigned_team_id
    or new.start_date is distinct from old.start_date
    or new.due_date is distinct from old.due_date
    or new.priority <> old.priority
    or new.created_by <> old.created_by then
    raise exception 'Solo el líder del proyecto o el owner pueden editar esta task, el asignado solo puede cambiar el status';
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_enforce_update_permissions on tasks;
create trigger tasks_enforce_update_permissions
  before update on tasks
  for each row execute function enforce_task_update_permissions();

-- ----------------------------------------------------------------------------
-- task_comments: chat de una task. A diferencia de projects/teams, NO es
-- visible para toda la organización — solo para quien está involucrado
-- (líder del proyecto, owner de la organización, o el asignado: la persona o
-- cualquier integrante del equipo asignado). Es un chat de trabajo, no un
-- feed público.
-- ----------------------------------------------------------------------------
create or replace function task_is_involved(target_task_id uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from tasks t
    join projects p on p.id = t.project_id
    join organizations o on o.id = p.organization_id
    where t.id = target_task_id
      and (
        p.leader_id = auth.uid()
        or o.owner_id = auth.uid()
        or t.assigned_user_id = auth.uid()
        or (t.assigned_team_id is not null and exists (select 1 from team_members tm where tm.team_id = t.assigned_team_id and tm.user_id = auth.uid()))
      )
  )
$$;

create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- Responder a otro comentario del mismo chat (opcional, muestra una cita
-- arriba del mensaje). attachment_type: 'image'/'file' suben al bucket
-- `avatars` (ver icons.ts) y attachment_url es esa URL de Storage; 'link'
-- guarda la URL pegada tal cual en attachment_url; 'date' guarda una fecha
-- ISO (yyyy-mm-dd) en attachment_url — no es una URL real, se reusa la
-- misma columna para no crear una tabla de adjuntos aparte para 4 casos tan
-- simples. attachment_name es el nombre original del archivo (solo aplica
-- a 'file').
-- Van como `alter table` (no dentro del `create table` de arriba) porque
-- `create table if not exists` es un no-op si la tabla ya existía de una
-- corrida previa del schema — sin esto las columnas nunca se crean.
alter table task_comments
  add column if not exists reply_to_id uuid references task_comments(id) on delete set null,
  add column if not exists attachment_url text,
  add column if not exists attachment_type text,
  add column if not exists attachment_name text;

-- 'link'/'date' se agregaron después de 'image'/'file' — drop+add en vez de
-- un DO $$ IF NOT EXISTS $$ porque acá sí necesitamos que se actualice el
-- constraint si ya existía con la lista vieja de valores.
alter table task_comments drop constraint if exists task_comments_attachment_type_check;
alter table task_comments
  add constraint task_comments_attachment_type_check check (attachment_type in ('image', 'file', 'link', 'date'));

alter table task_comments enable row level security;

drop policy if exists "task_comments_select_involved" on task_comments;
create policy "task_comments_select_involved" on task_comments
  for select to authenticated
  using (task_is_involved(task_id));

drop policy if exists "task_comments_insert_involved" on task_comments;

create policy "task_comments_insert_involved" on task_comments
  for insert to authenticated
  with check (auth.uid() = user_id and task_is_involved(task_id));

-- Solo el autor puede borrar su propio comentario (no el líder/owner sobre
-- comentarios ajenos — es un chat, no un feed moderado).
drop policy if exists "task_comments_delete_own" on task_comments;
create policy "task_comments_delete_own" on task_comments
  for delete to authenticated
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- task_comment_reactions: una reacción (like/corazón/dislike/duda) por
-- persona por comentario, estilo WhatsApp — no varias reacciones distintas
-- del mismo usuario en el mismo comentario. Tocar la misma reacción que ya
-- pusiste la quita (toggle); tocar una distinta la reemplaza (lo maneja el
-- cliente con upsert + delete, ver reactToComment en lib/tasks.ts).
-- ----------------------------------------------------------------------------
create table if not exists task_comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references task_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('like', 'heart', 'dislike', 'question')),
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

alter table task_comment_reactions enable row level security;

drop policy if exists "task_comment_reactions_select_involved" on task_comment_reactions;
create policy "task_comment_reactions_select_involved" on task_comment_reactions
  for select to authenticated
  using (
    exists (
      select 1 from task_comments tc
      where tc.id = comment_id and task_is_involved(tc.task_id)
    )
  );

drop policy if exists "task_comment_reactions_insert_own" on task_comment_reactions;
create policy "task_comment_reactions_insert_own" on task_comment_reactions
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from task_comments tc
      where tc.id = comment_id and task_is_involved(tc.task_id)
    )
  );

drop policy if exists "task_comment_reactions_update_own" on task_comment_reactions;
create policy "task_comment_reactions_update_own" on task_comment_reactions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "task_comment_reactions_delete_own" on task_comment_reactions;
create policy "task_comment_reactions_delete_own" on task_comment_reactions
  for delete to authenticated
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- profile_badges: reconocimientos otorgados a un colaborador (Líder Nato,
-- Team Player, Mentor, etc.). El catálogo de tipos es fijo, vive en código
-- (BADGE_CATALOG en src/lib/badges.ts) — no hay tabla de tipos porque hoy no
-- son personalizables. Solo puede otorgar/quitar un badge el owner de la
-- organización, o el encargado (teams.leader_id) de algún equipo donde esa
-- persona sea integrante — "manager" en este esquema se mapea a encargado de
-- equipo, no a líder de proyecto. Cualquier miembro de la organización puede
-- VER los badges de sus compañeros (mismo criterio que profiles_select_org_members).
-- ----------------------------------------------------------------------------
create table if not exists profile_badges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  profile_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null,
  granted_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (organization_id, profile_id, badge_key)
);

alter table profile_badges enable row level security;

-- true si auth.uid() puede otorgar/quitar badges a target_profile_id dentro
-- de organization_id: es el owner de esa organización, o es encargado de
-- algún equipo de esa organización del que target_profile_id es integrante.
create or replace function is_badge_manager_for(org_id uuid, target_profile_id uuid)
returns boolean
language sql security definer stable
as $$
  select
    exists (select 1 from organizations o where o.id = org_id and o.owner_id = auth.uid())
    or exists (
      select 1 from teams t
      join team_members tm on tm.team_id = t.id
      where t.organization_id = org_id and t.leader_id = auth.uid() and tm.user_id = target_profile_id
    )
$$;

drop policy if exists "profile_badges_select_org" on profile_badges;
create policy "profile_badges_select_org" on profile_badges
  for select to authenticated
  using (organization_id in (select my_organization_ids()));

drop policy if exists "profile_badges_insert_manager" on profile_badges;
create policy "profile_badges_insert_manager" on profile_badges
  for insert to authenticated
  with check (auth.uid() = granted_by and is_badge_manager_for(organization_id, profile_id));

drop policy if exists "profile_badges_delete_manager" on profile_badges;
create policy "profile_badges_delete_manager" on profile_badges
  for delete to authenticated
  using (is_badge_manager_for(organization_id, profile_id));

-- ----------------------------------------------------------------------------
-- activity_log: feed curado de actividad de la organización (creaciones +
-- cambios de estado clave — no cada edición de campo, ver docs/ESTADO.md).
-- actor_name/target_name se guardan como snapshot de texto en el momento del
-- log, no se resuelven con un join a profiles en cada lectura: si esa persona
-- deja la organización más adelante, profiles_select_org_members ya no
-- dejaría verla al resto, pero el historial debe seguir siendo legible.
-- project_id/team_id SÍ son FK reales (para poder filtrar "actividad de este
-- proyecto/equipo") con on delete set null; entity_id es un uuid plano sin FK
-- porque puede apuntar a project/team/task/badge indistintamente (polimórfico)
-- y porque en un "_deleted" la fila referenciada ya no existe.
-- ----------------------------------------------------------------------------
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null,
  action text not null,
  entity_type text not null check (entity_type in ('project', 'team', 'task', 'badge', 'member')),
  entity_id uuid,
  entity_name text not null,
  project_id uuid references projects(id) on delete set null,
  team_id uuid references teams(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table activity_log enable row level security;

drop policy if exists "activity_log_select_org" on activity_log;
create policy "activity_log_select_org" on activity_log
  for select to authenticated
  using (organization_id in (select my_organization_ids()));

-- Autoatestiguado: cada acción se loguea desde el cliente inmediatamente
-- después de que la mutación real (con su propia RLS) ya tuvo éxito. El peor
-- caso de confiar en el cliente acá es una entrada de historial falsa sobre
-- uno mismo, no un cambio de datos con privilegios reales.
drop policy if exists "activity_log_insert_self" on activity_log;
create policy "activity_log_insert_self" on activity_log
  for insert to authenticated
  with check (auth.uid() = actor_id and organization_id in (select my_organization_ids()));
