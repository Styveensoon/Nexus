# Módulo de Clientes — Especificación

Diferenciador de Nexus: portal aislado por cliente, con equipo humano asignado, chat persistente y generación de contenido asistida por IA en base a datos reales del proyecto.

---

## 1. Registro y código de cliente

- [x] Al crear cuenta, el usuario elige (switch/selector) entre:
  - "Pertenezco a una organización" → se une con **código de organización** (ya existente).
  - "Soy cliente" → se une con **código de cliente** (nuevo).
- [x] El código de cliente es **general** (no único por cliente), similar al código de organización: identifica el *rol* con el que se une, no a un cliente específico.
- [x] Al unirse como cliente, el usuario personaliza su perfil (nombre, foto, etc.) para identificarse.
- [x] Al registrarse, se le informa/solicita consentimiento de que su información podrá usarse para mejora de la plataforma / analítica (dejar esto explícito por temas de privacidad).

## 2. Cuenta multi-organización (un solo login, varios espacios)

- [x] Un mismo usuario puede pertenecer a **más de una organización** (como cliente, como empleado, o ambos) con una sola cuenta.
- [x] En **Ajustes**, opción para **"Agregar organización"**: se introduce un nuevo código (de organización o de cliente) y se genera un **espacio adicional** dentro de la misma cuenta.
- [x] Dado que al registrarse ya se sabe que el usuario es cliente, mostrar en Home/Ajustes un banner/botón con leyenda tipo:
  > "¿Tienes más de un proyecto en Nexus? Agrégalo aquí"
- [x] El usuario cambia entre espacios (organización A, organización B, cliente de organización C, etc.) sin necesidad de otra cuenta.

## 3. Habitación aislada del cliente ("home" del cliente)

- [x] Al unirse, el cliente entra a un espacio **completamente aislado** del resto de la plataforma (no ve nada de la organización salvo lo que su equipo asignado le habilite).
- [x] Estado inicial: home vacío, pero con una **bienvenida acogedora** (mensaje de bienvenida + logo de la organización a la que se une). Priorizar la parte humana/cálida sobre el contenido funcional en este estado inicial.
- [x] El espacio del cliente **nunca se borra ni se archiva**, aunque el proyecto termine o la relación comercial finalice:
  - Sirve como histórico consultable por el cliente en cualquier momento.
  - Sirve como fuente de datos para analítica / data mining / entrenamiento de modelos a futuro.
  - Refuerza que el vínculo del cliente es con la **plataforma (Nexus)**, no necesariamente con la organización que lo atendió.

## 4. Equipo asignado al cliente

- [x] El owner de la organización designa una **persona o equipo** encargado de atender a cada cliente.
- [x] Modelo de permisos: **todos los miembros del equipo asignado pueden hacer de todo** sobre el espacio de ese cliente (sin permisos granulares). La responsabilidad/trazabilidad se resuelve vía el **log de actividad** (quién hizo qué y cuándo), no restringiendo permisos.
- [x] Si el equipo/persona asignada cambia (reasignación), el **historial completo permanece intacto** y ligado al cliente, no a la persona:
  - El chat es persistente y vive para siempre, sin importar cuántas veces cambie el equipo asignado.
  - Los archivos, links y mensajes intercambiados también permanecen.

## 5. Comunicación con el cliente

- [x] Chat directo entre el equipo asignado y el cliente (reutiliza el sistema de chat que ya existe en tareas — "vive ahí eternamente").
- [x] Soporta intercambio de archivos, imágenes y links, además de mensajes de texto.
- [x] El cliente puede **reaccionar y responder a comentarios** (no solo mirar pasivamente).

## 6. Construcción del home del cliente (secciones)

- [x] El equipo asignado arma el home del cliente **a la medida**, agregando secciones (ej. Dashboard, Reports, etc.) — no es 100% automático por IA, el equipo decide la estructura. (Implementado como catálogo de 5 tipos de "widget" en vez de solo "Dashboard" — ver `ClientHomeBuilderScreen.tsx` y el "Plan de implementación" más abajo.)
- [x] Al agregar una sección tipo **Dashboard**:
  1. El equipo selecciona sobre qué **proyecto(s)** se basará (ej. "Rediseño de marca"). Debe soportar **selección múltiple** de proyectos y equipos como fuente de datos (un cliente puede tener más de un proyecto con el tiempo).
  2. La IA (ya existente en la plataforma, no requiere hosting/infra nueva) genera el contenido de la sección en base a esos datos reales: tareas completadas, urgencia, tiempos, etc.
  3. Campo de **"prompt de comportamiento extra"** por sección — para ajustar tono/enfoque de la IA (ej. "tono formal", "resumen ejecutivo", "no mencionar tareas bloqueadas").
