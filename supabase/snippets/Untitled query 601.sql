-- schema_pi.sql — override específico para la instancia self-hosted de la Raspberry Pi.
-- NO reemplaza a schema.sql: correr schema.sql primero (igual que en cualquier otro entorno),
-- y recién después este archivo, solo en la Pi.
--
-- Por qué existe este archivo aparte: el bloque de cron.schedule('task-due-reminders-daily', ...)
-- en schema.sql apunta a `https://<PROJECT_REF>.functions.supabase.co/...`, un endpoint de
-- Supabase Cloud. En self-hosted (stack del Supabase CLI, contenedores `*_nexus`), pg_net corre
-- dentro del contenedor supabase_db_nexus y tiene que llamar a supabase_kong_nexus (el gateway)
-- por la red interna de Docker — no existe ningún "PROJECT_REF" ni URL pública. Mantener este
-- override en un archivo separado evita pisar el bloque pensado para Supabase Cloud en schema.sql
-- cada vez que se re-corra ahí, y evita que alguien corriendo contra Cloud herede por error el
-- endpoint interno de la Pi.
--
-- Requiere (una sola vez, antes de correr este archivo):
--   1. Habilitar las extensiones "pg_cron" y "pg_net":
--        create extension if not exists pg_cron;
--        create extension if not exists pg_net;
--   2. Guardar la Service Role Key real en Vault (nunca commitear el valor real a git):
--        select vault.create_secret('TU_SERVICE_ROLE_KEY_REAL', 'service_role_key');
--   3. Confirmar que supabase_db_nexus resuelve a supabase_kong_nexus por nombre en la red
--      docker (docker exec supabase_db_nexus getent hosts supabase_kong_nexus). Si el nombre
--      de tu contenedor Kong es distinto, ajustar la URL de abajo.
--
-- Es idempotente (drop+create del job), seguro re-correr completo cada vez que se le agrega algo.

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
    url := 'http://supabase_kong_nexus:8000/functions/v1/task-due-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
