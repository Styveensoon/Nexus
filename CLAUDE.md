@AGENTS.md

# NEXUS — Contexto del proyecto

## Qué es
Plataforma de gestión de proyectos con IA local, self-hosted, multiplataforma (iOS, Android, Web) con un solo código en Expo + React Native.

**Diferenciador de negocio principal:** los datos nunca salen de la red del cliente. En producción, la IA correría 100% local vía Ollama en un Raspberry Pi 5 — sin esto no hay venta a empresas como T-Systems, bancos o gobierno. **Nota: esto es visión de producto, todavía no hay ninguna infraestructura de IA construida (ver "Estado actual" abajo).**

## Estado actual (leer esto antes de asumir que algo existe)
Lo real y funcional hoy:
- **Auth completo con Supabase:** registro, login, verificación de correo, sign out. Ver `src/context/AuthContext.tsx` (`useAuth()`) y `src/lib/supabase.ts`.
- **Organizaciones (= "workspace" de la visión, pero simplificado):** crear organización con nombre/color/logo personalizables, o unirse por código de invitación. Ver `src/lib/organizations.ts` y `supabase/schema.sql`.
- **Pantallas "premium" ya rediseñadas** (identidad visual consistente, ver sección de abajo): `LandingScreen`, `LoginScreen`, `RegisterScreen`, `WorkspaceSetupScreen`, `JoinWorkspaceScreen`, `SemilleroScreen`, `DashboardScreen`, `BottomTabs`.
- **Dashboard/home** rediseñado para la vista del admin/creador de la organización: fondo con el color de marca de la org, tarjeta con código de invitación, sección "El Semillero" (placeholder honesto, sin IA real todavía), tiles de Equipos/Badges/Clientes (informativos, sin backend), nav propia responsive (barra arriba en desktop ≥768px, abajo en móvil).

Lo que **NO** existe todavía, aunque el resto de este documento lo describa como visión:
- Ningún backend de IA (ni Groq ni Ollama conectados a nada).
- Tablas de `projects`, `tasks`, `issues`, `teams`, `comments` — **no existen en la base de datos.** Las únicas tablas reales son `profiles`, `organizations`, `organization_members`.
- Roles ricos (`team_leader`, `client`) — hoy `organization_members.role` solo es `'owner' | 'member'`.
- Las pestañas **Projects/Tasks/Calendar/Team/Profile siguen con datos de ejemplo (mock)**, usan `@expo/vector-icons` en vez de `lucide-react-native`, y no llaman a `useAuth()`. Redecidir/rediseñar cada una es trabajo pendiente, una por una.
- Nada de infraestructura de Raspberry Pi / Docker / Cloudflare Tunnel.

## Patrones de código ya establecidos (reusar, no reinventar)
- **Paleta local por pantalla** (no hay theme file compartido para las pantallas nuevas): cada componente calcula sus propios `bg`, `cardBg`, `border`, `textPrimary`, `textSecondary`, `primaryColor = "#2563EB"`, `inputBg` a partir de `isDark` (de `useTheme()`). Copiar el bloque tal cual de cualquier pantalla ya rediseñada en vez de crear una paleta nueva.
- **Sombra:** patrón `ultraShadow` vía `Platform.select({ web: { boxShadow, backdropFilter: "blur(12px)" }, default: { shadowColor/Offset/Opacity/Radius, elevation } })`.
- **Responsive:** `const isMobile = useWindowDimensions().width < 768` en cada pantalla — no hay breakpoints centralizados. Contenido en desktop va dentro de un contenedor `maxWidth` centrado (960–1280 según la pantalla).
- **Íconos:** `lucide-react-native` en todo lo nuevo/rediseñado. Las pantallas viejas sin rediseñar (Projects/Tasks/Calendar/Team/Profile) todavía usan `@expo/vector-icons` — no mezclar los dos sistemas al tocar una pantalla, migrar a lucide si se rediseña.
- **Botones primarios:** píldora (`borderRadius: 999`).
- **Filosofía anti-fake:** nunca simular que algo funciona cuando no hay backend. Si no hay feature real, se muestra un estado vacío honesto o un aviso tipo "esto estará disponible pronto" — nunca un spinner falso ni un botón que aparenta éxito. (Ver `SemilleroScreen.tsx` como ejemplo: el formulario es real, el submit no llama a nada, solo avisa.)

