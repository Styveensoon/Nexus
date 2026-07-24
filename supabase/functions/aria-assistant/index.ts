// Edge Function de Aria — el Semillero reciclado como asistente general
// (accesible a cualquier miembro, no solo owner). Tres modos de contexto,
// todos validados server-side ANTES de armar el prompt — nunca se confía en
// lo que el cliente dice poder ver, mismo criterio que el resto del proyecto
// (ver docs/TRAMPAS.md sobre RLS anidada):
//   - "free": sin contexto de un proyecto/tarea puntual, solo un resumen
//     ligero de las propias tareas pendientes de quien pregunta.
//   - "project": requiere estar involucrado en ese proyecto (owner de la
//     organización, líder del proyecto, miembro directo, o integrante de un
//     equipo vinculado) — misma regla que ya protege quién puede gestionar
//     tasks de ese proyecto.
//   - "task": requiere estar involucrado en esa task — replica exactamente
//     la función SQL task_is_involved() (líder del proyecto, owner, asignado
//     directo, integrante del equipo asignado, o colaborador).
//
// Acciones propuestas (solo en modo "task"): Aria puede terminar su respuesta
// con un bloque <<<ACTION>>>{...}<<<END_ACTION>>> que el cliente renderiza
// como una card "Aceptar/Rechazar" — Aria NUNCA ejecuta nada sola, y el
// permiso para cada tipo de acción se valida acá con el MISMO criterio que ya
// protege la edición manual (isProjectLeaderOrOwner/isInvolvedInTask en
// TasksScreen.tsx, y el trigger enforce_task_update_permissions): el líder
// del proyecto o el owner pueden proponer cualquier cambio; el asignado
// (persona o equipo) solo puede proponer un cambio de status. Si quien
// pregunta no tiene permiso para ALGUNO de los dos, el prompt le indica
// explícitamente al modelo que rechace la petición en texto y jamás emita un
// bloque de acción — no es solo una UX más linda, es la primera capa de
// defensa (la segunda es esta misma función revalidando cada campo del
// bloque antes de devolverlo, y la tercera es el trigger de Postgres cuando
// el cliente de verdad aplica el cambio con "Aceptar").
//
// Deploy:
//   supabase functions deploy aria-assistant
// (reusa el secreto GROQ_API_KEY/GROQ_MODEL ya configurado).
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

// Traducción de los enums de status/prioridad — mismo criterio que
// BADGE_LABELS en badge-suggestions/index.ts: la Edge Function corre en Deno,
// separada de src/lib/tasks.ts, así que el mapa se duplica acá a propósito en
// vez de importar TS del cliente. Sin esto, Aria mencionaba el valor crudo del
// enum ("in_progress"/"high") en su respuesta en español.
const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  pending: "Pendiente",
  in_progress: "En progreso",
  in_review: "En revisión",
  testing: "En pruebas",
  blocked: "Bloqueada",
  completed: "Completada",
  cancelled: "Cancelada",
};
const PRIORITY_LABELS: Record<string, string> = { low: "Baja", medium: "Media", high: "Alta", urgent: "Urgente" };
// De 4 a 8 valores — mismo enum que ProjectStatus en src/lib/projects.ts.
// Este mapa se había quedado en los 4 originales tras esa ampliación, así que
// un proyecto en cualquiera de los 4 estados nuevos (in_review/blocked/
// cancelled/archived) mostraba el valor crudo en inglés en la respuesta de Aria.
const PROJECT_STATUS_LABELS: Record<string, string> = {
  planning: "Planeación",
  active: "Activo",
  in_review: "En revisión",
  on_hold: "En pausa",
  blocked: "Bloqueado",
  completed: "Completado",
  cancelled: "Cancelado",
  archived: "Archivado",
};

const VALID_STATUSES = new Set(Object.keys(STATUS_LABELS));
const VALID_PRIORITIES = new Set(Object.keys(PRIORITY_LABELS));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type RosterPerson = { id: string; name: string };
type TaskPermissions = { canEditAll: boolean; canChangeStatusOnly: boolean };
type ProjectTaskInfo = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  startDate: string | null;
  assigneeLabel: string;
  permissions: TaskPermissions;
};

