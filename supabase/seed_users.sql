-- ============================================================================
-- seed_users.sql — datos de prueba para el Semillero
-- ============================================================================
-- Qué hace: crea 26 usuarios falsos (auth.users + profiles vía el trigger
-- handle_new_user) con roles, habilidades, idiomas y ZONAS HORARIAS variadas
-- y distintas entre sí a propósito, y los une como 'member' a UNA organización
-- real tuya (la que elijas con el invite_code de abajo).
--
-- Para qué sirve: darle al Semillero un roster real y variado para poner a
-- prueba cosas como "necesito una página en árabe" (hay 3 personas con árabe,
-- en husos horarios distintos) o "necesito coordinar reuniones diarias en
-- vivo" (hay gente en Bogotá, Madrid, Dubái, Tokio y Sídney — algunos casi
-- no comparten horario laboral con nadie más).
--
-- CÓMO USARLO:
--   1. Ve al Dashboard de tu app (como owner) y copia el código de invitación
--      de tu organización (tarjeta "TU WORKSPACE" → "Copiar código").
--   2. Reemplaza 'PON_TU_CODIGO_AQUI' por ese código — aparece UNA sola vez,
--      en el "select set_config(...)" justo abajo de este bloque.
--   3. Pega este archivo completo en el SQL Editor de Supabase y corre.
--
-- ADVERTENCIAS:
--   - Esto inserta filas directamente en auth.users con contraseñas
--     inválidas (nadie puede iniciar sesión con estas cuentas). Es una
--     técnica de seeding, no un flujo normal de registro — no lo corras
--     contra una base con usuarios reales de producción.
--   - Requiere pgcrypto (ya la habilita supabase/schema.sql).
--   - Para BORRAR todo lo que crea este script después de probar, al final
--     de este archivo dejo el DELETE listo (comentado).
-- ============================================================================

create extension if not exists pgcrypto;

-- ÚNICO lugar donde hay que poner tu código de invitación (se reutiliza más
-- abajo vía current_setting, así no hay que repetirlo en varios sitios).
select set_config('nexus.seed_invite_code', 'PON_TU_CODIGO_AQUI', false); -- <-- CAMBIA ESTO

do $$
declare
  v_invite_code text := current_setting('nexus.seed_invite_code');
  v_org_id uuid;
begin
  select id into v_org_id from organizations where invite_code = upper(v_invite_code);
  if v_org_id is null then
    raise exception 'No existe ninguna organización con invite_code = %. Revisa el código en tu Dashboard.', v_invite_code;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1) Usuarios en auth.users (dispara handle_new_user, que crea el profile
--    base con full_name/email — el resto de campos se completa en el paso 2).
-- ----------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.majo.torres@nexus.test',    crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"María José Torres"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.camila.fernandez@nexus.test', crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Camila Fernández"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.yusuf.alamin@nexus.test',     crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Yusuf Al-Amin"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.layla.haddad@nexus.test',     crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Layla Haddad"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.diego.herrera@nexus.test',    crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Diego Herrera"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.valentina.rios@nexus.test',   crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Valentina Ríos"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.andres.molina@nexus.test',    crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Andrés Molina"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.sofia.landazuri@nexus.test',  crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sofía Landázuri"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.renata.cabral@nexus.test',    crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Renata Cabral"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.patricio.ibanez@nexus.test',  crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Patricio Ibáñez"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.grecia.salazar@nexus.test',   crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Grecia Salazar"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.marco.antonelli@nexus.test',  crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Marco Antonelli"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.isabela.duarte@nexus.test',   crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Isabela Duarte"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.kenji.watanabe@nexus.test',   crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Kenji Watanabe"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.wei.zhang@nexus.test',        crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Wei Zhang"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.priya.nair@nexus.test',       crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Priya Nair"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.charlotte.bennett@nexus.test',crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Charlotte Bennett"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.liam.oconnor@nexus.test',     crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Liam O''Connor"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.noah.bergstrom@nexus.test',   crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Noah Bergström"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.amara.chen@nexus.test',       crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Amara Chen"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.tomas.vidal@nexus.test',      crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Tomás Vidal"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.fatima.zahra@nexus.test',     crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Fátima Zahra"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.hiroshi.sato@nexus.test',     crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Hiroshi Sato"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.emeka.okafor@nexus.test',     crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Emeka Okafor"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.valeria.nunez@nexus.test',    crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Valeria Núñez"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000026', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed.karim.boutros@nexus.test',    crypt('seed-not-usable', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Karim Boutros"}', now(), now())
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2) Completa cada profile: nickname, bio, avatar, color, timezone, rol,
--    skills con nivel 1-10, idiomas con nivel CEFR.
-- ----------------------------------------------------------------------------

