# NEXUS — Catálogo completo de diferenciadores y funcionalidades

> Documento base para armar una presentación. No es un guion de pitch lineal: es un catálogo detallado, sección por sección, de cada diferenciador y cada función real del producto — qué hace, cómo funciona por dentro, y por qué importa. Cada `##`/`###` puede convertirse en una o varias slides. Todo lo listado está construido y funcionando de verdad (no mockups), probado en vivo con datos reales.

---

## 0. Qué es Nexus, en una frase

**Una plataforma de gestión de proyectos con IA integrada, diseñada para correr 100% dentro de la infraestructura del cliente — los datos nunca salen de su red.** Un solo código (Expo + React Native) para iOS, Android y Web.

---

## 1. Buque insignia: privacidad radical con IA 100% local

Este es el diferenciador que sostiene todo lo demás — sin él, Nexus es "una herramienta de gestión más".

### Cómo funciona
- **En producción**, la IA no llama a ninguna API externa: corre **Ollama** (Mistral 7B o Llama 3.2) instalado **directo en el sistema operativo** de un Raspberry Pi 5 de 8GB — nunca en Docker, porque necesita acceso directo al hardware.
- El resto de la infraestructura (Supabase self-hosted: Postgres + Auth + Storage + Realtime) sí corre en **Docker** sobre ese mismo Pi.
- **Cloudflare Tunnel** expone el servicio con HTTPS real sin abrir ni un puerto del router del cliente — el Pi puede vivir detrás de cualquier NAT corporativo.
- En **desarrollo**, se usa Groq (`llama-3.3-70b-versatile`) en la nube — deliberadamente separado y documentado como "solo para construir", nunca como el modelo de producción. El prompt y el formato de respuesta se prueban explícitamente contra el modelo real antes de dar una feature de IA por cerrada, porque no hay garantía de que Groq y Ollama respeten el mismo formato de bloques estructurados (`<<<TEAM>>>`, `<<<ACTION>>>`, etc.).

### Por qué importa de verdad (no es solo marketing)
- **0% de los datos del cliente pasan por manos de terceros** en el modelo de producción — ni el texto de una tarea, ni un comentario, ni el nombre de un cliente externo.
- Esto no es una promesa de política de privacidad: es una decisión de arquitectura verificable. Cualquier competidor SaaS puede *prometer* que cuida tus datos; Nexus puede *demostrarlo* apuntando al servidor físico donde corren.
- Abre la puerta a sectores que hoy ni evalúan herramientas cloud-only: banca, gobierno, salud, legal — cualquiera con requisitos de compliance que hacen del self-hosting un filtro de entrada, no una preferencia.

### Cómo se refleja en el modelo de negocio
| Plan | Para quién | IA | Precio |
|---|---|---|---|
| **Cloud** | Startups, universidades | En la nube (Groq/Claude) | Suscripción mensual |
| **Enterprise Self-Hosted** | Corporativos, banca, gobierno | Ollama en su propio servidor | Licencia anual, **5-10x más cara** |

El plan Enterprise **es** el producto que justifica todo el esfuerzo de ingeniería — no es un upsell, es la razón de ser del proyecto.

---

## 2. Inteligencia Artificial — 6 funciones reales, no un chatbot genérico pegado encima

Cada una resuelve un problema puntual de gestión de equipos, y todas comparten dos reglas de diseño no negociables:
1. **Las métricas numéricas siempre se calculan en código (TypeScript/SQL), nunca se le piden inventadas a la IA** — la IA solo redacta, compara y sugiere sobre datos ya verificados.
2. **Nunca se confía ciegamente en lo que la IA devuelve** — todo lo que la IA propone se revalida server-side contra los permisos reales antes de mostrarse o aplicarse.

### 2.1 — El Semillero (arranque de proyectos)
- El owner de la organización describe una idea en un chat.
- La IA (Groq/Ollama vía la Edge Function `semillero-chat`) hace preguntas para pulirla y, cuando tiene contexto suficiente, sugiere **equipo + líder + primeros pasos**.
- La sugerencia usa el **roster real** de la organización: skills, idiomas y **zona horaria** — evita armar equipos con husos horarios incompatibles cuando hay alternativas mejores.
- La sugerencia se persiste estructurada (no hay que volver a llamar a la IA al reabrir el chat) y tiene dos botones de acción real: **"Crear proyecto"** y **"Crear equipo"** — ambos validan primero que la gente sugerida siga existiendo en la organización.
- Solo el owner puede usarlo (por diseño: es una herramienta de arranque estratégico, no de uso diario de cualquier miembro).