- [x] El dashboard se **regenera** con datos frescos (no es una foto fija) — se actualiza conforme cambian los datos del proyecto. (Regeneración siempre MANUAL, un botón del staff — nunca automática/en segundo plano.)
- [ ] **Biblioteca de prompts reutilizables**: guardar los prompts de comportamiento más usados como plantillas, para no reescribirlos cada vez que se arma una sección nueva. (Pendiente — ver `docs/ESTADO.md`, prioridad baja confirmada.)

## 7. Documentos y presentaciones bajo demanda

- [x] A diferencia del dashboard (automático/vivo), los **PDFs, documentos y presentaciones** el cliente los **solicita** — no se generan solos. (El contenido vive dentro de la plataforma, ver `client_documents` — no hay generación de PDF real todavía.)
- [x] El equipo genera el documento en minutos usando IA cuando el cliente lo pide, y puede **regenerarse** cuando haga falta (no es una versión única y estática).
- [x] Esto da control de calidad humano antes de entregarle al cliente algo formal. (El staff siempre revisa/confirma título y fuente antes de generar, vía `ClientDocumentGenerateModal.tsx`.)

## 8. Apartado de solicitudes

- [x] Nueva sección **"Solicitudes"** dentro del espacio del cliente.
- [x] El cliente solicita ahí lo que necesite (documento, presentación, reporte custom, etc.).
- [x] Al crear una solicitud, se notifica **por email a todos los encargados** (todo el equipo asignado al cliente), no solo a uno — evita que una solicitud se quede sin atender por asumir que "alguien más la toma".
- [x] La solicitud también queda visible **dentro de la plataforma** (no solo en el email), para que quede historial y trazabilidad.

## 9. Aprobaciones

- [x] Sistema de aprobación para entregables: el cliente puede **aprobar o rechazar** algo mostrado en su espacio (ej. un diseño, un entregable). (Widget `DeliverablesWidget` en el Home, no un tab propio.)
- [x] Una aprobación o comentario del cliente puede **retroalimentar el flujo de trabajo interno** (ej. dispara notificación o siguiente tarea para el equipo) — el cliente no solo mira, empuja el proceso. (Notifica por email a todo el staff actual al decidir, `notifyStaffDeliverableDecided`.)

---

## Notas de alcance (dado el tiempo disponible)

**Puntos 1-6 ya cerrados** (ver `docs/ESTADO.md`, changelog "Home con widgets" y rondas anteriores) — queda como referencia histórica de qué se priorizó y por qué. Solo el punto 7 (biblioteca de prompts) sigue pendiente a propósito.

Prioridad sugerida para un MVP funcional, de mayor a menor urgencia:

1. Código de cliente + switch en registro + habitación aislada + chat persistente.
2. Equipo asignado al cliente + sección de home básica armada manualmente (sin IA todavía).
3. Apartado de solicitudes + notificación por email a encargados.
4. Dashboard generado por IA en base a datos reales + prompt de comportamiento.
5. Sistema de aprobaciones/reacciones.
6. Multi-organización (agregar espacio extra desde Ajustes).
7. Biblioteca de prompts reutilizables, exportar a PDF, línea de tiempo de hitos (mejoras post-entrega, no núcleo).

## Pendiente de definir (no bloqueante para arrancar)

- Política de privacidad/consentimiento formal para uso de datos del cliente en analítica o entrenamiento de modelos.
- Límite de tamaño de archivos compartidos en el chat.
- Biblioteca de prompts reutilizables (§6, último punto) — confirmado con el usuario que queda fuera de esta ronda, se evalúa después.

---

## Plan de implementación — Home con widgets (§6/§7/§9), decidido con el usuario 2026-07-23

