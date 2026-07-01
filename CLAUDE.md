@AGENTS.md

# NEXUS — Contexto del proyecto

## Qué es
Plataforma de gestión de proyectos con IA local, self-hosted, multiplataforma (iOS, Android, Web) con un solo código en Expo + React Native.

**Diferenciador de negocio principal:** los datos nunca salen de la red del cliente. En producción, la IA correría 100% local vía Ollama en un Raspberry Pi 5 — sin esto no hay venta a empresas como T-Systems, bancos o gobierno. **Nota: esto es visión de producto, todavía no hay ninguna infraestructura de IA construida (ver "Estado actual" abajo).**

## Estado actual (leer esto antes de asumir que algo existe)
Lo real y funcional hoy:
- **Auth completo con Supabase:** registro, login, verificación de correo, sign out. Ver `src/context/AuthContext.tsx` (`useAuth()`) y `src/lib/supabase.ts`.
- **Organizaciones (= "workspace" de la visión, pero simplificado):** crear organización con nombre/color/logo personalizables, o unirse por código de invitación. Ver `src/lib/organizations.ts` y `supabase/schema.sql`.
- **Pantallas "premium" ya rediseñadas** (identidad visual consistente, ver sección de abajo): `LandingScreen`, `LoginScreen`, `RegisterScreen`, `WorkspaceSetupScreen`, `JoinWorkspaceScreen`, `SemilleroScreen`, `DashboardScreen`, `BottomTabs`, `ProfileSetupScreen`, `ProfileScreen`, `ProjectsScreen`.
- **Dashboard/home** rediseñado para la vista del admin/creador de la organización: fondo con el color de marca de la org, tarjeta con código de invitación, sección "El Semillero" (solo visible para el owner), tiles de Equipos/Badges/Clientes (informativos, sin backend), nav propia responsive (barra arriba en desktop ≥768px, abajo en móvil).
- **Perfil de colaborador completo:** tras crear/unirse a organización, `ProfileSetupScreen` obliga a pasar por un onboarding de perfil (todos los campos opcionales) antes del Dashboard. La pestaña `Profile` real (ya no mock) tiene modo vista + modo edición (ícono de tuerca) usando el mismo formulario compartido `src/components/ProfileEditorForm.tsx`. Campos: mote, bio corta, foto (8 avatares prediseñados o subida real con drag-and-drop en web / picker nativo en mobile a Supabase Storage), color de card, zona horaria, rol/cargo, idiomas con nivel CEFR (A1–C2), habilidades con nivel 1-10 (arrastrable, componente `LevelDots`). Badges/Equipos/Proyectos se muestran en la pestaña Profile pero son de solo lectura con estado vacío honesto (ver abajo).
- **El Semillero con IA real conectada:** `SemilleroScreen` es un chat (panel de conversaciones previas a la izquierda para retomarlas, mensajes a la derecha). El owner describe una idea, la IA (Groq, vía la Edge Function `supabase/functions/semillero-chat`) hace preguntas para pulirla y, cuando tiene contexto suficiente, sugiere equipo + líder + primeros pasos usando el roster real de la organización (skills, idiomas **y zona horaria** — evita sugerir equipos con husos horarios incompatibles cuando hay alternativas). La sugerencia se guarda estructurada (`semillero_messages.team_suggestion`) para no tener que volver a llamar a la IA al reabrir el chat. El botón "Crear proyecto" de la tarjeta de sugerencia ya crea de verdad el proyecto + sus miembros (`createProjectFromSuggestion` en `src/lib/projects.ts`) y navega a Proyectos — ver bullet de Proyectos abajo. Solo el owner de la organización puede usarlo (RLS + chequeo en la Edge Function). Gestión de chats completa: renombrar inline (lápiz), borrar con confirmación inline (nunca `Alert.alert`, ver trampa abajo), regenerar la última respuesta del asistente. Ver `src/lib/semillero.ts`. Para pruebas con datos variados (roles, skills, idiomas, husos horarios), ver `supabase/seed_users.sql`.
- **Proyectos con backend real:** `ProjectsScreen` (rediseñada, ya no mock) lista los proyectos reales de la organización con búsqueda, filtro por status y stats reales (nada inventado). El owner puede crear proyectos a mano (modal con nombre/descripción/color) o dejar que se creen desde una sugerencia de El Semillero (líder + equipo + `first_steps` precargados). Cualquier miembro ve la lista (RLS `projects_select_org`); solo el owner puede crear/borrar/cambiar status (tocar el badge de status lo cicla). Ver `src/lib/projects.ts` y tablas `projects`/`project_members` en `schema.sql`. Pendiente: pantalla de detalle de proyecto (hoy solo hay lista/tarjetas) y que tareas/comentarios se conecten a un proyecto real.