function metricsText(tasks: { status: string; due_date: string | null }[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const overdue = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled" && t.due_date && t.due_date < today).length;
  const blocked = tasks.filter((t) => t.status === "blocked").length;
  return `Tareas totales: ${total} | Completadas: ${completed} | Vencidas: ${overdue} | Bloqueadas: ${blocked}`;
}

async function buildProjectContext(admin: any, requesterId: string, isOwner: boolean, projectId: string, organizationId: string) {
  const { data: project } = await admin.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project || project.organization_id !== organizationId) return { error: "Proyecto no encontrado" };

  const isLeader = project.leader_id === requesterId;
  let authorized = isOwner || isLeader;

  if (!authorized) {
    const { data: directMember } = await admin
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId)
      .eq("user_id", requesterId)
      .maybeSingle();
    authorized = !!directMember;
  }

  if (!authorized) {
    const { data: projectTeams } = await admin.from("project_teams").select("team_id").eq("project_id", projectId);
    const teamIds = (projectTeams ?? []).map((t: { team_id: string }) => t.team_id);
    if (teamIds.length) {
      const { data: tm } = await admin.from("team_members").select("id").in("team_id", teamIds).eq("user_id", requesterId).maybeSingle();
      authorized = !!tm;
    }
  }

  if (!authorized) return { error: "No tenés acceso a este proyecto" };

  const { data: rawTasks } = await admin
    .from("tasks")
    .select("id, title, status, priority, due_date, start_date, assigned_user_id, assigned_team_id")
    .eq("project_id", projectId);
  const tasks = rawTasks ?? [];

  // Quién trabaja en el proyecto — antes este contexto no incluía nada de
  // esto, así que Aria respondía "no tengo esa información" ante cualquier
  // pregunta sobre líder/equipo/integrantes aunque el dato sí existiera.
  // Mismo criterio que ya usan ProjectsScreen.tsx/ProjectDetailScreen.tsx: los
  // miembros son la unión (deduplicada) de project_members directos + los
  // integrantes de cada equipo vinculado vía project_teams.
  const { data: leaderProfile } = project.leader_id
    ? await admin.from("profiles").select("id, full_name, nickname").eq("id", project.leader_id).maybeSingle()
    : { data: null };
  const leaderName = leaderProfile ? leaderProfile.nickname || leaderProfile.full_name || "Sin nombre" : null;

  const { data: directMembers } = await admin.from("project_members").select("user_id, role_in_team").eq("project_id", projectId);
  const { data: projectTeamsRows } = await admin.from("project_teams").select("team_id").eq("project_id", projectId);
  const teamIds = (projectTeamsRows ?? []).map((t: { team_id: string }) => t.team_id);
  const { data: teamsRows } = teamIds.length ? await admin.from("teams").select("id, name").in("id", teamIds) : { data: [] };
  const { data: teamMembersRows } = teamIds.length ? await admin.from("team_members").select("user_id, team_id").in("team_id", teamIds) : { data: [] };

  const memberIds = Array.from(
    new Set([...(directMembers ?? []).map((m: { user_id: string }) => m.user_id), ...(teamMembersRows ?? []).map((m: { user_id: string }) => m.user_id)])
  );
  // Une también los assigned_user_id de las tareas — cubre el caso raro de
  // alguien asignado directo a una task que ya no está en project_members/
  // team_members (removido del roster después de asignarle algo), para no
  // mostrarle "Sin nombre" a Aria sin necesidad.
  const nameQueryIds = Array.from(new Set([...memberIds, ...tasks.map((t: { assigned_user_id: string | null }) => t.assigned_user_id).filter(Boolean)]));
  const { data: memberProfiles } = nameQueryIds.length ? await admin.from("profiles").select("id, full_name, nickname").in("id", nameQueryIds) : { data: [] };
  const memberNameById = new Map(
    (memberProfiles ?? []).map((p: { id: string; full_name: string | null; nickname: string | null }) => [p.id, p.nickname || p.full_name || "Sin nombre"])
  );

  // Desglosado por equipo (no solo una lista mezclada) — sin esto el modelo
  // tendía a interpretar "integrantes" y "miembros del equipo X" como dos
  // datos DISTINTOS que no tenía, cuando en realidad son las mismas personas.
  const directMemberNames = (directMembers ?? []).map((m: { user_id: string }) => memberNameById.get(m.user_id)).filter(Boolean);
  const teamNameById = new Map((teamsRows ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));
  const membersByTeam = new Map<string, string[]>();
  (teamMembersRows ?? []).forEach((m: { user_id: string; team_id: string }) => {
    const teamName = teamNameById.get(m.team_id);
    const memberName = memberNameById.get(m.user_id);
    if (!teamName || !memberName) return;
    membersByTeam.set(teamName, [...(membersByTeam.get(teamName) ?? []), memberName]);
  });
  const teamsText = membersByTeam.size
    ? Array.from(membersByTeam.entries()).map(([teamName, names]) => `  - ${teamName}: ${names.join(", ")}`).join("\n")
    : "  ninguno";
  const allInvolvedNames = Array.from(
    new Set([leaderName, ...memberIds.map((id: string) => memberNameById.get(id))].filter(Boolean))
  );

  // Listado completo de tareas del proyecto (antes el contexto solo traía el
  // conteo agregado de metricsText — Aria podía decir "hay 2 tareas
  // pendientes" pero no sabía CUÁLES, ni podía hablar de "la vencida" cuando
  // se lo pedían después). Cada tarea trae su permiso YA calculado (no una
  // regla genérica): canEditAll es constante para todo el proyecto (líder u
  // owner), pero canChangeStatusOnly depende de si ESTA tarea puntual está
  // asignada directo a quien pregunta o al equipo del que es integrante —
  // mismo criterio exacto que ya usa buildTaskContext para una sola tarea.
  const canEditAll = isOwner || isLeader;
  const { data: requesterTeamRows } = teamIds.length
    ? await admin.from("team_members").select("team_id").in("team_id", teamIds).eq("user_id", requesterId)
    : { data: [] };
  const requesterTeamIds = new Set((requesterTeamRows ?? []).map((t: { team_id: string }) => t.team_id));

  const tasksInfo: ProjectTaskInfo[] = tasks.map(
    (t: {
      id: string;
      title: string;
      status: string;
      priority: string;
      due_date: string | null;
      start_date: string | null;
      assigned_user_id: string | null;
      assigned_team_id: string | null;
    }) => {
      const isDirectAssignee = t.assigned_user_id === requesterId;
      const isTeamAssignee = !!t.assigned_team_id && requesterTeamIds.has(t.assigned_team_id);
      const assigneeLabel = t.assigned_user_id
        ? memberNameById.get(t.assigned_user_id) ?? "alguien fuera del roster"
        : t.assigned_team_id
        ? `equipo ${teamNameById.get(t.assigned_team_id) ?? "desconocido"}`
        : "sin asignar";
      return {
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.due_date,
        startDate: t.start_date,
        assigneeLabel,
        permissions: { canEditAll, canChangeStatusOnly: canEditAll || isDirectAssignee || isTeamAssignee },
      };
    }
  );

  const today = new Date().toISOString().slice(0, 10);
  const tasksText = tasksInfo.length
    ? tasksInfo
        .map((t) => {
          const overdue = t.dueDate && t.dueDate < today && t.status !== "completed" && t.status !== "cancelled" ? " — VENCIDA" : "";
          const permLabel = t.permissions.canEditAll ? "podés editar todo" : t.permissions.canChangeStatusOnly ? "podés cambiar solo el status" : "no tenés permiso para tocarla";
          return `- id: ${t.id} | "${t.title}" | Status: ${STATUS_LABELS[t.status] ?? t.status}${overdue} | Prioridad: ${PRIORITY_LABELS[t.priority] ?? t.priority} | Vence: ${t.dueDate ?? "sin fecha"} | Asignada a: ${t.assigneeLabel} | Tu permiso: ${permLabel}`;
        })
        .join("\n")
    : "Este proyecto todavía no tiene ninguna tarea.";

  const roster: RosterPerson[] = memberIds.map((id: string) => ({ id, name: memberNameById.get(id) ?? "Sin nombre" }));
  if (project.leader_id && !memberIds.includes(project.leader_id)) roster.push({ id: project.leader_id, name: leaderName ?? "Sin nombre" });

  const contextText = `Proyecto: "${project.name}"
Descripción: ${project.description || "sin descripción"}
Status: ${PROJECT_STATUS_LABELS[project.status] ?? project.status}
Metas: ${(project.goals ?? []).join(", ") || "ninguna definida"}
Áreas: ${(project.areas ?? []).join(", ") || "ninguna definida"}
Líder del proyecto: ${leaderName ?? "sin líder asignado"}
Miembros agregados directamente al proyecto (sin pasar por un equipo): ${directMemberNames.length ? directMemberNames.join(", ") : "ninguno"}
Equipos vinculados y sus integrantes:
${teamsText}
Todas las personas involucradas en este proyecto, sin duplicados (líder + directos + de los equipos): ${allInvolvedNames.length ? allInvolvedNames.join(", ") : "nadie agregado todavía"}
${metricsText(tasks)}

Tareas de este proyecto (usá el "id" EXACTO de acá si vas a proponer un cambio sobre alguna):
${tasksText}`;

  return { contextText, tasks: tasksInfo, roster };
}