### 2.2 — Semillero-rebalance (copiloto continuo, no solo al arrancar)
- Extiende El Semillero más allá del día 1: analiza un **proyecto ya en marcha**.
- Mira las tareas activas de cada persona (priorizando las vencidas o de prioridad alta), su carga actual, y los skills de todo el roster del proyecto (miembros directos + integrantes de equipos vinculados).
- Sugiere mover una tarea puntual de alguien sobrecargado a alguien con mejor calce de skills y menos carga, **con motivo explícito** en texto.
- Un clic en "Reasignar" aplica la sugerencia (usa la misma función de reasignación manual — nunca un camino de escritura paralelo); "Descartar" la ignora. No se persiste nada: se recalcula cada vez que se pide.

### 2.3 — Aria (asistente general de onboarding)
- El Semillero está pensado para el owner armando algo nuevo. **Aria** está pensada para **cualquier miembro** de la organización, con foco explícito en bajar la curva de integración de gente nueva.
- Tres modos de contexto, todos revalidados server-side (nunca se confía en lo que el cliente dice poder ver):
  - **Chat general**: resume las tareas activas propias de quien pregunta.
  - **Sobre un proyecto**: requiere estar involucrado (owner, líder, miembro directo o de un equipo vinculado) y responde con metas, áreas y métricas reales de ese proyecto.
  - **Sobre una tarea**: requiere estar involucrado en esa task puntual y responde con status, prioridad, fechas y los últimos comentarios reales.
- Puede mostrar **cards visuales** en vez de texto amontonado: una card de resumen del proyecto, o cards individuales por tarea cuando el pedido es sobre varias — nunca expone IDs crudos en el texto conversacional.

### 2.4 — Aria puede actuar, no solo responder (con confirmación explícita)
Esta es la pieza más delicada de todo el sistema de IA, y la que mejor demuestra el criterio de seguridad del producto:
- En modo "sobre una tarea", si quien pregunta pide un cambio concreto ("cambiá la fecha límite a...", "reasigná esto a...", "marcala como completada"), Aria puede terminar su respuesta con una **card de acción propuesta**: "Aceptar" / "Rechazar".
- **Aria nunca ejecuta nada sola.** El permiso se valida en **3 capas independientes**:
  1. El prompt le dice al modelo exactamente qué puede proponer para esa persona puntual — si no tiene ningún permiso de escritura, la instrucción es tajante: ni entretener el pedido como hipotético.
  2. La Edge Function revalida cada campo del bloque contra los permisos reales calculados server-side, y descarta la propuesta entera si algo no cierra.
  3. El mismo trigger de base de datos que protege la edición manual de tareas es la última palabra al momento de "Aceptar" — por si el permiso cambió entre que se propuso y que se decidió.
- 4 tipos de acción soportados: cambiar status, cambiar fecha de inicio/límite, cambiar prioridad, o reasignar a una persona. "Aceptar" llama a las **mismas funciones** que usa la edición manual — así el historial de actividad y las notificaciones que esas funciones ya disparan siguen funcionando gratis, sin duplicar lógica.

### 2.5 — Weekly Digest (reportes automáticos en lenguaje natural)
- Cada proyecto puede generar un **resumen semanal redactado por IA**: qué avanzó, qué se estancó, comparado explícitamente contra el snapshot de la semana anterior.
- Las métricas (tareas completadas/activas/vencidas/bloqueadas, % de avance) se calculan siempre en código — la IA solo las interpreta y las pone en palabras.
- Corre en dos modos: cron automático todos los lunes (notifica por correo al líder del proyecto y al owner), o botón manual "Generar ahora" para cualquier líder/owner que lo quiera en el momento.

