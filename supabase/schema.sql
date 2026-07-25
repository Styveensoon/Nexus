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
  -- assistant_chats / assistant_messages: "Aria", el Semillero reciclado como
  -- asistente general — a diferencia de semillero_chats (solo el owner, para
  -- armar equipos/proyectos desde una idea), Aria es para CUALQUIER miembro
  -- de la organización (owner, encargado de equipo, member), con un
  -- propósito distinto: ayudar a entender lo que YA existe (chat libre, o con
  -- el contexto de un proyecto/tarea puntual). Tablas paralelas a propósito,
  -- no se reusan las de Semillero (mismo criterio de aislamiento que Client
  -- Chat vs Task Chat) porque el scoping de RLS es distinto: acá cada persona
  -- ve únicamente SUS PROPIOS chats, sin ningún concepto de "owner ve todos".
  -- context_id es polimórfico según context_type (id de un proyecto o de una
  -- task) — sin FK directa a propósito, ya que puede apuntar a cualquiera de
  -- las dos tablas; la Edge Function valida acceso real en cada mensaje, no
  -- esta tabla.
  -- ----------------------------------------------------------------------------
  create table if not exists assistant_chats (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null default 'Nueva conversación',
    context_type text not null default 'free' check (context_type in ('free', 'project', 'task')),
    context_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  alter table assistant_chats enable row level security;

  drop policy if exists "assistant_chats_select_own" on assistant_chats;
  create policy "assistant_chats_select_own" on assistant_chats
    for select to authenticated using (auth.uid() = user_id);

  drop policy if exists "assistant_chats_insert_own" on assistant_chats;
  create policy "assistant_chats_insert_own" on assistant_chats
    for insert to authenticated
    with check (
      auth.uid() = user_id
      and exists (select 1 from organization_members om where om.organization_id = assistant_chats.organization_id and om.user_id = auth.uid())
    );

  drop policy if exists "assistant_chats_update_own" on assistant_chats;
  create policy "assistant_chats_update_own" on assistant_chats
    for update to authenticated using (auth.uid() = user_id);

  drop policy if exists "assistant_chats_delete_own" on assistant_chats;
  create policy "assistant_chats_delete_own" on assistant_chats
    for delete to authenticated using (auth.uid() = user_id);

  create table if not exists assistant_messages (
    id uuid primary key default gen_random_uuid(),
    chat_id uuid not null references assistant_chats(id) on delete cascade,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    -- Acción propuesta por Aria sobre la tarea del contexto de este chat
    -- (solo mensajes "assistant" en modo "task" la usan): {type, taskId,
    -- taskTitle, description, status: "pending"|"applied"|"dismissed", ...
    -- payload específico del tipo}. null = Aria solo respondió en texto, sin
    -- proponer ningún cambio. Mismo criterio que semillero_messages.team_suggestion
    -- (estructura persistida, no recalculada al reabrir el chat) — pero acá
    -- además el "Aceptar" ejecuta una escritura real (updateTask/
    -- updateTaskStatus), nunca se aplica sola.
    proposed_action jsonb,
    -- Tarjetas de detalle de tarea que Aria decidió mostrar junto a este
    -- mensaje (array de {id, title, status, priority, dueDate, startDate,
    -- assigneeLabel}, o null/[] si no aplica) — reconstruidas siempre
    -- server-side a partir del id que eligió el modelo (aria-assistant/
    -- index.ts, resolveTaskCards), nunca de datos que el modelo haya escrito.
    -- Se persisten junto al mensaje (mismo criterio que proposed_action) para
    -- que la tarjeta se vea igual al reabrir el chat, no solo en el momento.
    task_cards jsonb,
    -- Tarjeta de resumen del PROYECTO en sí (distinta de task_cards) —
    -- {name, description, status, goals, areas, leaderName, teamNames,
    -- memberCount, tasksTotal, tasksCompleted, tasksOverdue, tasksBlocked} o
    -- null. Solo aplica en modo "project" cuando la respuesta describe el
    -- proyecto en general, no el detalle de una tarea puntual (ver
    -- buildCardInstructions en aria-assistant/index.ts) — mismo criterio de
    -- reconstruir siempre server-side, nunca confiar en texto del modelo.
    project_card jsonb,
    created_at timestamptz not null default now()
  );

  -- assistant_messages ya existía de la ronda anterior de Aria — add column
  -- if not exists para que quede idempotente al re-correr el archivo.
  alter table assistant_messages
    add column if not exists proposed_action jsonb;
  alter table assistant_messages
    add column if not exists task_cards jsonb;
  alter table assistant_messages
    add column if not exists project_card jsonb;

  alter table assistant_messages enable row level security;

  drop policy if exists "assistant_messages_select_own" on assistant_messages;
  create policy "assistant_messages_select_own" on assistant_messages
    for select to authenticated
    using (chat_id in (select id from assistant_chats where user_id = auth.uid()));

  drop policy if exists "assistant_messages_insert_own" on assistant_messages;
  create policy "assistant_messages_insert_own" on assistant_messages
    for insert to authenticated
    with check (chat_id in (select id from assistant_chats where user_id = auth.uid()));

  -- Necesaria para marcar proposed_action.status en "pending"->"applied"/
  -- "dismissed" tras Aceptar/Rechazar una card de acción.
  drop policy if exists "assistant_messages_update_own" on assistant_messages;
  create policy "assistant_messages_update_own" on assistant_messages
    for update to authenticated
    using (chat_id in (select id from assistant_chats where user_id = auth.uid()));

  -- Necesaria para "Regenerar respuesta" (mismo patrón que semillero_messages).
  drop policy if exists "assistant_messages_delete_own" on assistant_messages;
  create policy "assistant_messages_delete_own" on assistant_messages
    for delete to authenticated
    using (chat_id in (select id from assistant_chats where user_id = auth.uid()));

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
    -- (el constraint de status se amplía más abajo, ver projects_status_check)
    -- primeros pasos sugeridos por la IA al crear el proyecto (si aplica)
    first_steps text[] not null default '{}',
    created_by uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
  );

  -- status pasó de 4 a 8 valores (se agregaron in_review/blocked/cancelled/
  -- archived) después del `create table` original — mismo criterio que
  -- tasks_status_check: drop + add en vez de un DO $$ IF NOT EXISTS $$, así se
  -- actualiza el constraint si ya existía con la lista vieja de valores. El
  -- nombre "projects_status_check" es el que Postgres le asigna por default a
  -- un check de columna sin nombre explícito (el de `create table` de arriba).
  alter table projects drop constraint if exists projects_status_check;
  alter table projects
    add constraint projects_status_check
    check (status in ('planning', 'active', 'in_review', 'on_hold', 'blocked', 'completed', 'cancelled', 'archived'));

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

  -- Resumen semanal generado por IA (Edge Function project-weekly-digest,
  -- docs/ARQUITECTURA.md "Reportes automáticos con IA") — null hasta la
  -- primera generación (filosofía anti-fake). Se sobrescribe en cada corrida
  -- (no hay historial de digests viejos, solo el más reciente).
  alter table projects
    add column if not exists last_digest_content jsonb,
    add column if not exists last_digest_at timestamptz;

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

  -- Etiquetas libres de texto (labels/tags) — a diferencia de priority/status
  -- (enum fijo), acá cualquier texto vale; el autocompletado de sugerencias en
  -- el cliente (TasksScreen.tsx) se arma juntando las labels YA usadas en el
  -- proyecto, no de un catálogo en la base. Mismo criterio de permisos que
  -- title/description/priority: solo el líder del proyecto o el owner pueden
  -- tocarlas (ver el trigger de abajo) — no es colaborativo como el checklist.
  alter table tasks add column if not exists labels text[] not null default '{}';

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
      or new.labels is distinct from old.labels
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
  -- task_collaborators: gente extra agregada a una task además del asignado
  -- (Punto 3 del feedback del profesor) — a diferencia de assigned_user_id/
  -- assigned_team_id (exclusivo entre sí, tasks_assignee_xor, y la única persona/
  -- equipo responsable de cambiar el status), un colaborador solo gana
  -- visibilidad + poder comentar (ver task_is_involved más abajo), no permisos
  -- de edición. Solo el líder del proyecto o el owner de la organización pueden
  -- agregar/quitar colaboradores, igual que crear/editar la task.
  -- ----------------------------------------------------------------------------
  create table if not exists task_collaborators (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references tasks(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    added_by uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (task_id, user_id)
  );

  alter table task_collaborators enable row level security;

  drop policy if exists "task_collaborators_select_org" on task_collaborators;
  create policy "task_collaborators_select_org" on task_collaborators
    for select to authenticated
    using (
      exists (
        select 1 from tasks t
        join projects p on p.id = t.project_id
        where t.id = task_id and p.organization_id in (select my_organization_ids())
      )
    );

  drop policy if exists "task_collaborators_insert_leader_owner" on task_collaborators;
  create policy "task_collaborators_insert_leader_owner" on task_collaborators
    for insert to authenticated
    with check (
      auth.uid() = added_by
      and exists (
        select 1 from tasks t
        join projects p on p.id = t.project_id
        join organizations o on o.id = p.organization_id
        where t.id = task_id and (p.leader_id = auth.uid() or o.owner_id = auth.uid())
      )
    );

  drop policy if exists "task_collaborators_delete_leader_owner" on task_collaborators;
  create policy "task_collaborators_delete_leader_owner" on task_collaborators
    for delete to authenticated
    using (
      exists (
        select 1 from tasks t
        join projects p on p.id = t.project_id
        join organizations o on o.id = p.organization_id
        where t.id = task_id and (p.leader_id = auth.uid() or o.owner_id = auth.uid())
      )
    );

  -- ----------------------------------------------------------------------------
  -- task_comments: chat de una task. A diferencia de projects/teams, NO es
  -- visible para toda la organización — solo para quien está involucrado
  -- (líder del proyecto, owner de la organización, el asignado: la persona o
  -- cualquier integrante del equipo asignado, o un colaborador agregado vía
  -- task_collaborators). Es un chat de trabajo, no un feed público.
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
          or exists (select 1 from task_collaborators tc where tc.task_id = t.id and tc.user_id = auth.uid())
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
  -- task_checklist_items: checklist simple dentro de una task (estilo Trello,
  -- no son sub-tasks reales con su propio assignee/status — eso hubiera
  -- significado replicar todo el modelo de permisos de tasks recursivamente
  -- para un caso de uso que en la práctica es "una lista de pasos a tildar").
  -- Mismo criterio de visibilidad que task_comments (task_is_involved): quien
  -- está involucrado en la task puede ver/agregar/tildar cualquier ítem
  -- (colaborativo, como el checklist de una card de Trello), pero solo quien
  -- creó un ítem puede borrarlo — igual regla que task_comments_delete_own.
  -- Sin columna de orden manual (position/drag) a propósito por ahora: se
  -- ordenan por created_at, que ya cubre el caso de uso real sin la
  -- complejidad de un drag-and-drop; se puede sumar después si hace falta.
  -- ----------------------------------------------------------------------------
  create table if not exists task_checklist_items (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references tasks(id) on delete cascade,
    content text not null,
    completed boolean not null default false,
    created_by uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
  );

  alter table task_checklist_items enable row level security;

  drop policy if exists "task_checklist_items_select_involved" on task_checklist_items;
  create policy "task_checklist_items_select_involved" on task_checklist_items
    for select to authenticated
    using (task_is_involved(task_id));

  drop policy if exists "task_checklist_items_insert_involved" on task_checklist_items;
  create policy "task_checklist_items_insert_involved" on task_checklist_items
    for insert to authenticated
    with check (auth.uid() = created_by and task_is_involved(task_id));

  -- Togglear completed es colaborativo (cualquier involucrado puede tildar el
  -- ítem de otra persona) — mismo espíritu que un checklist compartido.
  drop policy if exists "task_checklist_items_update_involved" on task_checklist_items;
  create policy "task_checklist_items_update_involved" on task_checklist_items
    for update to authenticated
    using (task_is_involved(task_id))
    with check (task_is_involved(task_id));

  drop policy if exists "task_checklist_items_delete_own" on task_checklist_items;
  create policy "task_checklist_items_delete_own" on task_checklist_items
    for delete to authenticated
    using (auth.uid() = created_by);

  -- ----------------------------------------------------------------------------
  -- task_dependencies: "task_id no puede avanzar hasta que depends_on_task_id
  -- esté lista" — a propósito solo es informativo/de planificación (una
  -- advertencia visual si la dependencia no está completada), NO bloquea de
  -- verdad cambiar el status de la task dependiente; agregar ese bloqueo duro
  -- quedaría para una v2 si hace falta. Ambas tareas deben ser del MISMO
  -- proyecto (valida el insert). Gestionar dependencias (agregar/quitar) es
  -- un campo de planificación, no colaborativo como el checklist — mismo
  -- criterio de permisos que crear/editar la task: solo el líder del
  -- proyecto o el owner de la organización. Ver la validación de ciclos en
  -- el cliente (lib/tasks.ts, addTaskDependency) — Postgres no la valida acá
  -- porque detectar ciclos en SQL puro para un grafo arbitrario es mucho más
  -- caro que hacerlo una vez en el cliente antes del insert.
  -- ----------------------------------------------------------------------------
  create table if not exists task_dependencies (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references tasks(id) on delete cascade,
    depends_on_task_id uuid not null references tasks(id) on delete cascade,
    created_by uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    constraint task_dependencies_not_self check (task_id <> depends_on_task_id),
    unique (task_id, depends_on_task_id)
  );

  alter table task_dependencies enable row level security;

  drop policy if exists "task_dependencies_select_org" on task_dependencies;
  create policy "task_dependencies_select_org" on task_dependencies
    for select to authenticated
    using (
      task_id in (select id from tasks where project_id in (select id from projects where organization_id in (select my_organization_ids())))
    );

  drop policy if exists "task_dependencies_insert_leader_owner" on task_dependencies;
  create policy "task_dependencies_insert_leader_owner" on task_dependencies
    for insert to authenticated
    with check (
      auth.uid() = created_by
      and exists (
        select 1 from tasks t
        join projects p on p.id = t.project_id
        join organizations o on o.id = p.organization_id
        where t.id = task_id and (p.leader_id = auth.uid() or o.owner_id = auth.uid())
      )
      and exists (
        select 1 from tasks t1, tasks t2
        where t1.id = task_id and t2.id = depends_on_task_id and t1.project_id = t2.project_id
      )
    );

  drop policy if exists "task_dependencies_delete_leader_owner" on task_dependencies;
  create policy "task_dependencies_delete_leader_owner" on task_dependencies
    for delete to authenticated
    using (
      exists (
        select 1 from tasks t
        join projects p on p.id = t.project_id
        join organizations o on o.id = p.organization_id
        where t.id = task_id and (p.leader_id = auth.uid() or o.owner_id = auth.uid())
      )
    );

  -- ----------------------------------------------------------------------------
  -- profile_badges: reconocimientos otorgados a un colaborador (Líder Nato,
  -- Team Player, Mentor, etc.). El catálogo de tipos es fijo, vive en código
  -- (BADGE_CATALOG en src/lib/badges.ts) — no hay tabla de tipos porque hoy no
  -- son personalizables. Puede OTORGAR un badge el owner de la organización, o
  -- el encargado (teams.leader_id) de algún equipo donde esa persona sea
  -- integrante — "manager" en este esquema se mapea a encargado de equipo, no
  -- a líder de proyecto. QUITAR un badge es más restrictivo a propósito (ver
  -- profile_badges_delete_manager más abajo): solo quien lo otorgó originalmente,
  -- o el owner — así un encargado no puede revocar en silencio un badge que
  -- dio otro encargado o el owner. Cualquier miembro de la organización puede
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

  -- Revocar es más restrictivo que otorgar (ver comentario de la tabla): solo
  -- quien otorgó ESE badge puntual, o el owner de la organización — nunca
  -- "cualquier manager actual", que dejaría a un encargado revocar en silencio
  -- un badge que dio otra persona (incluido el owner) sin que esta se entere.
  drop policy if exists "profile_badges_delete_manager" on profile_badges;
  create policy "profile_badges_delete_manager" on profile_badges
    for delete to authenticated
    using (
      auth.uid() = granted_by
      or exists (select 1 from organizations o where o.id = organization_id and o.owner_id = auth.uid())
    );

  -- ----------------------------------------------------------------------------
  -- badge_definitions: catálogo de badges PERSONALIZADOS por organización
  -- (Punto 5 del feedback del profesor — CRUD completo, no solo ver/asignar).
  -- Los 10 badges "de fábrica" (BADGE_CATALOG en src/lib/badges.ts) siguen
  -- fijos en código y disponibles para toda organización sin fila acá; esta
  -- tabla es solo para los que cada organización crea de más. `key` es un slug
  -- generado en el cliente (nunca choca con los keys fijos porque siempre
  -- empieza con "custom_"). Solo el owner de la organización puede crear/borrar
  -- — mismo criterio de gobierno que Equipos/Proyectos, no el más laxo de
  -- otorgar/quitar un badge ya existente (profile_badges, que además permite al
  -- encargado de equipo).
  -- ----------------------------------------------------------------------------
  create table if not exists badge_definitions (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    key text not null,
    label text not null,
    description text not null default '',
    icon text not null default 'BadgeCheck',
    color text not null default '#2C7BD1',
    created_by uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (organization_id, key)
  );

  alter table badge_definitions enable row level security;

  drop policy if exists "badge_definitions_select_org" on badge_definitions;
  create policy "badge_definitions_select_org" on badge_definitions
    for select to authenticated
    using (organization_id in (select my_organization_ids()));

  drop policy if exists "badge_definitions_insert_owner" on badge_definitions;
  create policy "badge_definitions_insert_owner" on badge_definitions
    for insert to authenticated
    with check (
      auth.uid() = created_by
      and exists (select 1 from organizations o where o.id = organization_id and o.owner_id = auth.uid())
    );

  drop policy if exists "badge_definitions_delete_owner" on badge_definitions;
  create policy "badge_definitions_delete_owner" on badge_definitions
    for delete to authenticated
    using (exists (select 1 from organizations o where o.id = organization_id and o.owner_id = auth.uid()));

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

  -- ----------------------------------------------------------------------------
  -- Correos transaccionales (docs/EMAILS.md) — infraestructura nueva. La mayoría
  -- se dispara desde src/lib/*.ts justo después de una mutación exitosa (mismo
  -- patrón que logActivity), vía la Edge Function `send-email`. Este bloque solo
  -- cubre lo que SÍ necesita algo en la base de datos: la columna de dedup para
  -- el recordatorio de vencimiento (5.4) y el cron que lo dispara. Los correos
  -- de la sección 6 (Módulo de Clientes) se agregan más abajo, junto con el
  -- resto de las tablas de ese módulo (ver "Módulo de Clientes" al final de
  -- este archivo).
  -- ----------------------------------------------------------------------------

  -- Evita reenviar el mismo aviso de "vence pronto" (5.4) más de una vez. Se
  -- resetea a null en updateTask (src/lib/tasks.ts) cada vez que cambia
  -- due_date, para que una task pospuesta vuelva a avisar con la fecha nueva.
  -- Deliberadamente NO se agregó a la comparación de columnas de
  -- enforce_task_update_permissions (arriba): es un campo de sistema que ni el
  -- asignado ni el líder/owner tocan a mano nunca, solo la Edge Function
  -- task-due-reminders (con la service role key, que no pasa por auth.uid()) y
  -- el reset automático de updateTask.
  alter table tasks add column if not exists due_reminder_sent_at timestamptz;

  -- Cron diario que llama a la Edge Function task-due-reminders (correo 5.4).
  -- Requiere:
  --   1. Habilitar las extensiones "pg_cron" y "pg_net" (Database → Extensions
  --      en el dashboard de Supabase).
  --   2. Guardar la Service Role Key en Vault UNA VEZ, a mano, en el SQL Editor
  --      (nunca commitear el valor real a git):
  --        select vault.create_secret('TU_SERVICE_ROLE_KEY_REAL', 'service_role_key');
  --   3. Reemplazar <PROJECT_REF> por el ref de tu proyecto (Project Settings →
  --      General) antes de correr este bloque.
  -- Ver docs/SETUP.md para el detalle completo de estos 3 pasos.
  do $$
  begin
    if exists (select 1 from cron.job where jobname = 'task-due-reminders-daily') then
      perform cron.unschedule('task-due-reminders-daily');
    end if;
  end $$;

  select cron.schedule(
    'task-due-reminders-daily',
    '0 13 * * *', -- todos los días, ajustar la hora UTC según tu zona horaria
    $$
    select net.http_post(
      url := 'https://oygyntlhzhvbdfglzulx.functions.supabase.co/task-due-reminders',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
    $$
  );

  -- Cron semanal que llama a la Edge Function project-weekly-digest
  -- (docs/ARQUITECTURA.md "Reportes automáticos con IA") — reusa el mismo
  -- secreto service_role_key en Vault ya configurado arriba para
  -- task-due-reminders, no requiere ningún paso manual nuevo.
  do $$
  begin
    if exists (select 1 from cron.job where jobname = 'project-weekly-digest-monday') then
      perform cron.unschedule('project-weekly-digest-monday');
    end if;
  end $$;

  select cron.schedule(
    'project-weekly-digest-monday',
    '0 13 * * 1', -- todos los lunes, ajustar la hora UTC según tu zona horaria
    $$
    select net.http_post(
      url := 'https://oygyntlhzhvbdfglzulx.functions.supabase.co/project-weekly-digest',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
    $$
  );

  -- ----------------------------------------------------------------------------
  -- notifications: centro de notificaciones IN-APP (campanita en la nav),
  -- paralelo a los correos transaccionales (docs/EMAILS.md) pero un canal más
  -- inmediato dentro de la propia app — nunca los reemplaza. Se genera en los
  -- MISMOS puntos donde emails.ts ya dispara un correo (mismo criterio de
  -- resiliencia: si falla el insert, no aborta la mutación principal, solo
  -- console.warn) vía pushNotification en src/lib/notifications.ts, llamada
  -- desde los notify* de src/lib/emails.ts. Acotado a propósito a eventos
  -- "core" de la organización (equipos/proyectos/tasks/badges) — el Módulo de
  -- Clientes queda fuera de esta ronda, igual que una notificación genérica de
  -- "tu home cambió" (ambos ya estaban marcados como pendientes en
  -- docs/ESTADO.md antes de esta ronda).
  --
  -- entity_type/entity_id son polimórficos (sin FK, mismo criterio que
  -- activity_log.entity_id) — el cliente decide cómo navegar según el type de
  -- la notificación (ver NOTIFICATION_ROUTES en NotificationBell.tsx). project_id
  -- SÍ es FK real (on delete set null) para poder "ir al proyecto" sin
  -- resolver nada más.
  -- ----------------------------------------------------------------------------
  create table if not exists notifications (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    type text not null,
    title text not null,
    body text not null,
    entity_type text,
    entity_id uuid,
    project_id uuid references projects(id) on delete set null,
    read boolean not null default false,
    created_at timestamptz not null default now()
  );

  create index if not exists notifications_user_unread_idx on notifications (user_id, read, created_at desc);

  alter table notifications enable row level security;

  drop policy if exists "notifications_select_own" on notifications;
  create policy "notifications_select_own" on notifications
    for select to authenticated
    using (auth.uid() = user_id);

  -- Insertar es autoatestiguado a nivel de ORGANIZACIÓN (quien inserta debe
  -- ser miembro), pero el destinatario (user_id) puede ser CUALQUIER otro
  -- miembro de esa misma organización — a diferencia de activity_log
  -- (auth.uid() = actor_id), acá el "actor" casi siempre notifica a OTRA
  -- persona (ej. asignar una task a un compañero). Se valida que el
  -- destinatario también sea miembro real de la organización, para que nadie
  -- pueda insertar notificaciones para un user_id ajeno a ese workspace.
  drop policy if exists "notifications_insert_org" on notifications;
  create policy "notifications_insert_org" on notifications
    for insert to authenticated
    with check (
      organization_id in (select my_organization_ids())
      and exists (
        select 1 from organization_members om
        where om.organization_id = notifications.organization_id and om.user_id = notifications.user_id
      )
    );

  drop policy if exists "notifications_update_own" on notifications;
  create policy "notifications_update_own" on notifications
    for update to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

  -- ============================================================================
  -- Módulo de Clientes (docs/CLIENTE.md) — portal aislado por cliente.
  --
  -- DECISIÓN DE AISLAMIENTO (la más importante de este bloque): los clientes
  -- viven en tablas completamente separadas de organization_members. Esa tabla
  -- alimenta my_organization_ids(), que a su vez alimenta políticas RLS muy
  -- amplias ("cualquier miembro ve X") en proyectos/equipos/tasks/activity_log/
  -- perfiles — si un cliente entrara ahí, aunque fuera con un role nuevo,
  -- ganaría esa visibilidad amplia salvo que se audite y toque cada una de esas
  -- policies, con alto riesgo de fuga de datos internos a alguien externo.
  -- En vez de eso: tablas nuevas (prefijo client_/organization_clients), RLS
  -- propio y angosto desde cero, con dos funciones security definer
  -- (client_space_is_staff/client_space_can_access) reusadas en cada tabla del
  -- módulo, mismo patrón que task_is_involved() más arriba.
  -- ============================================================================

  -- ----------------------------------------------------------------------------
  -- organizations.client_invite_code: código de cliente, mismo criterio que
  -- invite_code (general, identifica el ROL con el que alguien se une, no a una
  -- persona puntual) pero en columna separada — dos códigos independientes.
  -- ----------------------------------------------------------------------------
  alter table organizations add column if not exists client_invite_code text;

  alter table organizations drop constraint if exists organizations_client_invite_code_key;
  alter table organizations add constraint organizations_client_invite_code_key unique (client_invite_code);

  -- Backfill para organizaciones ya existentes — mismo alfabeto sin caracteres
  -- ambiguos que generateInviteCode() (src/lib/organizations.ts), con su propio
  -- loop de reintento ante colisión (23505/unique_violation) porque acá no hay
  -- un cliente JS reintentando, es un solo UPDATE por fila.
  do $$
  declare
    chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    org_row record;
    new_code text;
    ok boolean;
    i int;
  begin
    for org_row in select id from organizations where client_invite_code is null loop
      ok := false;
      while not ok loop
        new_code := '';
        for i in 1..7 loop
          new_code := new_code || substr(chars, floor(random() * length(chars))::int + 1, 1);
        end loop;
        begin
          update organizations set client_invite_code = new_code where id = org_row.id;
          ok := true;
        exception when unique_violation then
          ok := false; -- colisión, reintenta con otro código
        end;
      end loop;
    end loop;
  end $$;

  alter table organizations alter column client_invite_code set not null;

  -- organizations_select_authenticated (ya existe, using(true)) ya alcanza para
  -- buscar por client_invite_code antes de unirse — no hace falta tocarla.

  -- ----------------------------------------------------------------------------
  -- organization_clients: relación usuario <-> organización COMO CLIENTE.
  -- Deliberadamente separada de organization_members — nunca debe alimentar
  -- my_organization_ids() ni ninguna policy "cualquier miembro de la
  -- organización". data_consent es el checkbox de privacidad/analítica del
  -- registro (CLIENTE.md §1).
  -- ----------------------------------------------------------------------------
  create table if not exists organization_clients (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    data_consent boolean not null default false,
    data_consent_at timestamptz,
    created_at timestamptz not null default now(),
    unique (organization_id, user_id)
  );

  alter table organization_clients enable row level security;

  drop policy if exists "organization_clients_select_own" on organization_clients;
  create policy "organization_clients_select_own" on organization_clients
    for select to authenticated using (auth.uid() = user_id);

  drop policy if exists "organization_clients_select_owner" on organization_clients;
  create policy "organization_clients_select_owner" on organization_clients
    for select to authenticated
    using (exists (select 1 from organizations o where o.id = organization_id and o.owner_id = auth.uid()));

  drop policy if exists "organization_clients_insert_own" on organization_clients;
  create policy "organization_clients_insert_own" on organization_clients
    for insert to authenticated with check (auth.uid() = user_id);

  -- ----------------------------------------------------------------------------
  -- client_assignments: quién (persona XOR equipo, mismo patrón que
  -- tasks_assignee_xor más arriba) atiende a cada cliente. APPEND-ONLY: una
  -- reasignación nunca reescribe assigned_user_id/assigned_team_id de una fila
  -- existente — inserta una fila nueva y marca unassigned_at en la anterior,
  -- preservando el historial completo ligado al cliente (CLIENTE.md §4: "si el
  -- equipo/persona asignada cambia, el historial completo permanece intacto").
  -- ----------------------------------------------------------------------------
  create table if not exists client_assignments (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    client_user_id uuid not null references auth.users(id) on delete cascade,
    assigned_user_id uuid references auth.users(id) on delete set null,
    assigned_team_id uuid references teams(id) on delete set null,
    assigned_by uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    unassigned_at timestamptz,
    constraint client_assignments_assignee_xor check (
      (assigned_user_id is not null and assigned_team_id is null)
      or (assigned_user_id is null and assigned_team_id is not null)
    )
  );

  alter table client_assignments enable row level security;

  drop policy if exists "client_assignments_select_involved" on client_assignments;
  create policy "client_assignments_select_involved" on client_assignments
    for select to authenticated
    using (
      auth.uid() = client_user_id
      or exists (select 1 from organizations o where o.id = organization_id and o.owner_id = auth.uid())
      or assigned_user_id = auth.uid()
      or (assigned_team_id is not null and exists (select 1 from team_members tm where tm.team_id = assigned_team_id and tm.user_id = auth.uid()))
    );

  drop policy if exists "client_assignments_insert_owner" on client_assignments;
  create policy "client_assignments_insert_owner" on client_assignments
    for insert to authenticated
    with check (
      auth.uid() = assigned_by
      and exists (select 1 from organizations o where o.id = organization_id and o.owner_id = auth.uid())
      and exists (select 1 from organization_clients oc where oc.organization_id = organization_id and oc.user_id = client_user_id)
    );

  -- update SOLO se usa para cerrar una asignación (unassigned_at = now()) al
  -- reasignar — nunca para cambiar a quién apunta assigned_user_id/assigned_team_id.
  drop policy if exists "client_assignments_update_owner" on client_assignments;
  create policy "client_assignments_update_owner" on client_assignments
    for update to authenticated
    using (exists (select 1 from organizations o where o.id = organization_id and o.owner_id = auth.uid()))
    with check (exists (select 1 from organizations o where o.id = organization_id and o.owner_id = auth.uid()));

  -- ----------------------------------------------------------------------------
  -- Helpers de acceso al espacio de un cliente — mismo patrón que
  -- task_is_involved(): security definer, reusados en cada tabla del módulo en
  -- vez de repetir "soy staff de este cliente" en cada policy.
  -- ----------------------------------------------------------------------------
  create or replace function client_space_is_staff(target_org_id uuid, target_client_user_id uuid)
  returns boolean
  language sql security definer stable
  as $$
    select
      exists (select 1 from organizations o where o.id = target_org_id and o.owner_id = auth.uid())
      or exists (
        select 1 from client_assignments ca
        where ca.organization_id = target_org_id and ca.client_user_id = target_client_user_id
          and ca.unassigned_at is null and ca.assigned_user_id = auth.uid()
      )
      or exists (
        select 1 from client_assignments ca
        join team_members tm on tm.team_id = ca.assigned_team_id
        where ca.organization_id = target_org_id and ca.client_user_id = target_client_user_id
          and ca.unassigned_at is null and tm.user_id = auth.uid()
      )
  $$;

  create or replace function client_space_can_access(target_org_id uuid, target_client_user_id uuid)
  returns boolean
  language sql security definer stable
  as $$
    select auth.uid() = target_client_user_id or client_space_is_staff(target_org_id, target_client_user_id)
  $$;

  -- Ahora sí puede existir (necesitaba client_space_is_staff ya creada).
  drop policy if exists "organization_clients_select_staff" on organization_clients;
  create policy "organization_clients_select_staff" on organization_clients
    for select to authenticated
    using (client_space_is_staff(organization_id, user_id));

  -- ----------------------------------------------------------------------------
  -- Visibilidad de perfiles dentro del espacio de un cliente. Sin esto, ni el
  -- staff ve nombre/avatar del cliente en el chat, ni el cliente ve
  -- nombre/avatar de su equipo asignado — profiles_select_org_members no aplica
  -- (el cliente nunca está en organization_members).
  --
  -- client_space_visible_profile es security definer a propósito — igual que
  -- client_space_is_staff/client_space_can_access. Bug real encontrado
  -- probando en vivo: la primera versión de esta policy hacía el join a
  -- team_members directo dentro del `exists` de la policy de profiles, sujeto
  -- a la RLS normal de team_members (solo miembros de la organización) — un
  -- cliente nunca es miembro, así que ese join devolvía 0 filas SIEMPRE, sin
  -- importar que la lógica fuera correcta (Postgres no eleva privilegios solo
  -- por estar dentro del USING de otra policy). Resultado: el cliente veía
  -- "Alguien" en vez del nombre real de cualquier integrante del equipo
  -- asignado a su espacio. Ver docs/TRAMPAS.md.
  -- ----------------------------------------------------------------------------
  create or replace function client_space_visible_profile(target_profile_id uuid)
  returns boolean
  language plpgsql
  security definer
  set search_path = public
  as $$
  begin
    return exists ( -- soy el cliente y esta fila es la persona asignada a mi espacio
      select 1 from client_assignments ca
      where ca.client_user_id = auth.uid() and ca.unassigned_at is null and ca.assigned_user_id = target_profile_id
    ) or exists ( -- soy el cliente y esta fila es integrante del equipo asignado a mi espacio
      select 1 from client_assignments ca
      join team_members tm on tm.team_id = ca.assigned_team_id
      where ca.client_user_id = auth.uid() and ca.unassigned_at is null and tm.user_id = target_profile_id
    );
  end;
  $$;

  drop policy if exists "profiles_select_client_space" on profiles;
  create policy "profiles_select_client_space" on profiles
    for select to authenticated
    using (
      exists ( -- soy staff de un cliente y esta fila ES ese cliente
        select 1 from organization_clients oc
        where oc.user_id = profiles.id and client_space_is_staff(oc.organization_id, oc.user_id)
      )
      or client_space_visible_profile(profiles.id)
    );

  -- ----------------------------------------------------------------------------
  -- get_client_widget_overview: RPC de solo lectura para el widget
  -- "project_overview" del home del cliente (docs/CLIENTE.md §6). Los widgets
  -- viven en client_home_sections (aislado, con su propia RLS), pero
  -- projects/tasks/teams NUNCA le dan acceso a un cliente vía RLS normal
  -- (esas tablas dependen de my_organization_ids(), y un cliente nunca integra
  -- esa función a propósito) — este bug real se encontró probando en vivo: el
  -- widget "Tu Proyecto" quedaba siempre vacío para el cliente aunque el staff
  -- sí hubiera elegido una fuente, porque listProjects()/supabase.from("tasks")
  -- corrían con la sesión del cliente y RLS filtraba todo en silencio (0
  -- filas, sin error). En vez de abrir projects/tasks a cualquier cliente, esta
  -- función security definer valida client_space_can_access primero y solo
  -- devuelve los proyectos/equipos puntuales que el widget pidió — mismo
  -- criterio de "acceso mínimo específico" que el resto del módulo. Ver
  -- docs/TRAMPAS.md.
  -- ----------------------------------------------------------------------------
  create or replace function get_client_widget_overview(
    p_organization_id uuid,
    p_client_user_id uuid,
    p_project_ids uuid[],
    p_team_ids uuid[]
  )
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    result jsonb;
  begin
    if not client_space_can_access(p_organization_id, p_client_user_id) then
      raise exception 'No autorizado';
    end if;

    select jsonb_build_object(
      'projects', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'color', p.color,
          'status', p.status,
          'tasksTotal', (select count(*)::int from tasks t where t.project_id = p.id),
          'tasksCompleted', (select count(*)::int from tasks t where t.project_id = p.id and t.status = 'completed')
        ))
        from projects p
        where p.id = any(p_project_ids) and p.organization_id = p_organization_id
      ), '[]'::jsonb),
      'teams', coalesce((
        select jsonb_agg(jsonb_build_object('id', tm.id, 'name', tm.name, 'color', tm.color))
        from teams tm
        where tm.id = any(p_team_ids) and tm.organization_id = p_organization_id
      ), '[]'::jsonb)
    ) into result;

    return result;
  end;
  $$;

  -- ----------------------------------------------------------------------------
  -- client_messages / client_message_reactions: chat persistente entre el
  -- cliente y su equipo asignado (CLIENTE.md §5). Tabla PARALELA a
  -- task_comments/task_comment_reactions (mismas columnas, mismo espíritu) en
  -- vez de reusarla — evita acoplar dos dominios de RLS independientes.
  -- ----------------------------------------------------------------------------
  create table if not exists client_messages (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    client_user_id uuid not null references auth.users(id) on delete cascade,
    sender_id uuid not null references auth.users(id) on delete cascade,
    content text not null,
    reply_to_id uuid references client_messages(id) on delete set null,
    attachment_url text,
    attachment_type text check (attachment_type in ('image', 'file', 'link', 'date')),
    attachment_name text,
    created_at timestamptz not null default now()
  );

  alter table client_messages enable row level security;

  drop policy if exists "client_messages_select_access" on client_messages;
  create policy "client_messages_select_access" on client_messages
    for select to authenticated using (client_space_can_access(organization_id, client_user_id));

  drop policy if exists "client_messages_insert_access" on client_messages;
  create policy "client_messages_insert_access" on client_messages
    for insert to authenticated
    with check (auth.uid() = sender_id and client_space_can_access(organization_id, client_user_id));

  drop policy if exists "client_messages_delete_own" on client_messages;
  create policy "client_messages_delete_own" on client_messages
    for delete to authenticated using (auth.uid() = sender_id);

  create table if not exists client_message_reactions (
    id uuid primary key default gen_random_uuid(),
    message_id uuid not null references client_messages(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    reaction text not null check (reaction in ('like', 'heart', 'dislike', 'question')),
    created_at timestamptz not null default now(),
    unique (message_id, user_id)
  );

  alter table client_message_reactions enable row level security;

  drop policy if exists "client_message_reactions_select_access" on client_message_reactions;
  create policy "client_message_reactions_select_access" on client_message_reactions
    for select to authenticated
    using (exists (select 1 from client_messages cm where cm.id = message_id and client_space_can_access(cm.organization_id, cm.client_user_id)));

  drop policy if exists "client_message_reactions_insert_own" on client_message_reactions;
  create policy "client_message_reactions_insert_own" on client_message_reactions
    for insert to authenticated
    with check (auth.uid() = user_id and exists (select 1 from client_messages cm where cm.id = message_id and client_space_can_access(cm.organization_id, cm.client_user_id)));

  drop policy if exists "client_message_reactions_update_own" on client_message_reactions;
  create policy "client_message_reactions_update_own" on client_message_reactions
    for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

  drop policy if exists "client_message_reactions_delete_own" on client_message_reactions;
  create policy "client_message_reactions_delete_own" on client_message_reactions
    for delete to authenticated using (auth.uid() = user_id);

  -- ----------------------------------------------------------------------------
  -- client_requests: el cliente pide algo (documento, presentación, reporte
  -- custom) y se notifica a todo el equipo asignado (CLIENTE.md §8).
  -- ----------------------------------------------------------------------------
  create table if not exists client_requests (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    client_user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    description text,
    status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'cancelled')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  alter table client_requests enable row level security;

  drop policy if exists "client_requests_select_access" on client_requests;
  create policy "client_requests_select_access" on client_requests
    for select to authenticated using (client_space_can_access(organization_id, client_user_id));

  drop policy if exists "client_requests_insert_client" on client_requests;
  create policy "client_requests_insert_client" on client_requests
    for insert to authenticated
    with check (
      auth.uid() = client_user_id
      and exists (select 1 from organization_clients oc where oc.organization_id = organization_id and oc.user_id = client_user_id)
    );

  drop policy if exists "client_requests_update_staff" on client_requests;
  create policy "client_requests_update_staff" on client_requests
    for update to authenticated
    using (client_space_is_staff(organization_id, client_user_id))
    with check (client_space_is_staff(organization_id, client_user_id));

  -- El cliente puede cancelar su propia solicitud mientras siga abierta. Las
  -- policies permisivas de Postgres se combinan con OR entre sí (tanto en
  -- USING como en WITH CHECK) dentro del mismo comando, así que esto convive
  -- sin conflicto con client_requests_update_staff de arriba.
  drop policy if exists "client_requests_update_client_cancel" on client_requests;
  create policy "client_requests_update_client_cancel" on client_requests
    for update to authenticated
    using (auth.uid() = client_user_id and status = 'open')
    with check (auth.uid() = client_user_id and status = 'cancelled');

  -- ----------------------------------------------------------------------------
  -- client_deliverables: entregables que el staff sube para que el cliente
  -- apruebe/rechace (CLIENTE.md §9). Enforcement a nivel de columna, mismo
  -- patrón que enforce_task_update_permissions: el cliente SOLO puede tocar
  -- status/decided_by/decided_at (y solo pending->approved|rejected); el staff
  -- SOLO puede editar contenido mientras sigue pending, nunca la decisión del
  -- cliente ni reabrir un entregable ya decidido.
  -- ----------------------------------------------------------------------------
  create table if not exists client_deliverables (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    client_user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    content text,
    attachment_url text,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    created_by uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    decided_by uuid references auth.users(id) on delete set null,
    decided_at timestamptz
  );

  alter table client_deliverables enable row level security;

  drop policy if exists "client_deliverables_select_access" on client_deliverables;
  create policy "client_deliverables_select_access" on client_deliverables
    for select to authenticated using (client_space_can_access(organization_id, client_user_id));

  drop policy if exists "client_deliverables_insert_staff" on client_deliverables;
  create policy "client_deliverables_insert_staff" on client_deliverables
    for insert to authenticated
    with check (auth.uid() = created_by and client_space_is_staff(organization_id, client_user_id));

  drop policy if exists "client_deliverables_update_staff" on client_deliverables;
  create policy "client_deliverables_update_staff" on client_deliverables
    for update to authenticated
    using (client_space_is_staff(organization_id, client_user_id))
    with check (client_space_is_staff(organization_id, client_user_id));

  drop policy if exists "client_deliverables_update_client_decide" on client_deliverables;
  create policy "client_deliverables_update_client_decide" on client_deliverables
    for update to authenticated
    using (auth.uid() = client_user_id and status = 'pending')
    with check (auth.uid() = client_user_id and status in ('approved', 'rejected'));

  create or replace function enforce_client_deliverable_update()
  returns trigger
  language plpgsql
  security definer
  as $$
  declare
    is_staff boolean;
  begin
    select client_space_is_staff(new.organization_id, new.client_user_id) into is_staff;

    if auth.uid() = old.client_user_id then
      if old.status <> 'pending' or new.status not in ('approved', 'rejected') then
        raise exception 'Solo puedes decidir sobre un entregable pendiente';
      end if;
      if new.title <> old.title or new.content is distinct from old.content or new.attachment_url is distinct from old.attachment_url then
        raise exception 'No puedes editar el contenido del entregable';
      end if;
      if new.decided_by is distinct from auth.uid() or new.decided_at is null then
        raise exception 'decided_by/decided_at deben registrar tu decisión';
      end if;
      return new;
    end if;

    if is_staff then
      if old.status <> 'pending' then
        raise exception 'No se puede editar un entregable después de la decisión del cliente';
      end if;
      if new.status <> old.status or new.decided_by is distinct from old.decided_by or new.decided_at is distinct from old.decided_at then
        raise exception 'El equipo no puede cambiar el estado de decisión';
      end if;
      return new;
    end if;

    raise exception 'No autorizado para editar este entregable';
  end;
  $$;

  drop trigger if exists client_deliverables_enforce_update on client_deliverables;
  create trigger client_deliverables_enforce_update
    before update on client_deliverables
    for each row execute function enforce_client_deliverable_update();

  -- ----------------------------------------------------------------------------
  -- client_home_sections: el equipo arma el home del cliente a la medida
  -- (CLIENTE.md §6). generated_content = null es un estado honesto de "aún no
  -- generado" (filosofía anti-fake, docs/PATRONES.md), no un placeholder falso.
  -- La regeneración es SIEMPRE manual (botón "Actualizar" del equipo) — nunca
  -- se dispara sola al abrir el home del cliente.
  -- ----------------------------------------------------------------------------
  create table if not exists client_home_sections (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    client_user_id uuid not null references auth.users(id) on delete cascade,
    type text not null default 'dashboard' check (type in ('dashboard')),
    title text not null,
    config jsonb not null default '{}'::jsonb,
    generated_content jsonb,
    generated_at timestamptz,
    position int not null default 0,
    created_by uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  alter table client_home_sections enable row level security;

  drop policy if exists "client_home_sections_select_access" on client_home_sections;
  create policy "client_home_sections_select_access" on client_home_sections
    for select to authenticated using (client_space_can_access(organization_id, client_user_id));

  drop policy if exists "client_home_sections_insert_staff" on client_home_sections;
  create policy "client_home_sections_insert_staff" on client_home_sections
    for insert to authenticated
    with check (auth.uid() = created_by and client_space_is_staff(organization_id, client_user_id));

  drop policy if exists "client_home_sections_update_staff" on client_home_sections;
  create policy "client_home_sections_update_staff" on client_home_sections
    for update to authenticated
    using (client_space_is_staff(organization_id, client_user_id))
    with check (client_space_is_staff(organization_id, client_user_id));

  drop policy if exists "client_home_sections_delete_staff" on client_home_sections;
  create policy "client_home_sections_delete_staff" on client_home_sections
    for delete to authenticated using (client_space_is_staff(organization_id, client_user_id));

  -- type pasó de solo 'dashboard' a 5 widgets (docs/CLIENTE.md, "Plan de
  -- implementación — Home con widgets") después del `create table` original —
  -- mismo criterio drop+add que tasks_status_check.
  alter table client_home_sections drop constraint if exists client_home_sections_type_check;
  alter table client_home_sections
    add constraint client_home_sections_type_check
    check (type in ('dashboard', 'project_overview', 'requests_summary', 'chat_preview', 'deliverables'));

  -- ----------------------------------------------------------------------------
  -- client_documents: documentos/presentaciones bajo demanda (CLIENTE.md §7) —
  -- a diferencia del dashboard (automático/vivo), el cliente los SOLICITA;
  -- contenido dentro de la plataforma, no un PDF real (sin infra de generación
  -- de PDF todavía).
  -- ----------------------------------------------------------------------------
  create table if not exists client_documents (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    client_user_id uuid not null references auth.users(id) on delete cascade,
    request_id uuid references client_requests(id) on delete set null,
    title text not null,
    extra_prompt text,
    generated_content jsonb,
    generated_at timestamptz,
    generated_by uuid references auth.users(id) on delete set null,
    created_by uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  -- source: {projectIds, teamIds} elegidos al generar/regenerar este documento
  -- puntual — no hay relación estructural cliente↔proyecto en el schema (el
  -- módulo de Clientes es deliberadamente paralelo, ver más abajo), así que la
  -- fuente se elige y se recuerda por documento, no se deriva de otra tabla.
  alter table client_documents add column if not exists source jsonb not null default '{}'::jsonb;

  alter table client_documents enable row level security;

  drop policy if exists "client_documents_select_access" on client_documents;
  create policy "client_documents_select_access" on client_documents
    for select to authenticated using (client_space_can_access(organization_id, client_user_id));

  drop policy if exists "client_documents_insert_staff" on client_documents;
  create policy "client_documents_insert_staff" on client_documents
    for insert to authenticated
    with check (auth.uid() = created_by and client_space_is_staff(organization_id, client_user_id));

  drop policy if exists "client_documents_update_staff" on client_documents;
  create policy "client_documents_update_staff" on client_documents
    for update to authenticated
    using (client_space_is_staff(organization_id, client_user_id))
    with check (client_space_is_staff(organization_id, client_user_id));

  -- ----------------------------------------------------------------------------
  -- client_activity_log: paralelo a activity_log pero para el espacio de un
  -- cliente — tabla SEPARADA a propósito. activity_log_insert_self/
  -- activity_log_select_org dependen de my_organization_ids(), y ampliarlas
  -- arriesga romper la semántica ya establecida del log de organización.
  -- Acciones curadas (sin "message_sent" — mismo criterio que task_comments: el
  -- chat es su propio registro, no debe generar ruido en el log de actividad).
  -- ----------------------------------------------------------------------------
  create table if not exists client_activity_log (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    client_user_id uuid not null references auth.users(id) on delete cascade,
    actor_id uuid references auth.users(id) on delete set null,
    actor_name text not null,
    action text not null check (action in (
      'client_joined', 'assignment_changed', 'request_created', 'request_status_changed',
      'deliverable_created', 'deliverable_approved', 'deliverable_rejected',
      'home_section_created', 'home_section_regenerated', 'document_created', 'document_regenerated'
    )),
    entity_id uuid,
    entity_name text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );

  alter table client_activity_log enable row level security;

  drop policy if exists "client_activity_log_select_access" on client_activity_log;
  create policy "client_activity_log_select_access" on client_activity_log
    for select to authenticated using (client_space_can_access(organization_id, client_user_id));

  drop policy if exists "client_activity_log_insert_access" on client_activity_log;
  create policy "client_activity_log_insert_access" on client_activity_log
    for insert to authenticated
    with check (auth.uid() = actor_id and client_space_can_access(organization_id, client_user_id));

  -- ----------------------------------------------------------------------------
  -- Permisos base para los roles de PostgREST (anon/authenticated/service_role).
  -- En Supabase Cloud esto ya viene preconfigurado por la plataforma al crear el
  -- proyecto, por eso nunca hizo falta declararlo acá. Un Postgres self-hosted
  -- (ej. el de la Pi, ver docs/SETUP.md) puede NO tener esos defaults aplicados
  -- si schema.sql se corrió antes de que la inicialización de roles terminara,
  -- o con un rol distinto al que fijó los "default privileges" originales — en
  -- ese caso cualquier query devuelve "permission denied for table X" ANTES de
  -- que las policies de RLS lleguen a evaluarse (RLS solo filtra FILAS; el
  -- GRANT a nivel de tabla es un requisito previo e independiente). Este bloque
  -- va al final a propósito: "grant ... on all tables" solo alcanza a las
  -- tablas que YA existen en el momento de ejecutarse, así que tiene que correr
  -- después de haber creado todas las de arriba. El "alter default privileges"
  -- cubre además cualquier tabla que se agregue en una futura edición de este
  -- archivo. Idempotente — correrlo de nuevo no rompe nada.
  -- ----------------------------------------------------------------------------
  grant usage on schema public to anon, authenticated, service_role;
  grant all on all tables in schema public to anon, authenticated, service_role;
  grant all on all sequences in schema public to anon, authenticated, service_role;
  grant all on all routines in schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on routines to anon, authenticated, service_role;