async function buildTaskContext(admin: any, requesterId: string, taskId: string, organizationId: string) {
  const { data: task } = await admin
    .from("tasks")
    .select("id, title, description, status, priority, due_date, start_date, assigned_user_id, assigned_team_id, project_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return { error: "Tarea no encontrada" };

  const { data: project } = await admin.from("projects").select("id, name, organization_id, leader_id").eq("id", task.project_id).maybeSingle();
  if (!project || project.organization_id !== organizationId) return { error: "Tarea no encontrada" };

  const { data: org } = await admin.from("organizations").select("owner_id").eq("id", organizationId).maybeSingle();

  const isOwner = org?.owner_id === requesterId;
  const isLeader = project.leader_id === requesterId;
  const isDirectAssignee = task.assigned_user_id === requesterId;

  let isTeamAssignee = false;
  if (task.assigned_team_id) {
    const { data: tm } = await admin
      .from("team_members")
      .select("id")
      .eq("team_id", task.assigned_team_id)
      .eq("user_id", requesterId)
      .maybeSingle();
    isTeamAssignee = !!tm;
  }

  let authorized = isOwner || isLeader || isDirectAssignee || isTeamAssignee;

  if (!authorized) {
    const { data: collab } = await admin.from("task_collaborators").select("id").eq("task_id", taskId).eq("user_id", requesterId).maybeSingle();
    authorized = !!collab;
  }

  if (!authorized) return { error: "No tenés acceso a esta tarea" };

  // Permisos de ESCRITURA — más restrictivos que el acceso de lectura de
  // arriba (un colaborador, por ejemplo, puede leer/chatear pero no editar
  // nada). Mismo criterio que isProjectLeaderOrOwner/isInvolvedInTask en
  // TasksScreen.tsx: el líder/owner puede tocar cualquier campo, el asignado
  // (persona o equipo) solo el status — igual que enforce_task_update_permissions.
  const canEditAll = isOwner || isLeader;
  const canChangeStatusOnly = canEditAll || isDirectAssignee || isTeamAssignee;

  const { data: comments } = await admin
    .from("task_comments")
    .select("content, created_at, user_id")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .limit(5);

  const commentUserIds = Array.from(new Set((comments ?? []).map((c: { user_id: string }) => c.user_id)));
  const { data: profiles } = commentUserIds.length
    ? await admin.from("profiles").select("id, full_name, nickname").in("id", commentUserIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p: { id: string; full_name: string | null; nickname: string | null }) => [p.id, p.nickname || p.full_name || "Alguien"]));

  const commentsText = (comments ?? [])
    .reverse()
    .map((c: { user_id: string; content: string }) => `- ${nameById.get(c.user_id) ?? "Alguien"}: ${c.content}`)
    .join("\n");

  const contextText = `Tarea: "${task.title}" (del proyecto "${project.name}")
Descripción: ${task.description || "sin descripción"}
Status: ${STATUS_LABELS[task.status] ?? task.status} | Prioridad: ${PRIORITY_LABELS[task.priority] ?? task.priority}
Fechas: ${task.start_date ? `inicio ${task.start_date}` : "sin inicio"}, ${task.due_date ? `vence ${task.due_date}` : "sin fecha límite"}
${commentsText ? `Últimos comentarios:\n${commentsText}` : "Sin comentarios todavía."}`;

  // Roster asignable (solo hace falta si puede reasignar de verdad): miembros
  // directos del proyecto + integrantes de los equipos vinculados + el líder.
  let roster: RosterPerson[] = [];
  if (canEditAll) {
    const { data: directMembers } = await admin.from("project_members").select("user_id").eq("project_id", project.id);
    const { data: projectTeams } = await admin.from("project_teams").select("team_id").eq("project_id", project.id);
    const teamIds = (projectTeams ?? []).map((t: { team_id: string }) => t.team_id);
    const { data: teamMembersRows } = teamIds.length
      ? await admin.from("team_members").select("user_id").in("team_id", teamIds)
      : { data: [] };
    const rosterIds = Array.from(
      new Set(
        [
          ...(directMembers ?? []).map((m: { user_id: string }) => m.user_id),
          ...(teamMembersRows ?? []).map((m: { user_id: string }) => m.user_id),
          project.leader_id,
        ].filter(Boolean)
      )
    );
    const { data: rosterProfiles } = rosterIds.length
      ? await admin.from("profiles").select("id, full_name, nickname").in("id", rosterIds)
      : { data: [] };
    roster = (rosterProfiles ?? []).map((p: any) => ({ id: p.id, name: p.nickname || p.full_name || "Sin nombre" }));
  }

  return {
    contextText,
    permissions: { canEditAll, canChangeStatusOnly } as TaskPermissions,
    roster,
    task: { id: task.id, title: task.title },
  };
}