## Trampas conocidas (para no perder tiempo redescubriéndolas)
- **`src/navigation/AppNavigator.tsx` está muerto.** No compila (importa `@react-navigation/native-stack`, que no está instalado) y no se usa en ningún lado. El navegador raíz real es `App.tsx` (cargado vía `index.ts`), envuelto en `ThemeProvider > AuthProvider > NavigationContainer`. Si `tsc` marca un error ahí, es preexistente y se ignora.
- **Confirmación de correo activada en Supabase:** `signUp` no da sesión inmediata. Por eso `RegisterScreen` guarda `pending_account_type`/`pending_org_name`/`pending_invite_code` en los metadatos del usuario — así `LoginScreen` puede retomar el onboarding (crear o unirse a organización) después de que el usuario confirme su correo y vuelva a entrar.
- **RLS de `organization_members` solo deja ver la fila propia** (`organization_members_select_own`). Un `count()` de miembros del equipo siempre da 1 con esa política — por eso el Dashboard no muestra conteo real de miembros. Hay una política opcional ya escrita (comentada) al final de `supabase/schema.sql` para habilitarlo si se necesita.
- **Nunca poner la `secret`/`service_role` key de Supabase en `.env`** (solo la `anon`/`publishable`, que va al cliente). Ya pasó una vez en este proyecto.
- **`AGENTS.md` dice Expo SDK 56, pero lo instalado es SDK 54** (`~54.0.0` en `package.json`/`app.json`). Si hace falta consultar docs versionadas de Expo, usar v54, no v56.

## Jerarquía y roles (visión objetivo, no implementada aún)
- **Jerarquía objetivo:** Workspace → Proyecto → Equipo → Task/Issue → Reportes
- **Roles objetivo:** `admin` (workspace), `team_leader`, `member`, `client`
- **Hoy solo existe:** Organización → miembros con rol `owner`/`member`. Todo lo demás de la jerarquía es roadmap.

## Diferenciadores clave (visión de producto, no perder de vista al implementar)
- **Semillero IA:** admin escribe una idea → IA analiza perfiles reales del workspace → arma equipo ideal + roadmap + primeras tareas. *(Hoy: pantalla `SemilleroScreen` con formulario real y aviso de "próximamente", sin IA conectada.)*
- **Perfiles tipo LinkedIn** con habilidades y nivel de experiencia (alimentan al Semillero IA). *(No implementado.)*
- **Badges** discretos, gestionados por team leaders/admins con sugerencias de IA. *(Hoy: tile informativo en el Dashboard, sin backend.)*
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
| Base de datos (dev) | Supabase Cloud | ✅ en uso (solo `profiles`/`organizations`/`organization_members`) |
| Base de datos (prod) | Supabase self-hosted en Docker (en el Pi) | ⏳ roadmap, no empezado |
| IA (dev) | Groq API, modelo Mixtral | ⏳ roadmap, no conectado |
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

- **`profiles`** (`id` → `auth.users.id`, `full_name`, `email`, `created_at`) — se crea sola vía trigger `handle_new_user` al registrarse.
- **`organizations`** (`id`, `name`, `color`, `logo_url`, `invite_code` único, `owner_id`, `created_at`).
- **`organization_members`** (`id`, `organization_id`, `user_id`, `role` `'owner'|'member'`, `created_at`, único por `(organization_id, user_id)`).
- RLS activo en las tres tablas. Ver trampa de `organization_members_select_own` arriba.

## Variables de entorno (dev)
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=   # la "anon"/"publishable" key, NUNCA la "secret"/"service_role"
```
`GROQ_API_KEY` no aplica todavía (no hay integración de IA). Nunca hardcodear estas keys en el código ni loguearlas. Siempre `.env` (ya está en `.gitignore`; hay `.env.example` como plantilla).

## Setup de desarrollo
- Copiar `.env.example` a `.env` y completar con las credenciales del proyecto de Supabase (Project Settings → API).
- Correr el contenido de `supabase/schema.sql` en el SQL Editor del proyecto de Supabase.
- `npx expo start --web` (o sin `--web` para nativo/Expo Go). Usar `-c` después de cambiar `.env` para limpiar caché.

## Setup de producción (Pi 5) — roadmap, no empezado
- Ollama instalado directo en el SO del Pi (Windows/Linux) — nunca en Docker
- Supabase self-hosted en Docker
- Cloudflare Tunnel para exponer el Pi con HTTPS sin abrir puertos
- Deploy vía SSH + FileZilla

## Convenciones de trabajo
- Priorizar RLS (Row Level Security) en cualquier query o tabla nueva — el aislamiento por organización es requisito de seguridad, no opcional.
- Al tocar código de IA en el futuro, tener en cuenta que dev usaría Groq/Mixtral y prod Ollama/Mistral-Llama — no asumir que el prompt/formato de respuesta es idéntico entre ambos sin probar.
- Componentes deben funcionar en los 3 targets (iOS, Android, Web) salvo que se indique lo contrario explícitamente.
- Preferir archivos completos al proponer cambios, no snippets parciales.
- Antes de tocar esquema de base de datos, confirmar impacto en RLS policies existentes.

## Estado actual / foco
**Última actualización:** conecté el auth real con Supabase (registro, login, verificación de correo) y el flujo completo de onboarding: crear organización con personalización (nombre, color, logo vía picker propio) o unirse por código de invitación. Rediseñé el Dashboard/home para la vista del admin/creador de la organización (fondo con su color de marca, tarjeta de invitación, sección "El Semillero" como entrada placeholder a la futura IA, y navegación propia responsive — barra arriba en desktop, abajo en móvil). Pendiente: conectar el Semillero a IA real, construir la vista de miembro no-admin, y las pestañas de Projects/Tasks/Team/Profile siguen con datos de ejemplo (mock) sin tocar.
