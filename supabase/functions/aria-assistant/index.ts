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
const PROJECT_STATUS_LABELS: Record<string, string> = { planning: "Planeación", active: "Activo", on_hold: "En pausa", completed: "Completado" };

const VALID_STATUSES = new Set(Object.keys(STATUS_LABELS));
const VALID_PRIORITIES = new Set(Object.keys(PRIORITY_LABELS));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type RosterPerson = { id: string; name: string };
type TaskPermissions = { canEditAll: boolean; canChangeStatusOnly: boolean };

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

  const { data: tasks } = await admin.from("tasks").select("status, due_date").eq("project_id", projectId);

  const contextText = `Proyecto: "${project.name}"
Descripción: ${project.description || "sin descripción"}
Status: ${PROJECT_STATUS_LABELS[project.status] ?? project.status}
Metas: ${(project.goals ?? []).join(", ") || "ninguna definida"}
Áreas: ${(project.areas ?? []).join(", ") || "ninguna definida"}
${metricsText(tasks ?? [])}`;

  return { contextText };
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

    if (mode === "project") {
      if (!contextId) return json({ error: "Falta el proyecto" }, 400);
      const result = await buildProjectContext(admin, requesterId, isOwner, contextId, organizationId);
      if (result.error) return json({ error: result.error }, 403);
      contextText = result.contextText!;
    } else if (mode === "task") {
      if (!contextId) return json({ error: "Falta la tarea" }, 400);
      const result = await buildTaskContext(admin, requesterId, contextId, organizationId);
      if (result.error) return json({ error: result.error }, 403);
      contextText = result.contextText!;
      taskActionCtx = { permissions: result.permissions!, roster: result.roster!, task: result.task! };
    } else {
      contextText = await buildFreeContext(admin, requesterId, organizationId);
    }

    const actionInstructions = taskActionCtx ? buildActionInstructions(taskActionCtx.permissions, taskActionCtx.roster) : "";
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

    const proposedAction =
      taskActionCtx && rawAction ? resolveProposedAction(rawAction, taskActionCtx.task, taskActionCtx.permissions, taskActionCtx.roster) : null;

    // Si al final no queda ninguna acción válida para mostrar (sin permiso,
    // bloque inválido, o el modelo no emitió ninguno), limpiar cualquier
    // frase que haya insinuado que venía una tarjeta de confirmación.
    if (taskActionCtx && !proposedAction) reply = stripDanglingConfirmation(reply);

    return json({ reply, proposedAction });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Error inesperado" }, 500);
  }
});