-- Frontend, Bogotá — accesibilidad + React
update profiles set
  nickname = 'Majo', bio = 'Frontend obsesionada con animaciones suaves y accesibilidad web.',
  avatar_url = 'default:02_software_developer.png', avatar_color = '#2563EB',
  timezone = 'America/Bogota', role = 'Desarrollador/a', custom_role = null,
  skills = array['React','TypeScript','CSS','Accesibilidad web'],
  skill_levels = '{"React":9,"TypeScript":8,"CSS":7,"Accesibilidad web":6}',
  languages = array['Español','Inglés'], language_levels = '{"Español":"C2","Inglés":"B2"}'
where id = 'a0000000-0000-0000-0000-000000000001';

-- Backend, Bogotá — misma zona que Majo (buen "combo local")
update profiles set
  nickname = 'Cami', bio = 'Backend pragmática, le gusta dejar APIs bien documentadas.',
  avatar_url = 'default:02_software_developer.png', avatar_color = '#16A34A',
  timezone = 'America/Bogota', role = 'Desarrollador/a', custom_role = null,
  skills = array['Node.js','PostgreSQL','Arquitectura de APIs'],
  skill_levels = '{"Node.js":9,"PostgreSQL":8,"Arquitectura de APIs":7}',
  languages = array['Español','Inglés'], language_levels = '{"Español":"C2","Inglés":"C1"}'
where id = 'a0000000-0000-0000-0000-000000000002';

-- Fullstack + árabe nativo, Dubái (UTC+4, lejos del resto del equipo LatAm)
update profiles set
  nickname = 'Yusuf', bio = 'Full-stack en Dubái, especializado en apps multilenguaje y RTL.',
  avatar_url = 'default:02_software_developer.png', avatar_color = '#D97706',
  timezone = 'Asia/Dubai', role = 'Desarrollador/a', custom_role = null,
  skills = array['React','Node.js','Localización de software (RTL)'],
  skill_levels = '{"React":7,"Node.js":7,"Localización de software (RTL)":8}',
  languages = array['Árabe','Inglés','Español'], language_levels = '{"Árabe":"C2","Inglés":"B2","Español":"A2"}'
where id = 'a0000000-0000-0000-0000-000000000003';

-- Marketing/contenido en árabe, también Dubái (mismo huso que Yusuf)
update profiles set
  nickname = 'Layla', bio = 'Redactora bilingüe árabe/inglés, especialista en contenido localizado.',
  avatar_url = 'default:03_marketing_specialist.png', avatar_color = '#DB2777',
  timezone = 'Asia/Dubai', role = 'Marketing', custom_role = null,
  skills = array['Copywriting','Traducción árabe-inglés','SEO'],
  skill_levels = '{"Copywriting":8,"Traducción árabe-inglés":9,"SEO":6}',
  languages = array['Árabe','Inglés','Francés'], language_levels = '{"Árabe":"C2","Inglés":"C1","Francés":"B1"}'
where id = 'a0000000-0000-0000-0000-000000000004';

-- Diseñador UI/UX, Ciudad de México
update profiles set
  nickname = 'Diego', bio = 'Diseñador de producto, fan de los design systems ordenados.',
  avatar_url = 'default:06_graphic_designer.png', avatar_color = '#7C3AED',
  timezone = 'America/Mexico_City', role = 'Diseñador/a', custom_role = null,
  skills = array['Figma','Prototipado','Diseño de sistemas'],
  skill_levels = '{"Figma":9,"Prototipado":8,"Diseño de sistemas":7}',
  languages = array['Español','Inglés'], language_levels = '{"Español":"C2","Inglés":"B1"}'
