# Arquitectura, visión de producto y stack

## Jerarquía y roles (visión objetivo, no implementada aún)
- **Jerarquía objetivo:** Workspace → Proyecto → Equipo → Task/Issue → Reportes
- **Roles objetivo:** `admin` (workspace), `team_leader`, `member`, `client`
- **Hoy solo existe:** Organización → miembros con rol `owner`/`member`, más un "líder" por proyecto (`projects.leader_id`) y un "encargado" por equipo (`teams.leader_id`). Todo lo demás de la jerarquía es roadmap.

## Diferenciadores clave (visión de producto, no perder de vista al implementar)
- **Semillero IA:** admin escribe una idea → IA analiza perfiles reales del workspace → arma equipo ideal + roadmap + primeras tareas. *(Implementado como chat con Groq vía Edge Function — ver `docs/ESTADO.md`. "Crear proyecto" y "Crear equipo" ya crean el registro real correspondiente. Pendiente: que los "primeros pasos" se conviertan en tasks reales, no solo texto guardado en `projects.first_steps`.)*
- **Perfiles tipo LinkedIn** con habilidades y nivel de experiencia (alimentan al Semillero IA). *(Implementado: mote, bio, avatar/foto, color, zona horaria, rol, idiomas con nivel CEFR, habilidades con nivel 1-10 — ver `ProfileEditorForm.tsx`. Falta que el Semillero realmente los use.)*
- **Badges** discretos, gestionados por team leaders/admins con sugerencias de IA. *(Columna `profiles.badges` y sección de solo lectura en `ProfileScreen` ya existen; falta el mecanismo de quién los otorga.)*
- **Workspaces con marca propia:** logo, color primario/secundario, modo claro/oscuro por workspace. *(Implementado: nombre/color/logo por organización vía `WorkspaceSetupScreen` y su `ColorPickerModal`.)*
- **Client Room:** vista curada para clientes externos, construida por el admin. *(Hoy: tile "Clientes" informativo en el Dashboard, sin pantalla propia todavía.)*
- **Chat/comentarios** en cada task, issue, equipo y proyecto (archivos, fotos, links). *(Implementado para tasks: `task_comments` con texto, respuestas citadas, y adjuntos de imagen/archivo/link/fecha — ver `docs/ESTADO.md`. Pendiente para issues, equipos y proyectos.)*
- **Múltiples vistas:** Kanban, Lista, Timeline/Gantt, Dashboard (con switch). *(Implementado en su mayoría: Tasks tiene un switch real entre Kanban, Lista, Calendario (no estaba en la lista original pero cumple el mismo rol) y Gantt (con drag para mover/redimensionar fechas). Falta solo la variante "Dashboard" — una vista de stats agregadas, distinta del Dashboard/home de la organización.)*
- **Reportes automáticos con IA** en lenguaje natural. *(No implementado.)*

## Stack técnico
| Capa | Tecnología | Estado |
|---|---|---|
| Frontend | Expo SDK 54 + React Native (iOS, Android, Web — un solo código, `react-native-web`) | ✅ en uso |
| Navegación | React Navigation (`@react-navigation/stack` en `App.tsx` raíz + `@react-navigation/bottom-tabs` custom en `BottomTabs.tsx`) | ✅ en uso |
| Base de datos (dev) | Supabase Cloud | ✅ en uso (ver `docs/BASE_DE_DATOS.md`) |
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
