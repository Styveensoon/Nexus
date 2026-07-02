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

## Setup de desarrollo
- Copiar `.env.example` a `.env` y completar con las credenciales del proyecto de Supabase (Project Settings → API).
- Correr el contenido de `supabase/schema.sql` en el SQL Editor del proyecto de Supabase (es idempotente, seguro re-correr completo cada vez que se le agrega algo — ver `docs/ESTADO.md` si hay una migración pendiente).
- `npx expo start --web` (o sin `--web` para nativo/Expo Go). Usar `-c` después de cambiar `.env` para limpiar caché.
- Para que el Semillero funcione, además: instalar el [Supabase CLI](https://supabase.com/docs/guides/cli), `supabase login`, `supabase link --project-ref <tu-project-ref>`, luego `supabase functions deploy semillero-chat` y `supabase secrets set GROQ_API_KEY=tu-key` (conseguir la key en [console.groq.com](https://console.groq.com)). Sin esto desplegado, el chat del Semillero muestra el error honesto "No se pudo conectar con la IA" en vez de fallar en silencio.
- Para probar el Semillero con un roster variado (roles, skills, idiomas, husos horarios distintos a propósito, varios hablantes de árabe en husos distintos para probar el trade-off idioma-vs-huso), correr `supabase/seed_users.sql` en el SQL Editor (hay que poner tu invite_code, instrucciones dentro del archivo). Crea usuarios falsos directo en `auth.users` — no sirven para iniciar sesión de verdad, son solo roster de prueba. Tiene un `DELETE` comentado al final para limpiar todo después.

## Setup de producción (Pi 5) — roadmap, no empezado
- Ollama instalado directo en el SO del Pi (Windows/Linux) — nunca en Docker
- Supabase self-hosted en Docker
- Cloudflare Tunnel para exponer el Pi con HTTPS sin abrir puertos
- Deploy vía SSH + FileZilla