where id = 'a0000000-0000-0000-0000-000000000005';

-- Diseñadora gráfica, São Paulo
update profiles set
  nickname = 'Vale', bio = 'Diseño de marca e ilustración, siempre con referencias de sobra.',
  avatar_url = 'default:06_graphic_designer.png', avatar_color = '#DC2626',
  timezone = 'America/Sao_Paulo', role = 'Diseñador/a', custom_role = null,
  skills = array['Illustrator','Branding','Photoshop'],
  skill_levels = '{"Illustrator":8,"Branding":9,"Photoshop":7}',
  languages = array['Español','Portugués'], language_levels = '{"Español":"C2","Portugués":"B2"}'
where id = 'a0000000-0000-0000-0000-000000000006';

-- Product Manager, Bogotá
update profiles set
  nickname = 'Andrés', bio = 'PM de metodologías ágiles, buen puente entre negocio y equipo.',
  avatar_url = 'default:05_project_manager.png', avatar_color = '#0891B2',
  timezone = 'America/Bogota', role = 'Product Manager', custom_role = null,
  skills = array['Roadmapping','Metodologías ágiles','Comunicación'],
  skill_levels = '{"Roadmapping":8,"Metodologías ágiles":9,"Comunicación":8}',
  languages = array['Español','Inglés'], language_levels = '{"Español":"C2","Inglés":"C1"}'
where id = 'a0000000-0000-0000-0000-000000000007';

-- Product Manager, Madrid
update profiles set
  nickname = 'Sofi', bio = 'PM centrada en investigación de usuarios y priorización.',
  avatar_url = 'default:05_project_manager.png', avatar_color = '#2563EB',
  timezone = 'Europe/Madrid', role = 'Product Manager', custom_role = null,
  skills = array['Investigación de usuarios','Priorización'],
  skill_levels = '{"Investigación de usuarios":8,"Priorización":7}',
  languages = array['Español','Inglés','Alemán'], language_levels = '{"Español":"C2","Inglés":"B2","Alemán":"A2"}'
where id = 'a0000000-0000-0000-0000-000000000008';

-- Recursos Humanos, São Paulo
update profiles set
  nickname = 'Rê', bio = 'HR enfocada en reclutamiento y cultura organizacional.',
  avatar_url = 'default:01_human_resources.png', avatar_color = '#059669',
  timezone = 'America/Sao_Paulo', role = 'Recursos Humanos', custom_role = null,
  skills = array['Reclutamiento','Onboarding','Cultura organizacional'],
  skill_levels = '{"Reclutamiento":9,"Onboarding":8,"Cultura organizacional":7}',
  languages = array['Español','Portugués','Inglés'], language_levels = '{"Español":"C2","Portugués":"C1","Inglés":"B1"}'
where id = 'a0000000-0000-0000-0000-000000000009';

-- Recursos Humanos / People Ops, Santiago
update profiles set
  nickname = 'Pato', bio = 'People Ops: bienestar laboral y employer branding.',
  avatar_url = 'default:01_human_resources.png', avatar_color = '#EA580C',
  timezone = 'America/Santiago', role = 'Recursos Humanos', custom_role = null,
  skills = array['Employer branding','Bienestar laboral'],
  skill_levels = '{"Employer branding":7,"Bienestar laboral":8}',
  languages = array['Español','Inglés'], language_levels = '{"Español":"C2","Inglés":"B1"}'
where id = 'a0000000-0000-0000-0000-000000000010';

-- Contadora, Ciudad de México
update profiles set
  nickname = 'Gre', bio = 'Contadora meticulosa, ama un Excel bien armado.',
  avatar_url = 'default:07_accountant.png', avatar_color = '#4338CA',
  timezone = 'America/Mexico_City', role = 'Finanzas', custom_role = null,
  skills = array['Contabilidad','Excel avanzado','Presupuestos'],
  skill_levels = '{"Contabilidad":9,"Excel avanzado":8,"Presupuestos":7}',
  languages = array['Español','Inglés'], language_levels = '{"Español":"C2","Inglés":"A2"}'
