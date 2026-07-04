# TODO - Feedback del profesor

## 1. Perfil de usuario
- [x] Mostrar en el perfil los **proyectos** en los que trabaja el usuario.
- [x] Mostrar en el perfil los **equipos** de los que forma parte.
- [x] Estos campos (proyectos/equipos) deben ser **de solo lectura** al editar el perfil (no deben poder modificarse junto con mote, color, etc.).
- [x] Al hacer click en un proyecto del listado, mostrar **desde cuándo** el usuario trabaja en ese proyecto.

## 2. Organizaciones
- [x] **Bug:** el drag & drop para subir logo no funciona al crear una organización (sí funciona en equipos y proyectos). Revisar y replicar la misma lógica/componente.
- [x] **Bug:** en los campos tipo "Otro" (input de texto libre), falta el botón para **agregar/confirmar** el valor escrito. Revisar todos los formularios donde aparezca este patrón.
- [x] Crear apartado de **personalización de organización**:
  - [x] Cambiar logo
  - [x] Cambiar nombre
  - [x] Cambiar color

## 3. Tareas
- [x] Agregar función para **añadir usuarios** a una tarea. *(colaboradores adicionales, aparte del asignado principal — ver nota de decisión abajo)*
- [x] Agregar **buscador de usuarios** dentro del apartado de tareas.
- [x] Al hacer click en un usuario (desde el buscador), mostrar:
  - [x] Tareas en las que trabaja actualmente + status de cada una.
  - [x] **Histórico** de tareas: completadas, bloqueadas, etc.

## 4. Actividad / Log
- [x] Actualmente solo se muestra: quién, qué acción y hora.
- [x] Al hacer click sobre una actividad, mostrar el **detalle completo**:
  - Ejemplo: si la actividad dice "comentó", al hacer click debe mostrar el **comentario real**, no solo la acción genérica.
- [x] Aplicar este nivel de detalle (click → detalle) a **todos los tipos de actividad**, no solo comentarios.

## 5. Badges
- [x] Implementar **CRUD completo** de badges:
  - [x] Crear badge
  - [x] Eliminar badge
  - (Actualmente solo se pueden ver/asignar, falta crear y eliminar)

---

## Ronda 2 — ajustes pedidos tras revisar lo de arriba

- [x] Badges: agregar más íconos al crear un badge (24 en total ahora, antes solo los 10 del catálogo fijo) + poder elegir un color 100% personalizado (no solo los 7 rápidos), mismo picker que ya usan Equipos/Proyectos.
- [x] Badges: que la IA (botón "Analizar desempeño") también considere y pueda sugerir los badges personalizados de la organización, no solo los 10 de fábrica.
- [x] Actividad: si el comentario tenía un link, foto o archivo adjunto, mostrar el adjunto real en el detalle (imagen, link clickeable, o nombre de archivo) — ya no un texto genérico de "tal vez fue un adjunto".
- [x] Actividad: la lista de actividad de un usuario (apartado "Usuarios") ahora es scrolleable con altura fija, ya no empuja toda la página hacia abajo.
- [x] Proyectos: mismo sistema de selector directo de status que ya tenían las tareas (en vez de "tocar para ciclar"), y de 4 estados pasó a 8 (agregué `en_revision`, `bloqueado`, `cancelado`, `archivado`, además de los 4 que ya existían).

## Ronda 3 — 2 bugs reportados después de probar la Ronda 2

- [x] El logo de la organización (avatar del header) y el banner "TU WORKSPACE" tenían un degradado/glow encima del color de marca (se oscurecía hacia una esquina + un brillo blanco superpuesto) que con ciertos colores se veía mal. Ahora ambos son el color sólido original de `organization.color`, sin gradiente ni blur.
- [x] Comentar en una task SOLO con un adjunto (imagen/link/archivo, sin texto) no generaba ninguna fila en Actividad. La función que loguea (`addTaskComment`) solo lo hacía si había texto — pensado originalmente para no loguear los adjuntos que se agregan al CREAR una task (que técnicamente pasan por la misma función). Ahora `addTaskComment` recibe un flag explícito `skipActivityLog` que solo se usa en ese caso puntual de creación; cualquier comentario real del chat (texto, adjunto, o ambos) sí queda registrado.

Sin cambios de schema ni de Edge Functions en esta ronda — no hace falta correr ni desplegar nada.

---

# ✅ Checklist para tu Vo.Bo.

Los 5 puntos originales + los 5 ajustes de la Ronda 2 están implementados y `tsc --noEmit` corre limpio (solo el error preexistente de `AppNavigator.tsx`, ya documentado como archivo muerto). Nada de esto se probó en vivo contra el dev server — falta que tú lo veas andar y confirmes.

## ⚠️ Antes de probar

**Otra vez hay que correr `schema.sql` completo** (es idempotente, seguro re-correrlo entero) — esta ronda 2 solo agrega un cambio de schema más:
- El constraint de `projects.status` se amplió de 4 a 8 valores (`projects_status_check`).

**Y esta vez SÍ hay una Edge Function para re-desplegar:**
```
supabase functions deploy badge-suggestions
```
(sin secretos nuevos, reusa `GROQ_API_KEY` ya configurado). Si no la re-despliegas, la IA va a seguir ignorando los badges personalizados al sugerir.