Decisiones ya cerradas con el usuario (no volver a preguntar):
1. **Chat y Solicitudes siguen siendo tabs propios, intactos, con toda su función actual.** El Home (`ClientHomeScreen`) es el único que se vuelve un tablero armable. Los widgets "Resumen de Chat"/"Resumen de Solicitudes" son solo teasers con link al tab completo — nunca reemplazan esos tabs ni duplican su lógica de escritura.
2. **Fuente de datos de Dashboard/Tu Proyecto: proyectos Y equipos**, selección múltiple de ambos. Un equipo aporta datos vía `tasks.assigned_team_id` (tasks asignadas directo a ese equipo, en cualquier proyecto de la organización — no solo vía `project_teams`), un proyecto vía `tasks.project_id`. Deduplicar si una task ya se contó por proyecto y también matchea por equipo.
3. **Alcance: todo junto** — Home con widgets + Documentos bajo demanda (§7) + Entregables/aprobaciones (§9) en la misma ronda.
4. **Notificar por email al cliente** cuando un documento queda listo o hay un entregable nuevo para aprobar (reusa el SMTP ya configurado, `docs/EMAILS.md`). No se notifica cada regeneración del Dashboard (sería ruido). Además, siguiendo el propio §9 ("una decisión del cliente retroalimenta el flujo interno"), se notifica **al staff** cuando el cliente aprueba/rechaza un entregable — reusa `getStaffUserIdsForClient` (ya existe en `lib/clients.ts`).

Decisión técnica propia (no es una pregunta de producto): **las métricas numéricas del Dashboard (tasks completadas/vencidas/% avance) se calculan en TypeScript, nunca se le piden a la IA** — a Groq solo se le pide el resumen narrativo (`summary`) y los `highlights`, ya con los números reales inyectados en el prompt. Evita alucinar cifras (filosofía anti-fake, `docs/PATRONES.md`).

### 1. Widgets del Home (`client_home_sections`, ampliar `type`)

`type` pasa de solo `'dashboard'` a 5 valores (constraint drop+add, patrón ya usado en `tasks_status_check`):

| `type` | `config` (jsonb) | `generated_content` | Quién lo arma |
|---|---|---|---|
| `dashboard` | `{ projectIds: string[], teamIds: string[], extraPrompt: string }` | `{ summary, highlights: string[], metrics: {tasksTotal, tasksCompleted, tasksInProgress, tasksOverdue, progressPercent} }` — `metrics` calculado en TS, `summary`/`highlights` por IA | Staff elige fuente + prompt extra, botón manual "Generar"/"Regenerar" (nunca automático) |
| `project_overview` | `{ projectIds: string[], teamIds: string[] }` | *(no usa, siempre en vivo)* | Staff elige fuente. Ficha 100% de datos reales, sin IA: ícono/color/status/avance/próxima fecha límite por cada proyecto |
| `requests_summary` | `{}` | *(no usa)* | Sin configuración — siempre las solicitudes de ESE cliente. Conteo por estado + últimas 3 + link al tab Solicitudes |
| `chat_preview` | `{}` | *(no usa)* | Sin configuración. Últimos mensajes + link al tab Chat |
| `deliverables` | `{}` | *(no usa)* | Sin configuración. Lista de entregables de ese cliente; el cliente aprueba/rechaza desde acá mismo |

`position` (ya existe) ordena el despliegue — reordenar con flechas subir/bajar (swap simple de `position` con el vecino), no drag-and-drop.

Estado vacío: si un cliente no tiene ninguna sección todavía, `ClientHomeScreen` sigue mostrando la bienvenida cálida actual tal cual está — no se toca ese camino.

### 2. Documentos bajo demanda (`client_documents`, §7)

Cambio de schema chico: agregar columna `source jsonb not null default '{}'::jsonb` a `client_documents` — guarda `{projectIds, teamIds}` elegidos al generar (o regenerar) ese documento puntual, ya que no hay una relación estructural cliente↔proyecto en el schema (el módulo de Clientes es deliberadamente paralelo, ver `docs/BASE_DE_DATOS.md`) y el staff debe poder elegir la fuente cada vez.

Flujo: el cliente pide algo por Solicitudes (ya funciona). El staff, dentro de esa solicitud en `ClientDetailScreen`, tiene un botón "Generar documento con IA" → modal (título + fuente proyectos/equipos + prompt extra) → Edge Function nueva devuelve el contenido → se persiste en `client_documents` con `request_id` ligado → notifica por email al cliente. El cliente lo ve dentro de la tarjeta de esa misma solicitud en `ClientRequestsScreen` (no un tab nuevo). Regenerar reusa el mismo flujo, mismo `request_id`.

### 3. Entregables/aprobaciones (`client_deliverables`, §9)