### 2.6 — Badge Suggestions (reconocimiento asistido por IA)
- Quien puede otorgar badges (owner, o encargado de un equipo) tiene un botón "Analizar desempeño".
- La IA mira señales reales: tareas completadas/vencidas, si la persona lidera un equipo o proyecto, cuántos comentarios escribió — y sugiere `{persona, badge, razón}` con un clic para otorgar o descartar.
- El análisis se acota automáticamente a quién puede gestionar cada quien: toda la organización si es owner, solo su(s) equipo(s) si es encargado.

### 2.7 — Generación de contenido para clientes externos (Dashboard y Documentos)
- Dentro del portal de clientes (ver sección 3), el equipo puede pedirle a la IA que genere un **resumen ejecutivo** con métricas reales del proyecto elegido, o un **documento a demanda** cuando el cliente lo solicita.
- Mismo principio: los números siempre se calculan en código; la fuente de datos (qué proyectos/equipos alimentan el resumen) la elige el equipo, con un "prompt de comportamiento extra" opcional para ajustar el tono.

---

## 3. Módulo de Clientes — portal aislado, no solo gestión interna

Un diferenciador de producto completo, no una feature más: la mayoría de herramientas de gestión de proyectos no tienen un espacio real y seguro para que un cliente externo participe sin ver nada interno.

### Aislamiento como decisión de arquitectura, no de UI
- Un cliente externo se une con un **código propio**, distinto del código de organización — nunca entra a la tabla de miembros de la organización.
- Las tablas del módulo (`organization_clients`, `client_assignments`, `client_messages`, `client_requests`, `client_deliverables`, `client_home_sections`, `client_documents`) están **completamente separadas** de las que usa el resto de la app, con funciones de base de datos propias (`client_space_is_staff`, `client_space_can_access`) — así un cliente jamás puede, ni por accidente de una policy mal escrita, terminar viendo un proyecto interno.
- Una misma persona puede tener varios "espacios" con una sola cuenta (dueño de su propia organización, cliente de otra, o ambos a la vez).

### Qué puede hacer un cliente
- **Chat persistente** con el equipo que lo atiende: burbujas estilo WhatsApp, reacciones, respuestas citadas, adjuntos.
- **Solicitudes**: pedir algo puntual (reporte, documento, presentación), ver su estado, cancelarla mientras siga abierta.
- **Entregables**: el staff sube un entregable y el cliente lo **aprueba o rechaza** — esa decisión retroalimenta al equipo interno con una notificación automática.
- **Home configurable**: el equipo arma la pantalla de inicio del cliente con widgets — Dashboard con IA, resumen del proyecto, previews de chat/solicitudes, entregables pendientes. El cliente nunca ve una pantalla vacía sin sentido: si el equipo no armó nada, ve una bienvenida honesta, no un placeholder roto.

### Trazabilidad histórica real
- Quién atiende a cada cliente (`client_assignments`) es **append-only**: reasignar a otra persona o equipo nunca borra el historial, solo cierra la asignación anterior y abre una nueva — se puede reconstruir toda la línea de tiempo de quién atendió a quién y cuándo.

---

## 4. Gestión de proyectos y tareas — segmentación real, no una lista plana

### Jerarquía y roles
Organización → Proyecto → Equipo → Task, con roles distintos en cada nivel: **owner** de la organización, **líder** por proyecto, **encargado** por equipo, **miembro** asignado, y ahora **cliente** en su espacio aislado. Los permisos no viven solo en la interfaz: un trigger de Postgres (`enforce_task_update_permissions`) impone de verdad que solo el líder del proyecto o el owner puedan editar el contenido de una tarea — el asignado (persona o equipo) solo puede cambiar su status, aunque intente forzar otra cosa directo contra la base.

### 4 vistas intercambiables sobre los mismos datos
No son 4 pantallas separadas: es el mismo set de tareas, renderizado 4 formas distintas, con un switch instantáneo.
- **Kanban**: una columna por cada uno de los 8 estados de flujo (backlog → pendiente → en progreso → en revisión → en pruebas → bloqueada → completada / cancelada).
- **Lista**: fila plana ordenada por fecha límite y luego por prioridad — la forma más rápida de escanear qué es urgente.
- **Calendario**: vista mensual real, con un punto de color por la prioridad más alta del día.
- **Gantt**: grilla de días con barras **arrastrables** — mover el cuerpo de la barra cambia ambas fechas (misma duración), arrastrar un borde cambia solo esa fecha. Solo quien puede editar la tarea ve los controles de arrastre.

