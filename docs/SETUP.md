# Setup y variables de entorno

## Variables de entorno (dev)
Cliente (`.env`, plantilla en `.env.example`):
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=   # la "anon"/"publishable" key, NUNCA la "secret"/"service_role"
```
Servidor (secretos de la Edge Function `semillero-chat`, **nunca en `.env` del cliente**):
```
GROQ_API_KEY=      # obligatorio
GROQ_MODEL=        # opcional, default llama-3.3-70b-versatile
```
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` ya los inyecta Supabase automáticamente en runtime de Edge Functions, no hay que configurarlos a mano. Nunca hardcodear ninguna de estas keys en el código ni loguearlas.

Servidor (secretos de las Edge Functions de correo — `send-email`, `on-user-confirmed`, `task-due-reminders`, ver `docs/EMAILS.md`): son **tu propio servidor SMTP** (el mismo que ya configuraste como SMTP custom de Supabase Auth) — Supabase Auth NO expone ese SMTP a las Edge Functions, así que hay que cargarlo de nuevo como secretos separados:
```
SMTP_HOST=
SMTP_PORT=       # 587 (STARTTLS) o 465 (TLS directo)
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=  # opcional, default "Nexus"
APP_URL=         # opcional — URL de la app, usada en el botón de cada correo
```

## Setup de desarrollo
- Copiar `.env.example` a `.env` y completar con las credenciales del proyecto de Supabase (Project Settings → API).
- Correr el contenido de `supabase/schema.sql` en el SQL Editor del proyecto de Supabase (es idempotente, seguro re-correr completo cada vez que se le agrega algo — ver `docs/ESTADO.md` si hay una migración pendiente).
- `npx expo start --web` (o sin `--web` para nativo/Expo Go). Usar `-c` después de cambiar `.env` para limpiar caché.
- Para que el Semillero funcione, además: instalar el [Supabase CLI](https://supabase.com/docs/guides/cli), `supabase login`, `supabase link --project-ref <tu-project-ref>`, luego `supabase functions deploy semillero-chat` y `supabase secrets set GROQ_API_KEY=tu-key` (conseguir la key en [console.groq.com](https://console.groq.com)). Sin esto desplegado, el chat del Semillero muestra el error honesto "No se pudo conectar con la IA" en vez de fallar en silencio.
- Para que las sugerencias de IA de Badges funcionen: `supabase functions deploy badge-suggestions` (reusa el mismo secreto `GROQ_API_KEY`/`GROQ_MODEL` ya configurado para el Semillero, no hace falta uno nuevo).
- Para que Aria (el asistente general, ver `docs/ESTADO.md`) funcione: `supabase functions deploy aria-assistant` (mismos secretos `GROQ_API_KEY`/`GROQ_MODEL`, sin nada nuevo que configurar). Sin esto desplegado, Aria muestra el error honesto de la llamada fallida en vez de fallar en silencio.
- Para probar el Semillero con un roster variado (roles, skills, idiomas, husos horarios distintos a propósito, varios hablantes de árabe en husos distintos para probar el trade-off idioma-vs-huso), correr `supabase/seed_users.sql` en el SQL Editor (hay que poner tu invite_code, instrucciones dentro del archivo). Crea usuarios falsos directo en `auth.users` — no sirven para iniciar sesión de verdad, son solo roster de prueba. Tiene un `DELETE` comentado al final para limpiar todo después.
- Para probar la app completa con **login real** en los 4 roles (owner, encargado de equipo/líder de proyecto, miembro normal, cliente) sin armar nada a mano: correr `supabase/seed.sql` en el SQL Editor. Crea una organización de demo ("Nexus Demo") con equipo/proyecto/tareas ya cargados (algunas completadas, una vencida). Credenciales completas en `docs/Credentials.md` (no versionado en git, ver `.gitignore`) — si no existe en tu copia local, pedirlas o regenerarlas con el propio script. Mismo `DELETE` comentado al final para limpiar.
- Para que los correos transaccionales funcionen (docs/EMAILS.md), en este orden:
  1. `supabase secrets set SMTP_HOST=... SMTP_PORT=... SMTP_USER=... SMTP_PASSWORD=... SMTP_FROM_EMAIL=... SMTP_FROM_NAME=...` (y opcionalmente `APP_URL=...`) con los valores de tu propio servidor SMTP.
  2. `supabase functions deploy send-email` — cubre todos los correos disparados por una acción (organización creada, te uniste, te agregaron a un equipo/proyecto/tarea, tarea bloqueada, badge otorgado — ver el catálogo completo en `docs/EMAILS.md`).
  3. `supabase functions deploy on-user-confirmed` — cubre 1.2 (bienvenida tras confirmar el correo). Además hay que crear a mano un **Database Webhook** en el dashboard (Database → Webhooks): tabla `auth.users` (schema `auth`), evento `UPDATE`, HTTP Request apuntando a esta función, con un header extra `Authorization: Bearer <tu Service Role Key>`. No se puede definir en `schema.sql` porque necesitaría la Service Role Key en un archivo versionado en git.
  4. `supabase functions deploy task-due-reminders` — cubre 5.4 (tarea próxima a vencer). Requiere además, corridos UNA VEZ a mano en el SQL Editor (no vía `schema.sql`, mismo motivo que el paso anterior): habilitar las extensiones `pg_cron`/`pg_net` (Database → Extensions) y guardar tu Service Role Key en Vault con `select vault.create_secret('TU_SERVICE_ROLE_KEY_REAL', 'service_role_key');`. El cron en sí (`cron.schedule(...)`, que solo referencia el secreto por nombre, sin el valor real) sí vive en `schema.sql` — hay que reemplazar `<PROJECT_REF>` por el ref real de tu proyecto antes de correrlo.
  - Sin estos 3 despliegues, las funciones de mutación (`createOrganization`, `createTask`, `grantBadge`, etc.) siguen funcionando normal — solo el envío de correo falla en silencio (`console.warn`), mismo criterio de resiliencia que `activity_log`.
  - **Nada de esto cubre la sección 6 de `docs/EMAILS.md` (módulo de Clientes)** — depende de que `docs/CLIENTE.md` se construya primero.

## Setup de producción (Pi 5) — roadmap, no empezado
- Ollama instalado directo en el SO del Pi (Windows/Linux) — nunca en Docker
- Supabase self-hosted en Docker
- Cloudflare Tunnel para exponer el Pi con HTTPS sin abrir puertos
- Deploy vía SSH + FileZilla
- **Al correr `supabase/schema.sql` contra un Postgres self-hosted, conectarse como superusuario (`postgres`) al SQL Editor/psql, no con un rol restringido.** A diferencia de Supabase Cloud (que preconfigura los GRANTs de `anon`/`authenticated`/`service_role` al aprovisionar el proyecto), un self-hosted puede no tenerlos si la inicialización de roles del stack no terminó antes de correr el schema, o si se corrió con otro rol — eso produce `permission denied for table X` en cualquier tabla, aunque las policies de RLS estén bien. `schema.sql` ya trae al final un bloque `grant ... to anon, authenticated, service_role` + `alter default privileges` (idempotente) que corrige esto — si el error ya apareció, simplemente volver a correr el archivo completo. Ver la trampa correspondiente en `docs/TRAMPAS.md`.
