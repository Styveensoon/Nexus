-- ============================================================================
-- seed.sql — organización de demo con 4 cuentas de LOGIN REAL
-- ============================================================================
-- A diferencia de seed_users.sql (roster de prueba SIN login, solo para que
-- el Semillero tenga con qué analizar), este script crea 4 cuentas con las
-- que SÍ se puede iniciar sesión de verdad en la app: Owner, Encargado de
-- equipo, Miembro normal y Cliente — con una organización, un equipo, un
-- proyecto y tareas ya cargadas (algunas completadas, una vencida, una por
-- vencer) para poder probar la app con datos realistas sin armar todo a mano.
--
-- Credenciales completas (email + contraseña + qué probar con cada rol) en
-- docs/Credentials.md, generado junto con este archivo — si cambiás algo acá
-- (emails, contraseña, nombres), actualizá ese .md también.
--
-- CÓMO USARLO:
--   1. Pega este archivo completo en el SQL Editor de Supabase y corre.
--   2. Inicia sesión en la app con cualquiera de las 4 cuentas de
--      docs/Credentials.md — ya tienen organización/equipo/proyecto/tareas,
--      no hace falta pasar por el onboarding.
--
-- ADVERTENCIAS:
--   - Crea usuarios REALES en auth.users con contraseña funcional (a
--     diferencia de seed_users.sql). NO correr esto contra una base de
--     producción con datos reales — son cuentas de prueba, nunca las uses
--     para nada que no sea probar la app.
--   - Requiere pgcrypto (ya la habilita schema.sql).
--   - Los IDs son fijos (empiezan con "d0000000") para que el script sea
--     idempotente en las tablas principales (organización/equipo/proyecto/
--     tasks/usuarios no se duplican si lo corrés dos veces). Las tablas de
--     historial puro (client_assignments, activity_log, mensajes) SÍ pueden
--     duplicarse si corrés el script dos veces sin limpiar antes — usa el
--     DELETE del final si querés arrancar de cero.
--   - Si el login no funciona apenas corras esto (pasa en algunas versiones
--     de Supabase con INSERT directo en auth.users), la forma más simple de
--     arreglarlo es: Dashboard → Authentication → Users → buscar el email →
--     "Send password recovery" o "Reset password" y setearla de nuevo a mano
--     con el mismo valor de docs/Credentials.md.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1) Los 4 usuarios reales (auth.users + auth.identities — la fila en
--    identities es la que le falta a seed_users.sql a propósito; sin ella el
--    login por password no funciona). Dispara handle_new_user, que ya crea el
--    profile base (full_name/email) — el resto de columnas se completa en el
--    paso 2.
-- ----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_token, email_change, email_change_token_new, recovery_token,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner.demo@nexus.test',  crypt('Nexus2026!', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{"full_name":"Renata Paredes"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'leader.demo@nexus.test', crypt('Nexus2026!', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{"full_name":"Mateo Rivas"}',    now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'member.demo@nexus.test', crypt('Nexus2026!', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{"full_name":"Julieta Campos"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'client.demo@nexus.test', crypt('Nexus2026!', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{"full_name":"Sergio Iglesias"}', now(), now())
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
from auth.users u
where u.id in (
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000003',
  'd0000000-0000-0000-0000-000000000004'
)
and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

-- ----------------------------------------------------------------------------
-- 2) Completa cada profile (el trigger ya puso full_name/email).
-- ----------------------------------------------------------------------------
update profiles set
  nickname = 'Renata', bio = 'Fundadora y owner de la organización de demo.',
  avatar_url = 'default:05_project_manager.png', avatar_color = '#2C7BD1',
  timezone = 'America/Bogota', role = 'Otro', custom_role = 'Owner / Fundadora',
  skills = array['Liderazgo','Visión de producto'], skill_levels = '{"Liderazgo":9,"Visión de producto":8}',
  languages = array['Español','Inglés'], language_levels = '{"Español":"C2","Inglés":"B2"}'
where id = 'd0000000-0000-0000-0000-000000000001';

update profiles set
  nickname = 'Mateo', bio = 'Encargado del Equipo Producto y líder del proyecto de demo.',
  avatar_url = 'default:02_software_developer.png', avatar_color = '#16A34A',
  timezone = 'America/Bogota', role = 'Desarrollador/a', custom_role = null,
  skills = array['React','Liderazgo técnico','Node.js'], skill_levels = '{"React":9,"Liderazgo técnico":8,"Node.js":7}',
  languages = array['Español','Inglés'], language_levels = '{"Español":"C2","Inglés":"C1"}'
where id = 'd0000000-0000-0000-0000-000000000002';

update profiles set
  nickname = 'Juli', bio = 'Miembro del equipo, sin cargos de liderazgo — perfil normal.',
  avatar_url = 'default:06_graphic_designer.png', avatar_color = '#DB2777',
  timezone = 'America/Bogota', role = 'Diseñador/a', custom_role = null,
  skills = array['Figma','Diseño UI'], skill_levels = '{"Figma":8,"Diseño UI":7}',
  languages = array['Español','Inglés'], language_levels = '{"Español":"C2","Inglés":"B1"}'
where id = 'd0000000-0000-0000-0000-000000000003';

update profiles set
  nickname = 'Sergio', bio = 'Cliente de demo — se une con el código de cliente, no el de organización.',
  avatar_url = 'default:07_accountant.png', avatar_color = '#EA580C',
  timezone = 'America/Mexico_City'
where id = 'd0000000-0000-0000-0000-000000000004';

-- ----------------------------------------------------------------------------
-- 3) Organización + membresías (Renata = owner, Mateo y Julieta = member a
--    nivel organización; "encargado de equipo"/"líder de proyecto" son roles
--    aparte, ver docs/ARQUITECTURA.md).
-- ----------------------------------------------------------------------------
insert into organizations (id, name, color, invite_code, client_invite_code, owner_id)
values ('d0000000-0000-0000-0000-0000000000a0', 'Nexus Demo', '#2C7BD1', 'DEMO2026', 'DEMOCLI26', 'd0000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into organization_members (organization_id, user_id, role) values
  ('d0000000-0000-0000-0000-0000000000a0', 'd0000000-0000-0000-0000-000000000001', 'owner'),
  ('d0000000-0000-0000-0000-0000000000a0', 'd0000000-0000-0000-0000-000000000002', 'member'),
  ('d0000000-0000-0000-0000-0000000000a0', 'd0000000-0000-0000-0000-000000000003', 'member')
on conflict (organization_id, user_id) do nothing;

-- ----------------------------------------------------------------------------
-- 4) Equipo (Mateo = encargado) + proyecto (Mateo también lidera el proyecto,
--    para poder probar el pill "A cargo de 2" del Dashboard) + tasks variadas.
-- ----------------------------------------------------------------------------
insert into teams (id, organization_id, name, description, color, leader_id, created_by)
values ('d0000000-0000-0000-0000-0000000000b0', 'd0000000-0000-0000-0000-0000000000a0', 'Equipo Producto', 'Equipo de demo para probar Nexus con datos reales.', '#2C7BD1', 'd0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into team_members (team_id, user_id, role_in_team) values
  ('d0000000-0000-0000-0000-0000000000b0', 'd0000000-0000-0000-0000-000000000002', 'Encargado/a'),
  ('d0000000-0000-0000-0000-0000000000b0', 'd0000000-0000-0000-0000-000000000003', 'Diseñador/a')
on conflict (team_id, user_id) do nothing;

insert into projects (id, organization_id, name, description, color, status, leader_id, goals, areas, created_by)
values (
  'd0000000-0000-0000-0000-0000000000c0', 'd0000000-0000-0000-0000-0000000000a0',
  'Rediseño de Marca', 'Proyecto de demo para probar Tasks, Dashboard y reportes con datos reales.',
  '#2C7BD1', 'active', 'd0000000-0000-0000-0000-000000000002',
  array['Lanzar nueva identidad visual','Migrar el sitio web'], array['Diseño','Desarrollo'],
  'd0000000-0000-0000-0000-000000000001'
)
on conflict (id) do nothing;

insert into project_teams (project_id, team_id)
values ('d0000000-0000-0000-0000-0000000000c0', 'd0000000-0000-0000-0000-0000000000b0')
on conflict (project_id, team_id) do nothing;

-- 6 tasks: 2 completadas, 1 en progreso (vence en 2 días), 1 bloqueada
-- (vencida hace días, sin completar — para ver el badge de "N vencidas"),
-- 1 pendiente asignada al EQUIPO completo (no a una persona), 1 completada
-- más vieja.
insert into tasks (id, project_id, title, description, status, priority, start_date, due_date, assigned_user_id, assigned_team_id, created_by) values
  ('d0000000-0000-0000-0000-0000000000d1', 'd0000000-0000-0000-0000-0000000000c0', 'Definir paleta de colores', 'Elegir la paleta de la nueva identidad visual.', 'completed', 'medium', '2026-07-01', '2026-07-10', 'd0000000-0000-0000-0000-000000000003', null, 'd0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-0000000000d2', 'd0000000-0000-0000-0000-0000000000c0', 'Diseñar logo final', 'Versión final del isotipo + wordmark.', 'completed', 'high', '2026-06-20', '2026-06-30', 'd0000000-0000-0000-0000-000000000002', null, 'd0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-0000000000d3', 'd0000000-0000-0000-0000-0000000000c0', 'Maquetar landing page', 'Landing con la nueva identidad, responsive.', 'in_progress', 'high', '2026-07-18', '2026-07-25', 'd0000000-0000-0000-0000-000000000003', null, 'd0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-0000000000d4', 'd0000000-0000-0000-0000-0000000000c0', 'Migrar base de datos', 'Migración a la nueva infraestructura — bloqueada por el proveedor.', 'blocked', 'urgent', '2026-07-01', '2026-07-15', 'd0000000-0000-0000-0000-000000000002', null, 'd0000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-0000000000d5', 'd0000000-0000-0000-0000-0000000000c0', 'Escribir copy de la landing', 'Textos de la landing en tono cercano.', 'pending', 'low', null, null, null, 'd0000000-0000-0000-0000-0000000000b0', 'd0000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-0000000000d6', 'd0000000-0000-0000-0000-0000000000c0', 'Reunión de kickoff', 'Kickoff inicial del proyecto con el equipo.', 'completed', 'medium', '2026-06-15', '2026-06-15', 'd0000000-0000-0000-0000-000000000002', null, 'd0000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into task_comments (task_id, user_id, content)
select 'd0000000-0000-0000-0000-0000000000d3', 'd0000000-0000-0000-0000-000000000003', 'Voy avanzando con el hero y la sección de features, debería tener un preview mañana.'
where not exists (select 1 from task_comments where task_id = 'd0000000-0000-0000-0000-0000000000d3' and content like 'Voy avanzando%');

-- Un badge otorgado (Mateo, encargado del equipo, se lo da a Julieta).
insert into profile_badges (organization_id, profile_id, badge_key, granted_by)
select 'd0000000-0000-0000-0000-0000000000a0', 'd0000000-0000-0000-0000-000000000003', 'reliable', 'd0000000-0000-0000-0000-000000000002'
where not exists (
  select 1 from profile_badges
  where organization_id = 'd0000000-0000-0000-0000-0000000000a0' and profile_id = 'd0000000-0000-0000-0000-000000000003' and badge_key = 'reliable'
);

-- Un par de filas de actividad para que la pantalla "Actividad" no arranque
-- vacía — usa exactamente los `action` que describeActivity() reconoce
-- (src/lib/activity.ts). "task_status_changed" con metadata.toStatus =
-- "completed" es el caso especial que se muestra como "completó la tarea X".
insert into activity_log (organization_id, actor_id, actor_name, action, entity_type, entity_id, entity_name, project_id, team_id, metadata)
select * from (values
  ('d0000000-0000-0000-0000-0000000000a0'::uuid, 'd0000000-0000-0000-0000-000000000001'::uuid, 'Renata Paredes', 'project_created', 'project', 'd0000000-0000-0000-0000-0000000000c0'::uuid, 'Rediseño de Marca', 'd0000000-0000-0000-0000-0000000000c0'::uuid, null::uuid, '{}'::jsonb),
  ('d0000000-0000-0000-0000-0000000000a0'::uuid, 'd0000000-0000-0000-0000-000000000001'::uuid, 'Renata Paredes', 'team_created', 'team', 'd0000000-0000-0000-0000-0000000000b0'::uuid, 'Equipo Producto', null::uuid, 'd0000000-0000-0000-0000-0000000000b0'::uuid, '{}'::jsonb),
  ('d0000000-0000-0000-0000-0000000000a0'::uuid, 'd0000000-0000-0000-0000-000000000003'::uuid, 'Julieta Campos', 'task_status_changed', 'task', 'd0000000-0000-0000-0000-0000000000d1'::uuid, 'Definir paleta de colores', 'd0000000-0000-0000-0000-0000000000c0'::uuid, null::uuid, '{"toStatus":"completed"}'::jsonb)
) as v(organization_id, actor_id, actor_name, action, entity_type, entity_id, entity_name, project_id, team_id, metadata)
where not exists (select 1 from activity_log where organization_id = 'd0000000-0000-0000-0000-0000000000a0' and entity_id = v.entity_id and action = v.action);

-- ----------------------------------------------------------------------------
-- 5) Cliente: se une con el código de CLIENTE (no el de organización), queda
--    asignado al Equipo Producto, con un mensaje y una solicitud de ejemplo.
-- ----------------------------------------------------------------------------
insert into organization_clients (organization_id, user_id, data_consent, data_consent_at)
values ('d0000000-0000-0000-0000-0000000000a0', 'd0000000-0000-0000-0000-000000000004', true, now())
on conflict (organization_id, user_id) do nothing;

insert into client_assignments (organization_id, client_user_id, assigned_team_id, assigned_by)
select 'd0000000-0000-0000-0000-0000000000a0', 'd0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-0000000000b0', 'd0000000-0000-0000-0000-000000000001'
where not exists (
  select 1 from client_assignments
  where organization_id = 'd0000000-0000-0000-0000-0000000000a0' and client_user_id = 'd0000000-0000-0000-0000-000000000004' and unassigned_at is null
);

insert into client_messages (organization_id, client_user_id, sender_id, content)
select 'd0000000-0000-0000-0000-0000000000a0', 'd0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', '¡Hola! ¿Cómo va el avance de la landing?'
where not exists (select 1 from client_messages where client_user_id = 'd0000000-0000-0000-0000-000000000004' and content like '¡Hola! ¿Cómo va%');

insert into client_messages (organization_id, client_user_id, sender_id, content)
select 'd0000000-0000-0000-0000-0000000000a0', 'd0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'Vamos muy bien, esta semana te comparto un primer preview.'
where not exists (select 1 from client_messages where client_user_id = 'd0000000-0000-0000-0000-000000000004' and content like 'Vamos muy bien%');

insert into client_requests (organization_id, client_user_id, title, description, status)
select 'd0000000-0000-0000-0000-0000000000a0', 'd0000000-0000-0000-0000-000000000004', 'Reporte de avance del mes', 'Necesito un reporte ejecutivo del avance de julio para mostrarle a mi equipo.', 'open'
where not exists (select 1 from client_requests where client_user_id = 'd0000000-0000-0000-0000-000000000004' and title = 'Reporte de avance del mes');

-- ============================================================================
-- LIMPIEZA: borra TODO lo que crea este script (cascade desde auth.users
-- limpia organización/equipo/proyecto/tasks/cliente/etc.). Descomenta y corre:
--
-- delete from auth.users where email like '%.demo@nexus.test';
-- ============================================================================