## Decisiones que tomé por ti (avísame si alguna no es la que querías)
1. **Tareas — "añadir usuarios"**: lo implementé como **colaboradores adicionales** (gente extra que ve/comenta la task), sin tocar el asignado principal (persona o equipo) que ya existía. Elegiste esta opción cuando te pregunté al arrancar.
2. **Badges**: el catálogo nuevo que cree un owner es **propio de su organización** (no se comparte entre organizaciones distintas). Elegiste esta opción también.
3. **Histórico de tareas** (Punto 3): agrupé como "histórico" los estados `completada`, `bloqueada` y `cancelada` (tal como los mencionaste), y todo lo demás como "actual".
4. **Personalización de organización** (Punto 2): quedó en pantalla nueva (`OrganizationSettingsScreen`), con acceso desde un ícono de engranaje en la tarjeta "TU WORKSPACE" del Dashboard (solo visible para el owner).
5. **Estados de Proyectos (Ronda 2):** eran 4 (`planning`/`active`/`on_hold`/`completed`); agregué 4 más para llegar a 8 (igual que Tareas): `in_review` (En revisión), `blocked` (Bloqueado), `cancelled` (Cancelado), `archived` (Archivado). Si prefieres otros nombres o menos estados, dímelo y los ajusto.

## Qué probar en cada punto

**1. Perfil**
- [ ] Entrar a Profile → ver secciones "Equipos" y "Proyectos" con datos reales (no el texto viejo de "esto se conecta cuando construyamos...").
- [ ] Tocar un proyecto → se abre un modal con "trabajas en este proyecto desde [fecha]".
- [ ] Entrar a modo edición de perfil → confirmar que NO aparece ningún campo de equipos/proyectos ahí (ya era así, solo lo verifiqué).

**2. Organizaciones**
- [ ] Crear una organización nueva → en "Logo y color de marca" ahora debe poder arrastrarse una imagen (antes era un input de URL nada más).
- [ ] En Perfil (rol "Otro") y en Equipos (rol personalizado de un integrante) → escribir un rol personalizado y tocar el check ✓ junto al input.
- [ ] Desde el Dashboard (owner), tocar el ícono de engranaje en "TU WORKSPACE" → cambiar nombre/logo/color → Guardar → confirmar que el Dashboard refleja el cambio.

**3. Tareas**
- [ ] Abrir el detalle de una task (como líder de proyecto u owner) → sección "Colaboradores" → tocar el ícono de "+" → agregar/quitar gente del picker con buscador.
- [ ] Un colaborador agregado debería poder ver/comentar esa task aunque no sea el asignado (requiere el `schema.sql` corrido).
- [ ] En la pantalla de Tareas, buscar a alguien por nombre en el buscador nuevo (arriba, debajo del botón "Nueva task") → tocar un resultado → se abre "Tareas actuales" + "Histórico" de esa persona.

**4. Actividad**
- [ ] En el Dashboard ("Actividad reciente") o en la pantalla Actividad completa → tocar cualquier fila → se abre un modal con el detalle.
- [ ] Probar específicamente con un comentario nuevo (creado después de este cambio) → el detalle debe mostrar el texto real del comentario, no solo "comentó en la tarea X". Los comentarios/cambios de estado creados ANTES de este cambio no van a tener el detalle enriquecido (no hay dato histórico que migrar), solo los nuevos.

**5. Badges**
- [ ] Como owner, entrar a Badges → tarjeta nueva "Tus badges personalizados" → "Crear badge" → llenar nombre/descripción/ícono/color → confirmar que aparece en la lista y se puede otorgar a alguien igual que los de fábrica.
- [ ] Borrar un badge personalizado (ícono de basurero + confirmar) → verificar que desaparece de la lista y ya no se puede otorgar.
- [ ] Confirmar que los 10 badges de fábrica siguen ahí y no se pueden borrar (no tienen botón de borrar).

**Ronda 2**
- [ ] Badges → "Crear badge" → confirmar que hay bastantes más de 10 íconos para elegir, y que "Personalizar color" abre el selector de color libre (no solo los 7 rápidos).
- [ ] Crear un badge personalizado nuevo → pedirle a la IA "Analizar desempeño" (con datos de alguien que amerite ese badge) → confirmar que la IA puede sugerir ese badge nuevo, no solo los de fábrica. **Recuerda re-desplegar la Edge Function primero** (ver arriba) o esto no va a funcionar.
- [ ] En el chat de una task, comentar solo con una imagen/link/archivo (con o sin texto) → ir a Actividad → tocar esa fila → confirmar que se ve el adjunto real (la imagen, el link clickeable, o el nombre del archivo), no un texto genérico.
- [ ] En Actividad → apartado "Usuarios" → elegir a alguien con bastante actividad → confirmar que la lista de resultados scrollea dentro de su propio recuadro en vez de estirar toda la página.
- [ ] En Proyectos, tocar el badge de status de una tarjeta (como owner) → debe abrirse un modal de selección directa (igual que en Tareas) con los 8 estados, no ciclar al tocar.

**Ronda 3**
- [ ] Configurar una organización con un color de marca "difícil" (ej. un rosa/magenta fuerte) → confirmar que el avatar del header y el banner "TU WORKSPACE" se ven con ese color parejo, sin degradado ni brillo raro.
- [ ] Comentar en una task solo con una foto/link/archivo (sin escribir texto) → ir a Actividad → confirmar que SÍ aparece una fila nueva ("comentó en la tarea..."), y que al tocarla se ve el adjunto real.
- [ ] Crear una task nueva con adjuntos iniciales (los que se agregan en el modal de creación) → confirmar que esos NO generan filas en Actividad (ese comportamiento no debía cambiar).