where id = 'a0000000-0000-0000-0000-000000000011';

-- Finanzas, Madrid
update profiles set
  nickname = 'Marco', bio = 'Análisis financiero y modelado de escenarios.',
  avatar_url = 'default:07_accountant.png', avatar_color = '#B91C1C',
  timezone = 'Europe/Madrid', role = 'Finanzas', custom_role = null,
  skills = array['Análisis financiero','Modelado de escenarios'],
  skill_levels = '{"Análisis financiero":8,"Modelado de escenarios":7}',
  languages = array['Español','Italiano','Inglés'], language_levels = '{"Español":"C1","Italiano":"C2","Inglés":"B2"}'
where id = 'a0000000-0000-0000-0000-000000000012';

-- Data Analyst, Bogotá
update profiles set
  nickname = 'Isa', bio = 'Data analyst: SQL, Python y dashboards que sí se entienden.',
  avatar_url = 'default:04_data_analyst.png', avatar_color = '#0D9488',
  timezone = 'America/Bogota', role = 'Otro', custom_role = 'Data Analyst',
  skills = array['SQL','Python','Visualización de datos','Power BI'],
  skill_levels = '{"SQL":9,"Python":8,"Visualización de datos":8,"Power BI":7}',
  languages = array['Español','Inglés'], language_levels = '{"Español":"C2","Inglés":"C1"}'
where id = 'a0000000-0000-0000-0000-000000000013';

-- Data Scientist, Tokio (muy lejos del cluster LatAm)
update profiles set
  nickname = 'Kenji', bio = 'Data scientist en Tokio, apasionado por los modelos predictivos.',
  avatar_url = 'default:04_data_analyst.png', avatar_color = '#9333EA',
  timezone = 'Asia/Tokyo', role = 'Otro', custom_role = 'Data Scientist',
  skills = array['Python','Machine learning','SQL'],
  skill_levels = '{"Python":9,"Machine learning":8,"SQL":7}',
  languages = array['Japonés','Inglés'], language_levels = '{"Japonés":"C2","Inglés":"B2"}'
where id = 'a0000000-0000-0000-0000-000000000014';

-- Mobile dev, Shanghái
update profiles set
  nickname = 'Wei', bio = 'Desarrollo mobile multiplataforma, React Native y nativo.',
  avatar_url = 'default:02_software_developer.png', avatar_color = '#CA8A04',
  timezone = 'Asia/Shanghai', role = 'Desarrollador/a', custom_role = null,
  skills = array['React Native','Swift','Kotlin'],
  skill_levels = '{"React Native":8,"Swift":6,"Kotlin":6}',
  languages = array['Mandarín','Inglés'], language_levels = '{"Mandarín":"C2","Inglés":"B2"}'
where id = 'a0000000-0000-0000-0000-000000000015';

-- Atención al cliente, Dubái
update profiles set
  nickname = 'Priya', bio = 'Soporte técnico con enfoque en resolución rápida de conflictos.',
  avatar_url = 'default:08_executive_assistant.png', avatar_color = '#0284C7',
  timezone = 'Asia/Dubai', role = 'Atención al Cliente', custom_role = null,
  skills = array['Soporte técnico','Resolución de conflictos','CRM'],
  skill_levels = '{"Soporte técnico":8,"Resolución de conflictos":9,"CRM":6}',
  languages = array['Inglés','Español'], language_levels = '{"Inglés":"C2","Español":"B1"}'
where id = 'a0000000-0000-0000-0000-000000000016';

-- Ventas, Londres
update profiles set
  nickname = 'Charlotte', bio = 'Ventas B2B, negociación y prospección internacional.',
  avatar_url = 'default:03_marketing_specialist.png', avatar_color = '#DB2777',
  timezone = 'Europe/London', role = 'Ventas', custom_role = null,
  skills = array['Negociación','Prospección','CRM'],
  skill_levels = '{"Negociación":9,"Prospección":7,"CRM":7}',
  languages = array['Inglés','Francés'], language_levels = '{"Inglés":"C2","Francés":"B2"}'