async function buildFreeContext(admin: any, requesterId: string, organizationId: string) {
  const { data: projectRows } = await admin.from("projects").select("id").eq("organization_id", organizationId);
  const projectIds = (projectRows ?? []).map((p: { id: string }) => p.id);
  if (!projectIds.length) return "Esta organización todavía no tiene proyectos.";

  const { data: myTasks } = await admin
    .from("tasks")
    .select("title, status, due_date")
    .in("project_id", projectIds)
    .eq("assigned_user_id", requesterId)
    .not("status", "in", "(completed,cancelled)");

  if (!myTasks?.length) return "Quien pregunta no tiene tareas activas asignadas directamente en este momento.";

  const today = new Date().toISOString().slice(0, 10);
  const list = myTasks
    .slice(0, 8)
    .map((t: { title: string; status: string; due_date: string | null }) => `- "${t.title}" (${STATUS_LABELS[t.status] ?? t.status}${t.due_date && t.due_date < today ? ", VENCIDA" : ""})`)
    .join("\n");

  return `Tareas activas asignadas directamente a quien pregunta:\n${list}`;
}

// Solo se construye en modo "task" — le dice al modelo, en términos
// explícitos, qué puede y qué no puede proponer para ESTA tarea puntual. Si
// no tiene ningún permiso de escritura, la instrucción es tajante: ni
// siquiera entretener el pedido como hipotético.
function buildActionInstructions(permissions: TaskPermissions, roster: RosterPerson[]): string {
  const { canEditAll, canChangeStatusOnly } = permissions;

  if (!canEditAll && !canChangeStatusOnly) {
    return `\nQuien pregunta NO tiene permiso para aplicar ningún cambio sobre esta tarea (no es líder del proyecto, ni owner, ni la persona o equipo asignado). Si te pide cambiar algo (status, prioridad, fechas, reasignarla), respondé con claridad que no tiene permiso para hacerlo — nunca propongas una acción, nunca actúes como si pudiera, y nunca le expliques "cómo pedírselo a otra persona" ni ningún detalle operativo de ese cambio. No agregues ningún bloque de acción en este caso.`;
  }

  const allowed: string[] = [];
  if (canChangeStatusOnly) allowed.push("cambiar el status de la tarea");
  if (canEditAll) allowed.push("cambiar la prioridad, la fecha de inicio o la fecha límite, o reasignarla a otra persona del roster de este proyecto");

  const rosterText = canEditAll && roster.length ? `\n\nRoster de personas asignables en este proyecto (usá el "userId" EXACTO de esta lista para reasignar, nunca inventes uno):\n${roster.map((r) => `- ${r.name} (userId: ${r.id})`).join("\n")}` : "";

  return `\nQuien pregunta SÍ puede: ${allowed.join(" y ")}. Nada más que eso — si pide otra cosa que no esté en esa lista (crear/borrar tareas, cambiar otro campo que no tiene permitido, reasignar a un equipo), decile CLARAMENTE que no tiene permiso para hacer ESE cambio puntual, cerrá tu respuesta ahí, y NUNCA agregues frases tipo "te dejo esto para que lo confirmes" ni ninguna otra que sugiera que va a aparecer una tarjeta de confirmación — si no vas a emitir el bloque de acción, tu texto no debe insinuar que hay una decisión pendiente de aprobar.${rosterText}

Si (y SOLO si) te pide explícitamente aplicar uno de los cambios permitidos de arriba, y tenés todos los datos necesarios con certeza (fecha exacta, o el nombre de una persona real de la lista de roster para reasignar), terminá tu respuesta con un bloque en una línea aparte, EXACTAMENTE con uno de estos formatos (nunca más de un bloque por respuesta, JSON válido en una sola línea):
<<<ACTION>>>{"type":"update_status","status":"in_progress"}<<<END_ACTION>>>
<<<ACTION>>>{"type":"update_due_date","dueDate":"2026-08-15"}<<<END_ACTION>>>
<<<ACTION>>>{"type":"update_start_date","startDate":"2026-08-01"}<<<END_ACTION>>>
<<<ACTION>>>{"type":"update_priority","priority":"high"}<<<END_ACTION>>>
<<<ACTION>>>{"type":"reassign","assigneeUserId":"<userId real del roster de arriba>"}<<<END_ACTION>>>

"status" solo uno de: backlog, pending, in_progress, in_review, testing, blocked, completed, cancelled. "priority" solo uno de: low, medium, high, urgent. Las fechas van en formato "YYYY-MM-DD".

Si te falta un dato (no sabés a quién reasignar, la fecha es ambigua, etc.), preguntá primero en el texto conversacional y NO agregues ningún bloque todavía — mejor preguntar de más que aplicar algo mal. Nunca menciones, ni de pasada, que vas a generar/adjuntar un "JSON", "bloque" o "estructura de datos": el usuario ve esto como una tarjeta de confirmación armada por la app, anuncialo de forma natural (ej. "te dejo esto para que lo confirmes:") y el bloque va después, en una línea aparte, nunca lo menciones dentro del texto.`;
}