Lo que **NO** existe todavía, aunque el resto de este documento lo describa como visión:
- Ollama (producción) sigue sin ninguna infraestructura construida. Groq (dev) ya está conectado, pero solo para el chat del Semillero — ver arriba.
- Tablas de `tasks`, `issues`, `teams`, `comments` — **no existen en la base de datos.** Las tablas reales son `profiles`, `organizations`, `organization_members`, `semillero_chats`, `semillero_messages`, `projects`, `project_members` (más el bucket de Storage `avatars`). (`projects`/`project_members` ya existen, ver bullet de Proyectos arriba — antes de esta pasada no existían.)
- Roles ricos (`team_leader`, `client`) — hoy `organization_members.role` solo es `'owner' | 'member'`.
- Quién asigna badges (team_leader/admin) — hoy `profiles.badges` existe en el esquema pero nada lo escribe todavía; la pestaña Profile solo lo muestra.
- Las pestañas **Tasks/Calendar/Team siguen con datos de ejemplo (mock)**, usan `@expo/vector-icons` en vez de `lucide-react-native`, y no llaman a `useAuth()`. Redecidir/rediseñar cada una es trabajo pendiente, una por una. (`Profile` y `Projects` ya se rediseñaron, ver arriba.)
- Nada de infraestructura de Raspberry Pi / Docker / Cloudflare Tunnel.

## Patrones de código ya establecidos (reusar, no reinventar)
- **Paleta local por pantalla** (no hay theme file compartido para las pantallas nuevas): cada componente calcula sus propios `bg`, `cardBg`, `border`, `textPrimary`, `textSecondary`, `primaryColor = "#2563EB"`, `inputBg` a partir de `isDark` (de `useTheme()`). Copiar el bloque tal cual de cualquier pantalla ya rediseñada en vez de crear una paleta nueva.
- **Sombra:** patrón `ultraShadow` vía `Platform.select({ web: { boxShadow, backdropFilter: "blur(12px)" }, default: { shadowColor/Offset/Opacity/Radius, elevation } })`.
- **Responsive:** `const isMobile = useWindowDimensions().width < 768` en cada pantalla — no hay breakpoints centralizados. Contenido en desktop va dentro de un contenedor `maxWidth` centrado (960–1280 según la pantalla).
- **Íconos:** `lucide-react-native` en todo lo nuevo/rediseñado. Las pantallas viejas sin rediseñar (Tasks/Calendar/Team) todavía usan `@expo/vector-icons` — no mezclar los dos sistemas al tocar una pantalla, migrar a lucide si se rediseña.
- **Botones primarios:** píldora (`borderRadius: 999`).
- **Filosofía anti-fake:** nunca simular que algo funciona cuando no hay backend. Si no hay feature real, se muestra un estado vacío honesto o un aviso tipo "esto estará disponible pronto" — nunca un spinner falso ni un botón que aparenta éxito. (Ver las secciones Badges/Equipos de `ProfileScreen.tsx`, o `ProjectsScreen.tsx`, que muestra un banner de error honesto en vez de ocultar un fallo de red.)
- **Formularios reusables:** la edición de perfil vive en `src/components/ProfileEditorForm.tsx` (self-contained: hace su propio fetch/save) y la usan tanto `ProfileSetupScreen` (onboarding, sin botón cancelar) como `ProfileScreen` en modo edición (con cancelar) — pasarle `onCancel` o no cambia el layout del botón de guardar.
- **Modales tipo picker:** `ColorPickerModal` (hue bar + hex) y `TimezoneModal` (búsqueda + lista) comparten el mismo overlay/card. Para inputs "arrastrables" (slider discreto), ver `LevelDots.tsx` (usa `PanResponder`, igual que la hue bar del color picker; acepta `disabled` para modo solo-lectura).
- **Código específico de plataforma:** cuando algo necesita DOM real en web (ej. `AvatarUploadZone` con drag-and-drop), usar el patrón `Componente.tsx` (nativo) + `Componente.web.tsx` (web) — Metro resuelve el archivo correcto por plataforma solo con el nombre.