### Segmentación por proyecto, con filtros combinables
Cada vista puede acotarse a un proyecto puntual o mostrar "Todos" a la vez (con el proyecto como dato extra en cada fila), y todas comparten los mismos filtros: solo mis tareas, solo vencidas, por prioridad.

### Profundidad dentro de cada tarea
- **Checklist** colaborativo (estilo Trello), con barra de progreso.
- **Dependencias entre tareas** ("depende de" / "bloquea a"), con detección automática de dependencias circulares antes de dejar guardar una.
- **Etiquetas libres** con color determinístico y autocompletado basado en lo que ya se usó en ese proyecto.
- **Chat de comentarios por tarea**: burbujas estilo WhatsApp, reacciones de 4 tipos, respuestas citadas, y 4 tipos de adjunto (imagen, archivo, link o fecha).
- **Colaboradores adicionales**, además del asignado principal — gente que puede seguir y comentar la tarea sin ser la responsable de moverla.

### Automatizaciones sin código, por proyecto — reglas que trabajan solas
Cada proyecto puede tener sus propias reglas **"CUANDO pasa esto, HACÉ aquello"**, sin escribir una línea de código, gestionadas por el líder del proyecto o el owner. Es el mismo tipo de feature que separa a Jira/Asana de una simple lista de tareas.
- **3 disparadores**: se crea una tarea, una tarea cambia a un status puntual (ej. "pasa a Bloqueada"), o una tarea se reasigna.
- **6 acciones posibles**, una por regla: cambiar el status, cambiar la prioridad, agregar una etiqueta, reasignar a una persona, dejar un comentario automático, o notificar a alguien puntual.
- **Ejemplo real**: "cuando una tarea pasa a Bloqueada, subila a prioridad Urgente" — se configura en segundos desde Tasks, sin pedirle nada a nadie del equipo técnico.
- **La pieza más difícil de resolver bien, y la que más valor de ingeniería demuestra**: una automatización nunca puede disparar otra automatización. Está garantizado **por construcción** (no por un chequeo que podría fallar) — las acciones reusan las mismas funciones de escritura de siempre, marcadas internamente para no volver a evaluar reglas, así que la cascada es siempre de un solo nivel. Sin este detalle, dos reglas mal combinadas podrían generar un loop infinito de cambios — un error clásico en cualquier motor de automatización mal diseñado.
- Reusa toda la infraestructura ya construida (el historial de actividad y las notificaciones siguen funcionando automáticamente para cualquier cambio disparado por una regla) en vez de crear un camino de escritura paralelo.

---

## 5. Badges inteligentes — reconocimiento con criterio, no un sticker cualquiera

- Catálogo fijo de 10 reconocimientos de liderazgo y trabajo en equipo (Líder Nato, Team Player, Mentor, Confiable, Comunicador/a, Resolutivo/a, Innovador/a, Puntual, Motivador/a, Estratega).
- **Otorgar** un badge lo puede hacer el owner de la organización, o el encargado de cualquier equipo del que la persona forme parte.
- **Quitar** un badge es deliberadamente más restrictivo: solo quien lo otorgó originalmente, o el owner — un encargado no puede revocar en silencio un reconocimiento que dio otra persona. Esto se impone en la base de datos, no solo se oculta en la interfaz.
- La capa de **IA** (ver 2.6) analiza desempeño real para sugerir a quién reconocer, en vez de depender de que alguien se acuerde de hacerlo.

---

## 6. Perfiles tipo LinkedIn — la data que hace inteligente a toda la IA

Este es el punto que muchas plataformas de gestión se saltean: la IA de Nexus es tan buena como los perfiles que la alimentan, así que se invirtió en hacer el perfil rico de verdad, no un campo de "nombre y foto".