// Igual que buildActionInstructions, pero para modo "project": acá hay
// VARIAS tareas posibles, no una sola, así que el permiso no es un valor fijo
// para toda la respuesta — varía por tarea (ver "Tu permiso" en el listado de
// tareas del contexto). El modelo tiene que elegir la tarea correcta por su
// "id" real y el bloque de acción ahora incluye "taskId" — el servidor
// vuelve a validar ese permiso específico antes de aceptar el campo
// propuesto, nunca confía en que el modelo leyó bien el permiso listado.
function buildProjectActionInstructions(tasks: ProjectTaskInfo[], roster: RosterPerson[]): string {
  if (!tasks.length) return "";
  const anyEditable = tasks.some((t) => t.permissions.canEditAll || t.permissions.canChangeStatusOnly);
  if (!anyEditable) {
    return `\nQuien pregunta no tiene permiso de escritura sobre NINGUNA tarea de este proyecto (no es líder, ni owner, ni está asignado directo ni por equipo a ninguna). Si te pide cambiar algo de cualquier tarea, respondé con claridad que no tiene permiso — nunca propongas una acción, nunca actúes como si pudiera. No agregues ningún bloque de acción.`;
  }

  const rosterText = roster.length ? `\n\nRoster de personas de este proyecto (usá el "userId" EXACTO para reasignar, nunca inventes uno):\n${roster.map((r) => `- ${r.name} (userId: ${r.id})`).join("\n")}` : "";

  return `\nCada tarea del listado de arriba indica tu permiso real sobre ELLA puntualmente ("podés editar todo" / "podés cambiar solo el status" / "no tenés permiso para tocarla") — no asumas el mismo permiso para todas, varía tarea por tarea según quién la lidera/asigna. Si te piden cambiar algo de una tarea sin permiso ("no tenés permiso para tocarla"), decilo con claridad, no propongas nada, y no insinúes que va a aparecer una tarjeta de confirmación.

Si SÍ tenés permiso sobre la tarea que te piden cambiar, y tenés todos los datos con certeza, terminá tu respuesta con un bloque en una línea aparte (nunca más de uno, JSON válido en una sola línea), SIEMPRE con "taskId" incluido usando el id EXACTO de la tarea:
<<<ACTION>>>{"type":"update_status","taskId":"<id real de la tarea>","status":"in_progress"}<<<END_ACTION>>>
<<<ACTION>>>{"type":"update_due_date","taskId":"<id real de la tarea>","dueDate":"2026-08-15"}<<<END_ACTION>>>
<<<ACTION>>>{"type":"update_start_date","taskId":"<id real de la tarea>","startDate":"2026-08-01"}<<<END_ACTION>>>
<<<ACTION>>>{"type":"update_priority","taskId":"<id real de la tarea>","priority":"high"}<<<END_ACTION>>>
<<<ACTION>>>{"type":"reassign","taskId":"<id real de la tarea>","assigneeUserId":"<userId real del roster>"}<<<END_ACTION>>>

"update_due_date"/"update_start_date"/"update_priority"/"reassign" solo son válidos si tu permiso en esa tarea es "podés editar todo" — con "podés cambiar solo el status" únicamente podés emitir "update_status". "status" solo uno de: backlog, pending, in_progress, in_review, testing, blocked, completed, cancelled. "priority" solo uno de: low, medium, high, urgent. Fechas en formato "YYYY-MM-DD".${rosterText}

Si te falta un dato (a qué tarea se refiere si hay ambigüedad, a quién reasignar, fecha exacta), preguntá primero en el texto y NO agregues ningún bloque todavía. Nunca menciones "JSON"/"bloque"/"estructura de datos" en el texto conversacional — anunciá el cambio de forma natural y el bloque va después, en una línea aparte.`;
}