## Trampas conocidas (para no perder tiempo redescubriéndolas)
- **`src/navigation/AppNavigator.tsx` está muerto.** No compila (importa `@react-navigation/native-stack`, que no está instalado) y no se usa en ningún lado. El navegador raíz real es `App.tsx` (cargado vía `index.ts`), envuelto en `ThemeProvider > AuthProvider > NavigationContainer`. Si `tsc` marca un error ahí, es preexistente y se ignora.
- **Confirmación de correo activada en Supabase:** `signUp` no da sesión inmediata. Por eso `RegisterScreen` guarda `pending_account_type`/`pending_org_name`/`pending_invite_code` en los metadatos del usuario — así `LoginScreen` puede retomar el onboarding (crear o unirse a organización) después de que el usuario confirme su correo y vuelva a entrar.
- **`organization_members` y `profiles` ya permiten ver a todo tu equipo, no solo tu propia fila** (`organization_members_select_org` / `profiles_select_org_members`, vía la función `my_organization_ids()`). Se habilitó para que el Semillero pueda evaluar skills/idiomas/badges de todos los miembros al sugerir equipo. El Dashboard todavía no usa esto para mostrar conteo real de miembros, pero ya podría (antes daba 1 siempre con `organization_members_select_own`).
- **Nunca poner la `secret`/`service_role` key de Supabase en `.env`** (solo la `anon`/`publishable`, que va al cliente). Ya pasó una vez en este proyecto.
- **`AGENTS.md` dice Expo SDK 56, pero lo instalado es SDK 54** (`~54.0.0` en `package.json`/`app.json`). Si hace falta consultar docs versionadas de Expo, usar v54, no v56.
- **Las políticas de Postgres (`create policy`) no son idempotentes** (no existe `if not exists` para políticas). Por eso `schema.sql` hace `drop policy if exists "..." on tabla;` antes de cada `create policy` — así es seguro re-correr el archivo completo cada vez que se le agrega algo, en vez de tener que copiar solo el bloque nuevo.
- **`assets/images/avatares/` se ha vaciado solo más de una vez** (parece un problema de sincronización de OneDrive, no de git — la carpeta ni siquiera está trackeada). `src/lib/profiles.ts` hace `require()` estático de cada archivo en `DEFAULT_AVATARS`; si falta uno solo, Metro no arma el bundle y **toda la app queda en blanco** (no solo la pantalla de perfil). Si la app se ve en blanco sin razón aparente, revisar esta carpeta antes que nada.
- **En web, `height: "100vh"` en la pantalla raíz NO es suficiente para acotar un layout con footer fijo (composer/sticky bar).** El wrapper de pantalla interno de `@react-navigation/stack` tiene `min-height: 100%` pero **no** `flex: 1`, así que crece con el contenido en vez de quedar acotado al viewport — un `ScrollView` interno con contenido largo puede empujar todo hacia abajo sin que haya forma de hacer scroll (le pasó a `SemilleroScreen`). La solución que funciona es anclar la pantalla directo al viewport con `position: "fixed", top:0, left:0, right:0, bottom:0` (solo en web; en nativo `flex:1` normal). Ver `rootStyle` en `SemilleroScreen.tsx`.
- **`Alert.alert()` de React Native es un no-op completo en web** (`react-native-web/src/exports/Alert/index.js` literalmente no hace nada — ni diálogo ni callbacks). Nunca usarlo para confirmaciones que deban funcionar en el navegador (ej. "¿borrar esto?"); usar un estado local + UI inline (o modal propio) que funcione igual en los 3 targets. Ver el patrón de confirmación de borrado en `SemilleroScreen.tsx`.