where id = 'a0000000-0000-0000-0000-000000000017';

-- Legal, Londres — sin avatar default, solo color (para variedad)
update profiles set
  nickname = 'Liam', bio = 'Legal: contratos, compliance y propiedad intelectual.',
  avatar_url = null, avatar_color = '#334155',
  timezone = 'Europe/London', role = 'Legal', custom_role = null,
  skills = array['Contratos','Compliance','Propiedad intelectual'],
  skill_levels = '{"Contratos":8,"Compliance":7,"Propiedad intelectual":6}',
  languages = array['Inglés','Español'], language_levels = '{"Inglés":"C2","Español":"A2"}'
where id = 'a0000000-0000-0000-0000-000000000018';

-- Operaciones, Madrid — sin avatar default
update profiles set
  nickname = 'Noah', bio = 'Operaciones: logística, procesos y proveedores.',
  avatar_url = null, avatar_color = '#64748B',
  timezone = 'Europe/Madrid', role = 'Operaciones', custom_role = null,
  skills = array['Logística','Procesos','Gestión de proveedores'],
  skill_levels = '{"Logística":8,"Procesos":7,"Gestión de proveedores":6}',
  languages = array['Inglés','Alemán'], language_levels = '{"Inglés":"C1","Alemán":"B2"}'
where id = 'a0000000-0000-0000-0000-000000000019';

-- Diseñadora de producto (rol personalizado), Sídney — muy lejos del resto
update profiles set
  nickname = 'Amara', bio = 'Diseño de producto y UX writing, siempre pensando en sistemas.',
  avatar_url = 'default:06_graphic_designer.png', avatar_color = '#F59E0B',
  timezone = 'Australia/Sydney', role = 'Otro', custom_role = 'Diseñadora de Producto / UX Writer',
  skills = array['Design systems','Figma','Investigación UX'],
  skill_levels = '{"Design systems":9,"Figma":8,"Investigación UX":7}',
  languages = array['Inglés','Mandarín'], language_levels = '{"Inglés":"C1","Mandarín":"B1"}'
where id = 'a0000000-0000-0000-0000-000000000020';

-- Asistente ejecutivo, Santiago
update profiles set
  nickname = 'Tomás', bio = 'Asistencia ejecutiva: agendas, viajes y eventos sin fricción.',
  avatar_url = 'default:08_executive_assistant.png', avatar_color = '#16A34A',
  timezone = 'America/Santiago', role = 'Otro', custom_role = 'Asistente Ejecutivo',
  skills = array['Gestión de agenda','Organización de eventos'],
  skill_levels = '{"Gestión de agenda":8,"Organización de eventos":7}',
  languages = array['Español','Inglés'], language_levels = '{"Español":"C2","Inglés":"B1"}'
where id = 'a0000000-0000-0000-0000-000000000021';

-- Traductora nativa de árabe, Madrid (huso MUCHO más cercano al equipo LatAm/Europa que Dubái)
update profiles set
  nickname = 'Fátima', bio = 'Traductora nativa de árabe radicada en Madrid, especializada en contenido web.',
  avatar_url = 'default:03_marketing_specialist.png', avatar_color = '#9D174D',
  timezone = 'Europe/Madrid', role = 'Otro', custom_role = 'Traductora y Localizadora',
  skills = array['Traducción árabe','Traducción francés','Edición de contenido'],
  skill_levels = '{"Traducción árabe":10,"Traducción francés":8,"Edición de contenido":7}',
  languages = array['Árabe','Francés','Español'], language_levels = '{"Árabe":"C2","Francés":"C2","Español":"B1"}'
where id = 'a0000000-0000-0000-0000-000000000022';

-- Compliance internacional, Tokio
update profiles set
  nickname = 'Hiroshi', bio = 'Compliance internacional y derecho corporativo.',
  avatar_url = null, avatar_color = '#1E293B',
  timezone = 'Asia/Tokyo', role = 'Otro', custom_role = 'Especialista en Compliance Internacional',
  skills = array['Compliance','Derecho corporativo'],
  skill_levels = '{"Compliance":9,"Derecho corporativo":7}',
  languages = array['Japonés','Inglés'], language_levels = '{"Japonés":"C2","Inglés":"B2"}'