Sin cambios de schema (la tabla y el trigger `enforce_client_deliverable_update` ya existen). Falta 100% la UI:
- Staff (desde `ClientDetailScreen`, sección nueva "Entregables"): crear (título + contenido + adjunto opcional vía `uploadClientAttachment`), editar mientras siga `pending` — el trigger ya impide tocar nada una vez decidido.
- Cliente (widget `deliverables` en el Home): ve sus entregables, aprueba/rechaza los `pending` con confirmación inline (nunca `Alert.alert`). Al decidir, notifica al staff.

### 4. Edge Functions nuevas

Dos funciones, mismo patrón que `badge-suggestions` (una sola llamada, no persisten solas — el cliente hace el `update`/`insert` final tras recibir la respuesta):
- **`client-dashboard-generate`**: input `{ organizationId, clientUserId, sectionId }`. Verifica staff (chequeo manual en TS: owner o asignación activa — mismo criterio que `client_space_is_staff`, reimplementado porque la función corre con service role y no hay `auth.uid()` de sesión disponible en ese contexto), lee `config` de la sección, junta tasks de proyectos+equipos elegidos, calcula métricas en TS, arma prompt con Groq pidiendo solo `{summary, highlights}`, devuelve `{summary, highlights, metrics}` combinado.
- **`client-document-generate`**: input `{ organizationId, clientUserId, projectIds, teamIds, extraPrompt, title }`. Mismo chequeo de staff, mismo contexto de datos, prompt pidiendo un documento estructurado más largo (secciones), devuelve el contenido para que el cliente lo persista en `client_documents`.

Compartir entre ambas: `supabase/functions/_shared/client_ai_context.ts` (nuevo) — `verifyClientStaffAccess()` + `buildProjectTeamMetrics()`.

### 5. Capa de datos nueva (`src/lib`)

- `clientHome.ts`: CRUD de `client_home_sections` (list/create/update config/delete/reorder) + `generateDashboardContent()` (invoca la Edge Function y persiste el resultado).
- `clientDocuments.ts`: list por cliente/por request, `generateDocument()` (invoca + persiste + notifica).
- `clientDeliverables.ts`: list, create/update (staff), `decide()` (cliente aprueba/rechaza + notifica staff).
- `emails.ts` + `_shared/email_templates.ts`: 3 templates nuevos — `client_document_ready`, `client_deliverable_created`, `client_deliverable_decided` (este último al staff).
- `clientActivity.ts`: ya tiene todas las acciones necesarias en el enum (`document_created`/`_regenerated`, `deliverable_created`/`_approved`/`_rejected`, `home_section_created`/`_regenerated`) — solo hace falta llamarlas desde el código nuevo.

### 6. UI nueva

- `src/screens/ClientHomeBuilderScreen.tsx` (staff, se llega desde un botón en `ClientDetailScreen`): lista de widgets actuales + agregar (picker de tipo) + configurar fuente (picker multi-select proyectos/equipos, reusado también por Documentos) + flechas reordenar + borrar.
- `src/components/client-widgets/`: `DashboardWidget.tsx`, `ProjectOverviewWidget.tsx`, `RequestsSummaryWidget.tsx`, `ChatPreviewWidget.tsx`, `DeliverablesWidget.tsx` — self-contained (fetch propio, patrón `ProfileEditorForm`), cada uno resuelve sus propios datos según su `type`/`config`.
- `ClientHomeScreen.tsx`: reescrita para listar los widgets de la sección si existen, o mantener la bienvenida vacía si no hay ninguno.
- `ClientDetailScreen.tsx`: + botón "Armar home", + sección "Documentos" dentro de cada solicitud (generar/regenerar), + sección "Entregables" (crear/editar).
- `ClientRequestsScreen.tsx`: mostrar el documento generado (si existe) dentro de la tarjeta de esa solicitud.

### Orden de implementación (fases, verificar antes de seguir a la próxima)

1. Schema (`schema.sql`): constraint de `client_home_sections.type` ampliado + columna `client_documents.source`.
2. Edge Functions + `_shared/client_ai_context.ts`.
3. Capa de datos (`lib/clientHome.ts`, `lib/clientDocuments.ts`, `lib/clientDeliverables.ts`, emails/templates nuevos).
4. UI lado staff (`ClientHomeBuilderScreen`, ampliar `ClientDetailScreen`).
5. UI lado cliente (widgets, `ClientHomeScreen` reescrita, ampliar `ClientRequestsScreen`).
6. Verificación (`tsc --noEmit`) + actualizar `docs/ESTADO.md`/`docs/BASE_DE_DATOS.md`/`docs/PATRONES.md` + marcar checkboxes de §6/§7/§9 arriba.
