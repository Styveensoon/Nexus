# EMAILS.md - Catálogo de correos transaccionales (Nexus)

Todas las plantillas deben usar el logo y colores de marca ya existentes en la plataforma. Mantener un layout base consistente (header con logo, cuerpo, botón de acción, footer) y solo cambiar contenido por tipo de correo.

⚠️ **Regla importante:** cuando una asignación llega por pertenecer a un equipo (no individual), el texto debe dejarlo explícito ("tu equipo fue asignado...") y enviarse a **todos los miembros del equipo**. Nunca redactar un correo grupal como si fuera un mensaje personal directo.

---

## 1. Cuenta / Onboarding

### 1.1 Confirmar email
- **Asunto:** Confirma tu cuenta en Nexus
- **Cuerpo:** "¡Hola [Nombre]! Ya casi estás dentro. Confirma tu correo para activar tu cuenta en Nexus."
- **Botón:** Confirmar cuenta

### 1.2 Bienvenida tras confirmar
- **Asunto:** ¡Bienvenido a Nexus, [Nombre]!
- **Cuerpo:** "Tu cuenta ya está activa. Empieza a organizar tus proyectos o únete a una organización con tu código."
- **Botón:** Ir a Nexus

### 1.3 Bienvenida como cliente
- **Asunto:** [Organización] te dio la bienvenida a Nexus
- **Cuerpo:** "Hola [Nombre], [Organización] te invitó a su espacio en Nexus. Aquí podrás dar seguimiento a tu proyecto, hablar con tu equipo asignado y ver tus avances."
- **Botón:** Entrar a mi espacio

---

## 2. Organización

### 2.1 Organización creada
- **Asunto:** Tu organización [Nombre Org] está lista
- **Cuerpo:** "Creaste [Nombre Org] en Nexus. Comparte tu código de organización para invitar a tu equipo: **[CÓDIGO]**"
- **Botón:** Ir a mi organización

### 2.2 Te uniste a una organización
- **Asunto:** Te uniste a [Nombre Org]
- **Cuerpo:** "Ya formas parte de [Nombre Org] en Nexus."
- **Botón:** Ver organización

---

## 3. Equipos

### 3.1 Fuiste agregado a un equipo (individual)
- **Asunto:** Ahora formas parte de [Nombre Equipo]
- **Cuerpo:** "[Quien te agregó] te agregó al equipo [Nombre Equipo] en [Organización]."
- **Botón:** Ver equipo

---

## 4. Proyectos

### 4.1 Fuiste agregado a un proyecto (individual)
- **Asunto:** Te agregaron al proyecto [Nombre Proyecto]
- **Cuerpo:** "[Quien te agregó] te agregó al proyecto [Nombre Proyecto]."
- **Botón:** Ver proyecto

### 4.2 Tu equipo fue agregado a un proyecto (grupal) ⚠️
- **Asunto:** Tu equipo [Nombre Equipo] fue asignado a un nuevo proyecto
- **Cuerpo:** "Tu equipo **[Nombre Equipo]** fue asignado al proyecto **[Nombre Proyecto]**. Todos los miembros del equipo ahora tienen acceso."
- **Botón:** Ver proyecto
- **Nota:** enviar a todos los miembros del equipo, no solo a quien hizo la asignación.

---

## 5. Tareas

### 5.1 Te asignaron una tarea (individual)
- **Asunto:** Nueva tarea asignada: [Nombre Tarea]
- **Cuerpo:** "[Quien asignó] te asignó la tarea **[Nombre Tarea]** en el proyecto [Nombre Proyecto]. Fecha límite: [Fecha]."
- **Botón:** Ver tarea

### 5.2 A tu equipo le asignaron una tarea (grupal) ⚠️
- **Asunto:** Nueva tarea para tu equipo: [Nombre Tarea]
- **Cuerpo:** "Se asignó la tarea **[Nombre Tarea]** a tu equipo **[Nombre Equipo]** en el proyecto [Nombre Proyecto]."
- **Botón:** Ver tarea
- **Nota:** enviar a todos los miembros del equipo.