function buildSystemPrompt(orgName: string, requesterName: string, contextText: string, actionInstructions: string): string {
  return `Eres Aria, el asistente de Nexus dentro del workspace "${orgName}". Tu tono es cercano, claro y directo — ayudás a ${requesterName} a entender su trabajo (proyectos, tareas, cómo funciona algo), no sos un asistente genérico de escritura.

Contexto real disponible (nunca inventes datos que no estén acá):
${contextText}
${actionInstructions}

Responde en español, de forma breve y concreta. Si no tenés información suficiente en el contexto para responder algo con certeza, decilo honestamente en vez de inventar.`;
}

// Red de seguridad además del prompt: si el modelo igual menciona "JSON"/
// "bloque"/etc. en el texto conversacional (los LLM no siguen instrucciones
// al 100%), se descarta esa oración completa — mismo criterio que
// semillero-chat/index.ts.
const LEAK_TERMS = /\b(json|bloque de (datos|texto)|objeto de datos|estructura de datos)\b/i;

function sanitizeReply(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const clean = sentences.filter((s) => !LEAK_TERMS.test(s));
  const result = clean.join(" ").trim();
  return result.length ? result : text.trim();
}

// Red de seguridad adicional, solo para modo "task": si el modelo termina
// insinuando que viene una tarjeta de confirmación ("te dejo esto para que
// lo confirmes", "aceptá o rechazá", etc.) pero NO se terminó devolviendo
// ninguna proposedAction válida (sin permiso, bloque inválido, o directamente
// no emitió ninguno), esa frase queda colgada sin nada después — se descarta
// la oración, igual criterio que LEAK_TERMS.
const DANGLING_CONFIRM_TERMS = /\b(para que lo confirmes|para que la confirmes|para que lo apruebes|acept[aá](lo|la)? o rechaz|te dejo esto)\b/i;