where id = 'a0000000-0000-0000-0000-000000000023';

-- DevOps/backend, huso "Europe/London" (cubre también Dakar/UTC+0 en la lista curada de la app)
update profiles set
  nickname = 'Emeka', bio = 'DevOps y backend, ama automatizar todo lo que se repite.',
  avatar_url = 'default:02_software_developer.png', avatar_color = '#0F766E',
  timezone = 'Europe/London', role = 'Desarrollador/a', custom_role = null,
  skills = array['DevOps','AWS','Docker','CI/CD'],
  skill_levels = '{"DevOps":9,"AWS":8,"Docker":8,"CI/CD":7}',
  languages = array['Inglés','Francés'], language_levels = '{"Inglés":"C2","Francés":"B1"}'
where id = 'a0000000-0000-0000-0000-000000000024';

-- Recursos Humanos / People Analytics, Nueva York
update profiles set
  nickname = 'Vale N.', bio = 'People analytics y comunicación interna basada en datos.',
  avatar_url = 'default:01_human_resources.png', avatar_color = '#0EA5E9',
  timezone = 'America/New_York', role = 'Recursos Humanos', custom_role = null,
  skills = array['People analytics','Comunicación interna'],
  skill_levels = '{"People analytics":7,"Comunicación interna":8}',
  languages = array['Español','Inglés'], language_levels = '{"Español":"C2","Inglés":"B2"}'
where id = 'a0000000-0000-0000-0000-000000000025';

-- Ventas / atención al cliente en árabe, Dubái (tercer hablante de árabe, mismo huso que Yusuf y Layla)
update profiles set
  nickname = 'Karim', bio = 'Ventas B2B y atención al cliente en árabe e inglés.',
  avatar_url = 'default:08_executive_assistant.png', avatar_color = '#7C2D12',
  timezone = 'Asia/Dubai', role = 'Ventas', custom_role = null,
  skills = array['Ventas B2B','Atención al cliente'],
  skill_levels = '{"Ventas B2B":8,"Atención al cliente":7}',
  languages = array['Árabe','Inglés'], language_levels = '{"Árabe":"C2","Inglés":"B1"}'
where id = 'a0000000-0000-0000-0000-000000000026';

-- ----------------------------------------------------------------------------
-- 3) Une a los 26 como 'member' de tu organización.
-- ----------------------------------------------------------------------------
insert into organization_members (organization_id, user_id, role)
select
  (select id from organizations where invite_code = upper(current_setting('nexus.seed_invite_code'))),
  u.id,
  'member'
from unnest(array[
  'a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000006',
  'a0000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000008',
  'a0000000-0000-0000-0000-000000000009','a0000000-0000-0000-0000-000000000010',
  'a0000000-0000-0000-0000-000000000011','a0000000-0000-0000-0000-000000000012',
  'a0000000-0000-0000-0000-000000000013','a0000000-0000-0000-0000-000000000014',
  'a0000000-0000-0000-0000-000000000015','a0000000-0000-0000-0000-000000000016',
  'a0000000-0000-0000-0000-000000000017','a0000000-0000-0000-0000-000000000018',
  'a0000000-0000-0000-0000-000000000019','a0000000-0000-0000-0000-000000000020',
  'a0000000-0000-0000-0000-000000000021','a0000000-0000-0000-0000-000000000022',
  'a0000000-0000-0000-0000-000000000023','a0000000-0000-0000-0000-000000000024',
  'a0000000-0000-0000-0000-000000000025','a0000000-0000-0000-0000-000000000026'
]::uuid[]) as u(id)
on conflict (organization_id, user_id) do nothing;

-- ============================================================================
-- LIMPIEZA: cuando termines de probar, borra todo lo que creó este script
-- (el delete en auth.users hace cascade sobre profiles y organization_members).
-- Descomenta y corre:
--
-- delete from auth.users where email like 'seed.%@nexus.test';
-- ============================================================================