### 5.3 Te agregaron como colaborador de una tarea
- **Asunto:** Te agregaron a la tarea [Nombre Tarea]
- **Cuerpo:** "[Quien te agregó] te agregó como colaborador en la tarea [Nombre Tarea]."
- **Botón:** Ver tarea

### 5.4 Tarea próxima a vencer
- **Asunto:** [Nombre Tarea] vence pronto
- **Cuerpo:** "Tu tarea [Nombre Tarea] vence el [Fecha]."
- **Botón:** Ver tarea

### 5.5 Tarea bloqueada / desbloqueada
- **Asunto:** [Nombre Tarea] fue marcada como bloqueada
- **Cuerpo:** "[Quien la bloqueó] marcó [Nombre Tarea] como bloqueada. Motivo: [si aplica]."
- **Botón:** Ver tarea

---

## 6. Módulo de clientes

### 6.1 Cliente se unió a la organización
- **Asunto:** [Nombre Cliente] se unió a Nexus
- **Cuerpo:** "[Nombre Cliente] se registró como cliente de [Organización]. Asígnale un equipo para comenzar."
- **Botón:** Asignar equipo
- **Destinatario:** owner/admins de la organización

### 6.2 Se te asignó como responsable de un cliente
- **Asunto:** Ahora eres responsable de [Nombre Cliente]
- **Cuerpo:** "Fuiste asignado para atender a **[Nombre Cliente]**."
- **Botón:** Ir al espacio del cliente
- **Nota:** si la asignación es a un equipo completo, aplicar la misma lógica grupal que en 4.2/5.2 ("Tu equipo fue asignado para atender a [Nombre Cliente]").

### 6.3 Nueva solicitud del cliente
- **Asunto:** Nueva solicitud de [Nombre Cliente]
- **Cuerpo:** "[Nombre Cliente] solicitó: [Tipo de solicitud/documento]."
- **Botón:** Ver solicitud
- **Destinatario:** todos los encargados asignados al cliente

### 6.4 Nuevo mensaje del cliente en el chat
- **Asunto:** [Nombre Cliente] te escribió
- **Cuerpo:** "[Nombre Cliente] envió un nuevo mensaje."
- **Botón:** Responder

### 6.5 Cliente aprobó / rechazó un entregable
- **Asunto:** [Nombre Cliente] [aprobó/rechazó] [Nombre Entregable]
- **Cuerpo:** "[Nombre Cliente] [aprobó/rechazó] el entregable [Nombre]. [Comentario si aplica]."
- **Botón:** Ver detalle

### 6.6 Nueva sección/avance en el home del cliente
- **Asunto:** Hay novedades en tu espacio de [Organización]
- **Cuerpo:** "Tu equipo actualizó tu espacio en Nexus. Hay nueva información disponible."
- **Botón:** Ver mi espacio
- **Destinatario:** el cliente

---

## 7. Badges

### 7.1 Recibiste un badge
- **Asunto:** ¡Ganaste un nuevo badge! 🏅
- **Cuerpo:** "[Nombre Badge] — [descripción corta]. ¡Sigue así!"
- **Botón:** Ver mis badges

---

## Notas de implementación

- Layout base único, reutilizable: header (logo + color de marca) → cuerpo con variables → botón de acción → footer.
- Todas las variantes "grupales" (equipo) deben distinguirse claramente en texto de las "individuales" y dispararse a todos los miembros del equipo correspondiente.
- Sugerido: usar un sistema de plantillas con variables (`{{nombre}}`, `{{proyecto}}`, `{{equipo}}`, `{{codigo}}`, etc.) para no duplicar HTML por cada correo.
- Priorizar para el alcance de 5 días: 1.1, 1.3, 2.1, 4.2, 5.2, 6.2, 6.3 (los que tocan directamente el módulo de clientes y los casos grupales que pediste cuidar). El resto puede quedar como fase 2.