function stripDanglingConfirmation(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const clean = sentences.filter((s) => !DANGLING_CONFIRM_TERMS.test(s));
  const result = clean.join(" ").trim();
  return result.length ? result : text.trim();
}

function extractAction(raw: string): { reply: string; rawAction: any | null } {
  const match = raw.match(/<<<ACTION>>>([\s\S]*?)<<<END_ACTION>>>/);
  if (!match) return { reply: raw.trim(), rawAction: null };
  const reply = raw.slice(0, match.index).trim();
  try {
    return { reply, rawAction: JSON.parse(match[1].trim()) };
  } catch {
    return { reply: raw.trim(), rawAction: null };
  }
}

// Revalida CADA campo del bloque que devolvió el modelo contra los permisos
// reales calculados en buildTaskContext — nunca confía en que el modelo
// respetó las instrucciones del prompt. Si algo no cierra, se descarta la
// acción entera (se sigue devolviendo el texto conversacional igual).
function resolveProposedAction(rawAction: any, task: { id: string; title: string }, permissions: TaskPermissions, roster: RosterPerson[]) {
  if (!rawAction || typeof rawAction !== "object") return null;
  const { canEditAll, canChangeStatusOnly } = permissions;
  const base = { taskId: task.id, taskTitle: task.title };

  switch (rawAction.type) {
    case "update_status": {
      if (!canChangeStatusOnly) return null;
      const status = rawAction.status;
      if (typeof status !== "string" || !VALID_STATUSES.has(status)) return null;
      return { ...base, type: "update_status", status, description: `Cambiar el status de "${task.title}" a ${STATUS_LABELS[status]}` };
    }
    case "update_due_date": {
      if (!canEditAll) return null;
      const dueDate = rawAction.dueDate;
      if (typeof dueDate !== "string" || !DATE_RE.test(dueDate)) return null;
      return { ...base, type: "update_due_date", dueDate, description: `Cambiar la fecha límite de "${task.title}" a ${dueDate}` };
    }
    case "update_start_date": {
      if (!canEditAll) return null;
      const startDate = rawAction.startDate;
      if (typeof startDate !== "string" || !DATE_RE.test(startDate)) return null;
      return { ...base, type: "update_start_date", startDate, description: `Cambiar la fecha de inicio de "${task.title}" a ${startDate}` };
    }
    case "update_priority": {
      if (!canEditAll) return null;
      const priority = rawAction.priority;
      if (typeof priority !== "string" || !VALID_PRIORITIES.has(priority)) return null;
      return { ...base, type: "update_priority", priority, description: `Cambiar la prioridad de "${task.title}" a ${PRIORITY_LABELS[priority]}` };
    }
    case "reassign": {
      if (!canEditAll) return null;
      const person = roster.find((r) => r.id === rawAction.assigneeUserId);
      if (!person) return null;
      return { ...base, type: "reassign", assigneeUserId: person.id, assigneeName: person.name, description: `Reasignar "${task.title}" a ${person.name}` };
    }
    default:
      return null;
  }
}

