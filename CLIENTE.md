# Módulo de Clientes — Especificación

Diferenciador de Nexus: portal aislado por cliente, con equipo humano asignado, chat persistente y generación de contenido asistida por IA en base a datos reales del proyecto.

---

## 1. Registro y código de cliente

- [ ] Al crear cuenta, el usuario elige (switch/selector) entre:
  - "Pertenezco a una organización" → se une con **código de organización** (ya existente).
  - "Soy cliente" → se une con **código de cliente** (nuevo).
- [ ] El código de cliente es **general** (no único por cliente), similar al código de organización: identifica el *rol* con el que se une, no a un cliente específico.
- [ ] Al unirse como cliente, el usuario personaliza su perfil (nombre, foto, etc.) para identificarse.
- [ ] Al registrarse, se le informa/solicita consentimiento de que su información podrá usarse para mejora de la plataforma / analítica (dejar esto explícito por temas de privacidad).

## 2. Cuenta multi-organización (un solo login, varios espacios)

- [ ] Un mismo usuario puede pertenecer a **más de una organización** (como cliente, como empleado, o ambos) con una sola cuenta.
- [ ] En **Ajustes**, opción para **"Agregar organización"**: se introduce un nuevo código (de organización o de cliente) y se genera un **espacio adicional** dentro de la misma cuenta.
- [ ] Dado que al registrarse ya se sabe que el usuario es cliente, mostrar en Home/Ajustes un banner/botón con leyenda tipo:
  > "¿Tienes más de un proyecto en Nexus? Agrégalo aquí"
- [ ] El usuario cambia entre espacios (organización A, organización B, cliente de organización C, etc.) sin necesidad de otra cuenta.

## 3. Habitación aislada del cliente ("home" del cliente)

- [ ] Al unirse, el cliente entra a un espacio **completamente aislado** del resto de la plataforma (no ve nada de la organización salvo lo que su equipo asignado le habilite).
- [ ] Estado inicial: home vacío, pero con una **bienvenida acogedora** (mensaje de bienvenida + logo de la organización a la que se une). Priorizar la parte humana/cálida sobre el contenido funcional en este estado inicial.
- [ ] El espacio del cliente **nunca se borra ni se archiva**, aunque el proyecto termine o la relación comercial finalice:
  - Sirve como histórico consultable por el cliente en cualquier momento.
  - Sirve como fuente de datos para analítica / data mining / entrenamiento de modelos a futuro.
  - Refuerza que el vínculo del cliente es con la **plataforma (Nexus)**, no necesariamente con la organización que lo atendió.

## 4. Equipo asignado al cliente

- [ ] El owner de la organización designa una **persona o equipo** encargado de atender a cada cliente.
- [ ] Modelo de permisos: **todos los miembros del equipo asignado pueden hacer de todo** sobre el espacio de ese cliente (sin permisos granulares). La responsabilidad/trazabilidad se resuelve vía el **log de actividad** (quién hizo qué y cuándo), no restringiendo permisos.
- [ ] Si el equipo/persona asignada cambia (reasignación), el **historial completo permanece intacto** y ligado al cliente, no a la persona:
  - El chat es persistente y vive para siempre, sin importar cuántas veces cambie el equipo asignado.
  - Los archivos, links y mensajes intercambiados también permanecen.

## 5. Comunicación con el cliente

- [ ] Chat directo entre el equipo asignado y el cliente (reutiliza el sistema de chat que ya existe en tareas — "vive ahí eternamente").
- [ ] Soporta intercambio de archivos, imágenes y links, además de mensajes de texto.
- [ ] El cliente puede **reaccionar y responder a comentarios** (no solo mirar pasivamente).

## 6. Construcción del home del cliente (secciones)

- [ ] El equipo asignado arma el home del cliente **a la medida**, agregando secciones (ej. Dashboard, Reports, etc.) — no es 100% automático por IA, el equipo decide la estructura.
- [ ] Al agregar una sección tipo **Dashboard**:
  1. El equipo selecciona sobre qué **proyecto(s)** se basará (ej. "Rediseño de marca"). Debe soportar **selección múltiple** de proyectos y equipos como fuente de datos (un cliente puede tener más de un proyecto con el tiempo).
  2. La IA (ya existente en la plataforma, no requiere hosting/infra nueva) genera el contenido de la sección en base a esos datos reales: tareas completadas, urgencia, tiempos, etc.
  3. Campo de **"prompt de comportamiento extra"** por sección — para ajustar tono/enfoque de la IA (ej. "tono formal", "resumen ejecutivo", "no mencionar tareas bloqueadas").
- [ ] El dashboard se **regenera** con datos frescos (no es una foto fija) — se actualiza conforme cambian los datos del proyecto.
- [ ] **Biblioteca de prompts reutilizables**: guardar los prompts de comportamiento más usados como plantillas, para no reescribirlos cada vez que se arma una sección nueva.

## 7. Documentos y presentaciones bajo demanda

- [ ] A diferencia del dashboard (automático/vivo), los **PDFs, documentos y presentaciones** el cliente los **solicita** — no se generan solos.
- [ ] El equipo genera el documento en minutos usando IA cuando el cliente lo pide, y puede **regenerarse** cuando haga falta (no es una versión única y estática).
- [ ] Esto da control de calidad humano antes de entregarle al cliente algo formal.

## 8. Apartado de solicitudes

- [ ] Nueva sección **"Solicitudes"** dentro del espacio del cliente.
- [ ] El cliente solicita ahí lo que necesite (documento, presentación, reporte custom, etc.).
- [ ] Al crear una solicitud, se notifica **por email a todos los encargados** (todo el equipo asignado al cliente), no solo a uno — evita que una solicitud se quede sin atender por asumir que "alguien más la toma".
- [ ] La solicitud también queda visible **dentro de la plataforma** (no solo en el email), para que quede historial y trazabilidad.

## 9. Aprobaciones

- [ ] Sistema de aprobación para entregables: el cliente puede **aprobar o rechazar** algo mostrado en su espacio (ej. un diseño, un entregable).
- [ ] Una aprobación o comentario del cliente puede **retroalimentar el flujo de trabajo interno** (ej. dispara notificación o siguiente tarea para el equipo) — el cliente no solo mira, empuja el proceso.

---

## Notas de alcance (dado el tiempo disponible)

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
- Notificaciones al cliente cuando hay novedades en su home (nueva sección, avance importante).