## Jerarquía y roles (visión objetivo, no implementada aún)
- **Jerarquía objetivo:** Workspace → Proyecto → Equipo → Task/Issue → Reportes
- **Roles objetivo:** `admin` (workspace), `team_leader`, `member`, `client`
- **Hoy solo existe:** Organización → miembros con rol `owner`/`member`. Todo lo demás de la jerarquía es roadmap.

## Diferenciadores clave (visión de producto, no perder de vista al implementar)
- **Semillero IA:** admin escribe una idea → IA analiza perfiles reales del workspace → arma equipo ideal + roadmap + primeras tareas. *(Implementado como chat con Groq vía Edge Function — ver "Estado actual" arriba. "Crear proyecto" ya crea el proyecto + equipo real. Pendiente: que los "primeros pasos" se conviertan en tasks reales, no solo texto guardado en `projects.first_steps`.)*
- **Perfiles tipo LinkedIn** con habilidades y nivel de experiencia (alimentan al Semillero IA). *(Implementado: mote, bio, avatar/foto, color, zona horaria, rol, idiomas con nivel CEFR, habilidades con nivel 1-10 — ver `ProfileEditorForm.tsx`. Falta que el Semillero realmente los use.)*
- **Badges** discretos, gestionados por team leaders/admins con sugerencias de IA. *(Columna `profiles.badges` y sección de solo lectura en `ProfileScreen` ya existen; falta el mecanismo de quién los otorga.)*
- **Workspaces con marca propia:** logo, color primario/secundario, modo claro/oscuro por workspace. *(Implementado: nombre/color/logo por organización vía `WorkspaceSetupScreen` y su `ColorPickerModal`.)*
- **Client Room:** vista curada para clientes externos, construida por el admin. *(Hoy: tile "Clientes" informativo en el Dashboard, sin pantalla propia todavía.)*
- **Chat/comentarios** en cada task, issue, equipo y proyecto (archivos, fotos, links). *(No implementado — no hay tasks/issues todavía.)*
- **Múltiples vistas:** Kanban, Lista, Timeline/Gantt, Dashboard (con switch). *(No implementado.)*
- **Reportes automáticos con IA** en lenguaje natural. *(No implementado.)*

## Stack técnico
| Capa | Tecnología | Estado |
|---|---|---|
| Frontend | Expo SDK 54 + React Native (iOS, Android, Web — un solo código, `react-native-web`) | ✅ en uso |
| Navegación | React Navigation (`@react-navigation/stack` en `App.tsx` raíz + `@react-navigation/bottom-tabs` custom en `BottomTabs.tsx`) | ✅ en uso |
| Base de datos (dev) | Supabase Cloud | ✅ en uso (`profiles`/`organizations`/`organization_members` + Storage `avatars`) |
| Base de datos (prod) | Supabase self-hosted en Docker (en el Pi) | ⏳ roadmap, no empezado |
| IA (dev) | Groq API (`llama-3.3-70b-versatile` por defecto, configurable con el secreto `GROQ_MODEL`) vía Edge Function `semillero-chat` | ✅ en uso (solo Semillero) |
| IA (prod) | Ollama con Mistral 7B o Llama 3.2, local en el Pi 5 | ⏳ roadmap, no empezado |
| Infra (prod) | Raspberry Pi 5 8GB + Cloudflare Tunnel | ⏳ roadmap, no empezado |
| Repo | `github.com/Styveensoon/Nexus` — ramas `main` y `dev` | ✅ |

### Decisiones de arquitectura (contexto, no las cuestiones sin razón)
- **PostgreSQL con JSONB en vez de NoSQL:** da flexibilidad tipo NoSQL + Row Level Security nativo para aislar workspaces + Realtime para chat sin config extra + Storage para archivos.
- **Ollama nunca en Docker en producción:** necesita acceso directo al hardware del Pi. Se instala directo en el SO.
- **Supabase self-hosted sí va en Docker** en producción.