// Modo "project": el bloque de acción trae "taskId" porque hay varias tareas
// posibles — se busca esa tarea EXACTA dentro de la lista ya calculada en
// buildProjectContext (con su permiso ya resuelto server-side, nunca el que
// diga el modelo) y se delega a resolveProposedAction con los permisos
// reales de esa tarea puntual. Si el taskId no existe en este proyecto, o el
// modelo "olvidó" incluirlo, se descarta la acción entera.
function resolveProjectProposedAction(rawAction: any, tasks: ProjectTaskInfo[], roster: RosterPerson[]) {
  if (!rawAction || typeof rawAction !== "object" || typeof rawAction.taskId !== "string") return null;
  const task = tasks.find((t) => t.id === rawAction.taskId);
  if (!task) return null;
  return resolveProposedAction(rawAction, { id: task.id, title: task.title }, task.permissions, roster);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    const groqModel = Deno.env.get("GROQ_MODEL") ?? "llama-3.3-70b-versatile";

    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Función mal configurada (Supabase)" }, 500);
    if (!groqApiKey) return json({ error: "Función mal configurada (falta GROQ_API_KEY)" }, 500);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !userData.user) return json({ error: "Sesión inválida" }, 401);
    const requesterId = userData.user.id;

    const { organizationId, mode, contextId, messages } = (await req.json()) as {
      organizationId?: string;
      mode?: "free" | "project" | "task";
      contextId?: string;
      messages?: { role: "user" | "assistant"; content: string }[];
    };

    if (!organizationId || !mode || !messages?.length) return json({ error: "Datos incompletos" }, 400);

    const { data: org } = await admin.from("organizations").select("owner_id, name").eq("id", organizationId).maybeSingle();
    if (!org) return json({ error: "Organización no encontrada" }, 404);
    const isOwner = org.owner_id === requesterId;

    const { data: memberRow } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", requesterId)
      .maybeSingle();
    if (!isOwner && !memberRow) return json({ error: "No sos parte de esta organización" }, 403);

    const { data: requesterProfile } = await admin.from("profiles").select("full_name, nickname").eq("id", requesterId).maybeSingle();
    const requesterName = requesterProfile?.nickname || requesterProfile?.full_name || "quien pregunta";

    let contextText: string;
    let taskActionCtx: { permissions: TaskPermissions; roster: RosterPerson[]; task: { id: string; title: string } } | null = null;
    let projectActionCtx: { tasks: ProjectTaskInfo[]; roster: RosterPerson[] } | null = null;

    if (mode === "project") {
      if (!contextId) return json({ error: "Falta el proyecto" }, 400);
      const result = await buildProjectContext(admin, requesterId, isOwner, contextId, organizationId);
      if (result.error) return json({ error: result.error }, 403);
      contextText = result.contextText!;
      projectActionCtx = { tasks: result.tasks!, roster: result.roster! };
    } else if (mode === "task") {
      if (!contextId) return json({ error: "Falta la tarea" }, 400);
      const result = await buildTaskContext(admin, requesterId, contextId, organizationId);
      if (result.error) return json({ error: result.error }, 403);
      contextText = result.contextText!;
      taskActionCtx = { permissions: result.permissions!, roster: result.roster!, task: result.task! };
    } else {
      contextText = await buildFreeContext(admin, requesterId, organizationId);
    }

    const actionInstructions = taskActionCtx
      ? buildActionInstructions(taskActionCtx.permissions, taskActionCtx.roster)
      : projectActionCtx
      ? buildProjectActionInstructions(projectActionCtx.tasks, projectActionCtx.roster)
      : "";
    const systemPrompt = buildSystemPrompt(org.name, requesterName, contextText, actionInstructions);

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqApiKey}` },
      body: JSON.stringify({
        model: groqModel,
        temperature: 0.6,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      return json({ error: `Error de la IA: ${errText}` }, 502);
    }

    const groqData = await groqResponse.json();
    const rawReply: string = groqData.choices?.[0]?.message?.content ?? "";
    if (!rawReply) return json({ error: "La IA no devolvió respuesta" }, 502);

    const { reply: splitReply, rawAction } = extractAction(rawReply);
    let reply = sanitizeReply(splitReply);

    const proposedAction = !rawAction
      ? null
      : taskActionCtx
      ? resolveProposedAction(rawAction, taskActionCtx.task, taskActionCtx.permissions, taskActionCtx.roster)
      : projectActionCtx
      ? resolveProjectProposedAction(rawAction, projectActionCtx.tasks, projectActionCtx.roster)
      : null;

    // Si al final no queda ninguna acción válida para mostrar (sin permiso,
    // bloque inválido, o el modelo no emitió ninguno), limpiar cualquier
    // frase que haya insinuado que venía una tarjeta de confirmación.
    if ((taskActionCtx || projectActionCtx) && !proposedAction) reply = stripDanglingConfirmation(reply);

    return json({ reply, proposedAction });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Error inesperado" }, 500);
  }
});