- **Bio corta, mote, foto** (8 avatares prediseñados o subida propia con drag-and-drop en web / picker nativo en mobile).
- **Zona horaria** real, seleccionable con buscador — el Semillero la usa activamente para no armar equipos con husos horarios incompatibles.
- **Idiomas con nivel CEFR** (A1 a C2), de un catálogo curado de 32 — no texto libre, para que el dato sea comparable entre perfiles.
- **Habilidades con nivel 1-10**, arrastrable con un control deslizante — así "sabe de diseño" se vuelve un dato ordenable, no una afirmación vaga.
- **Rol/cargo**, con opción personalizada.

Esta información no es decorativa: es el input real que consumen El Semillero (para armar equipos), Aria (para dar contexto), y las sugerencias de Badges (para evaluar liderazgo). Un perfil completo hace que toda la capa de IA rinda mejor — el producto incentiva completarlo en vez de tratarlo como un trámite de onboarding.

---

## 7. Otros diferenciadores que suman peso al producto

- **Workload Balancer**: mapa de carga del equipo — quién tiene más tareas activas y vencidas, ordenado de mayor a menor carga. Un owner ve toda la organización; un encargado de equipo ve solo la carga de la gente que lidera. Nadie más lo tiene tan simple y automático.
- **Feed de actividad curado**: no un log técnico ilegible, sino "quién hizo qué" en lenguaje humano, filtrable por equipo, proyecto o persona.
- **Búsqueda global real**: encuentra proyectos, tareas y equipos, y un click en una tarea abre su detalle exacto — no solo te manda a la pestaña correcta.
- **Centro de notificaciones in-app**: una campanita con contador de no leídas, generada en paralelo a cada correo transaccional — para quien no vive en su bandeja de entrada.
- **Correos transaccionales reales, con el SMTP propio del cliente** — no un proveedor externo tipo SendGrid. Es la misma filosofía de privacidad del punto 1, aplicada también a las comunicaciones: ni siquiera el envío de un correo pasa por un tercero ajeno al cliente.
- **Filosofía "anti-fake" en todo el producto**: nunca se simula un éxito que no ocurrió, nunca hay un spinner falso — si algo falla o todavía no está construido, se muestra honestamente. Esto genera confianza real en un producto que maneja datos sensibles.

---

## 8. Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | Expo SDK 54 + React Native (iOS / Android / Web, un solo código) |
| Base de datos | PostgreSQL vía Supabase — Row Level Security nativo, Realtime, Storage integrado |
| IA (desarrollo) | Groq (`llama-3.3-70b-versatile`) |
| IA (producción) | Ollama (Mistral / Llama 3.2), instalado directo en el SO del Raspberry Pi 5 |
| Infraestructura (producción) | Raspberry Pi 5 + Supabase self-hosted en Docker + Cloudflare Tunnel |
| Correo | SMTP propio del cliente, nunca un proveedor externo |

**Por qué Postgres + JSONB en vez de NoSQL:** flexibilidad tipo NoSQL cuando hace falta (perfiles, sugerencias de IA persistidas como jsonb), Row Level Security nativo para aislar organizaciones por diseño, Realtime para chat sin infraestructura extra, y Storage integrado para archivos — todo en una sola pieza de infraestructura, más fácil de self-hostear que un stack de 4 servicios distintos.

---

## 9. Números que respaldan la escala del producto

- **32 tablas** en el modelo de datos, todas con Row Level Security activo.
- **10 Edge Functions** desplegadas (6 de IA, 3 de correo transaccional, 1 de webhook de confirmación de cuenta).
- **20+ pantallas** completas, con un sistema visual propio consistente.
- **6 funciones de IA** distintas, cada una resolviendo un caso de uso real de gestión de equipos.
- **4 vistas intercambiables** sobre el mismo set de tareas.
- **1 solo código** para iOS, Android y Web.

---

## 10. La síntesis

> **"No es una promesa de privacidad. Es arquitectura."**

Nexus combina tres cosas que hoy nadie ofrece juntas: una plataforma de gestión de proyectos completa, IA que conoce de verdad a tu equipo (no un chatbot genérico), y la garantía arquitectónica de que ningún dato sale de la infraestructura del cliente. El self-hosting con IA local es el buque insignia; todo lo demás — el portal de clientes, las 4 vistas de tareas, los badges inteligentes, los perfiles ricos que alimentan la IA — es lo que convierte esa promesa de privacidad en un producto completo que un equipo real puede usar todos los días.