## Modelo de negocio (para priorizar features)
- **Plan Cloud:** startups/universidades, Groq/Claude en nube, suscripción mensual.
- **Plan Enterprise Self-Hosted:** corporativos, Ollama en su propio servidor, licencia anual 5-10x más cara. Este plan es el que justifica todo el trabajo de self-hosting.

## Base de datos — esquema real hoy
Fuente de verdad: `supabase/schema.sql`. Correr ahí, no adivinar.

- **`profiles`** (`id` → `auth.users.id`, `full_name`, `email`, `created_at`, se crea sola vía trigger `handle_new_user` al registrarse) + columnas de perfil: `avatar_url` (`null` | `"default:<archivo>.png"` | URL subida), `avatar_color`, `nickname`, `bio`, `timezone`, `role`, `custom_role`, `skills` (`text[]`), `skill_levels` (`jsonb`, `{nombre: 1-10}`), `languages` (`text[]`), `language_levels` (`jsonb`, `{nombre: "A1"-"C2"}`), `badges` (`jsonb`, `[{id,name,color}]`, no editable desde el cliente).
- **`organizations`** (`id`, `name`, `color`, `logo_url`, `invite_code` único, `owner_id`, `created_at`).
- **`organization_members`** (`id`, `organization_id`, `user_id`, `role` `'owner'|'member'`, `created_at`, único por `(organization_id, user_id)`).
- **`semillero_chats`** (`id`, `organization_id`, `user_id`, `title`, `created_at`, `updated_at`) — un chat de ideación por hilo, solo lo puede crear el owner de la organización.
- **`semillero_messages`** (`id`, `chat_id`, `role` `'user'|'assistant'`, `content`, `team_suggestion` `jsonb | null`, `created_at`) — `team_suggestion` guarda `{projectName, leader, team[], firstSteps[]}` cuando la IA ya sugirió equipo.
- **`projects`** (`id`, `organization_id`, `name`, `description`, `color`, `status` `'planning'|'active'|'on_hold'|'completed'`, `leader_id`, `first_steps` `text[]`, `created_by`, `created_at`) — creado a mano o desde una `team_suggestion` del Semillero.
- **`project_members`** (`id`, `project_id`, `user_id`, `role_in_team`, `created_at`, único por `(project_id, user_id)`) — incluye al líder (con `role_in_team = 'Líder'`) y al resto del equipo.
- **Storage bucket `avatars`** (público): fotos de perfil subidas, una carpeta por `user_id`. Políticas: lectura pública, escritura solo en la carpeta propia.
- RLS activo en todas las tablas. `organization_members`/`profiles` permiten ver a todo tu equipo vía `my_organization_ids()` (ver trampa arriba); `semillero_*` dejan ver/insertar/actualizar/borrar lo propio (incluye `delete` en `semillero_messages`, necesario para "Regenerar respuesta"), y el insert de `semillero_chats` además verifica que seas el owner de esa organización. `projects`/`project_members` siguen el mismo criterio owner-gated para insert/update/delete (cualquier miembro de la organización puede hacer select).

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
- Correr el contenido de `supabase/schema.sql` en el SQL Editor del proyecto de Supabase.
- `npx expo start --web` (o sin `--web` para nativo/Expo Go). Usar `-c` después de cambiar `.env` para limpiar caché.
- Para que el Semillero funcione, además: instalar el [Supabase CLI](https://supabase.com/docs/guides/cli), `supabase login`, `supabase link --project-ref <tu-project-ref>`, luego `supabase functions deploy semillero-chat` y `supabase secrets set GROQ_API_KEY=tu-key` (conseguir la key en [console.groq.com](https://console.groq.com)). Sin esto desplegado, el chat del Semillero muestra el error honesto "No se pudo conectar con la IA" en vez de fallar en silencio.
- Para probar el Semillero con un roster variado (roles, skills, idiomas, husos horarios distintos a propósito, varios hablantes de árabe en husos distintos para probar el trade-off idioma-vs-huso), correr `supabase/seed_users.sql` en el SQL Editor (hay que poner tu invite_code, instrucciones dentro del archivo). Crea usuarios falsos directo en `auth.users` — no sirven para iniciar sesión de verdad, son solo roster de prueba. Tiene un `DELETE` comentado al final para limpiar todo después.

## Setup de producción (Pi 5) — roadmap, no empezado
- Ollama instalado directo en el SO del Pi (Windows/Linux) — nunca en Docker
- Supabase self-hosted en Docker
- Cloudflare Tunnel para exponer el Pi con HTTPS sin abrir puertos
- Deploy vía SSH + FileZilla

## Convenciones de trabajo
- Priorizar RLS (Row Level Security) en cualquier query o tabla nueva — el aislamiento por organización es requisito de seguridad, no opcional.
- Al tocar código de IA, tener en cuenta que dev usa Groq (`llama-3.3-70b-versatile`, no Mixtral — Groq lo descontinuó) y prod usaría Ollama/Mistral-Llama — no asumir que el prompt/formato de respuesta es idéntico entre ambos sin probar. El parseo del bloque `<<<TEAM>>>...<<<END_TEAM>>>` en `supabase/functions/semillero-chat/index.ts` es específico del prompt actual; si se cambia de modelo o proveedor, probar que el modelo nuevo sigue respetando ese formato.
- Componentes deben funcionar en los 3 targets (iOS, Android, Web) salvo que se indique lo contrario explícitamente.
- Preferir archivos completos al proponer cambios, no snippets parciales.
- Antes de tocar esquema de base de datos, confirmar impacto en RLS policies existentes.

## Estado actual / foco
**Última actualización:** rediseñé `ProjectsScreen` por completo (antes era 100% mock: datos inventados, stats falsas, `@expo/vector-icons`) y le puse backend real: tablas `projects`/`project_members` (RLS owner-gated para insert/update/delete, select abierto a toda la organización), `src/lib/projects.ts` con el CRUD, búsqueda/filtro por status funcionales y stats calculadas de datos reales (nunca inventadas). El botón "Crear proyecto" del Semillero ya no solo navega: llama a `createProjectFromSuggestion` y crea el proyecto + `project_members` (líder + equipo) a partir del `team_suggestion` guardado, con manejo de error honesto por mensaje si falla. **Falta correr la migración nueva de `schema.sql` en el SQL Editor de Supabase** (las tablas no existen todavía en la base remota).

Antes de eso conecté el Semillero a IA real y lo pulí a partir de pruebas reales con un roster de 26 usuarios de prueba (`supabase/seed_users.sql`). `SemilleroScreen` es un chat (panel lateral de ideas/hilos guardados a la izquierda, mensajes a la derecha, responsive con drawer en móvil) respaldado por `semillero_chats`/`semillero_messages` y la Edge Function `supabase/functions/semillero-chat`, que llama a Groq usando el roster real de la organización (skills, idiomas, zona horaria, badges de `profiles`) para sugerir equipo + líder + primeros pasos, evitando husos horarios incompatibles cuando hay alternativas. Gestión de chats completa: renombrar, borrar (con confirmación), regenerar la última respuesta. Para que eso fuera posible, `organization_members` y `profiles` pasaron de "solo ves tu propia fila" a "ves a todo tu equipo" (políticas `*_select_org`, función `my_organization_ids()`). Acceso restringido al owner de la organización (RLS + chequeo en la función).

Bugs reales encontrados y corregidos durante las pruebas del Semillero (documentados como trampas arriba, para no repetirlos): (1) `height:"100vh"` no bastaba para acotar el chat al viewport en web por cómo se comporta el wrapper de `@react-navigation/stack` — se resolvió con `position:"fixed"`; (2) las burbujas de chat no distinguían usuario/asistente por posición (bug de flexbox, `alignSelf` fijo); (3) la IA a veces mencionaba el `userId` (uuid interno) en el texto conversacional — se corrigió el prompt; (4) `Alert.alert()` no hace nada en web, así que la confirmación de borrado se rehízo como UI inline.

Pendiente: construir la vista de miembro no-admin del Dashboard, definir quién asigna badges, pantalla de detalle de proyecto (hoy solo hay lista), y las pestañas de Tasks/Calendar/Team siguen con datos de ejemplo (mock) sin tocar.
