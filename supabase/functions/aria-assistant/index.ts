// Edge Function de Aria — el Semillero reciclado como asistente general
// (accesible a cualquier miembro, no solo owner). Dos modos de contexto,
// ambos validados server-side ANTES de armar el prompt — nunca se confía en
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

  let authorized = project.leader_id === requesterId || org?.owner_id === requesterId || task.assigned_user_id === requesterId;

  if (!authorized && task.assigned_team_id) {
    const { data: tm } = await admin
      .from("team_members")
      .select("id")
      .eq("team_id", task.assigned_team_id)
      .eq("user_id", requesterId)
      .maybeSingle();
    authorized = !!tm;
  }

  if (!authorized) {
    const { data: collab } = await admin.from("task_collaborators").select("id").eq("task_id", taskId).eq("user_id", requesterId).maybeSingle();
    authorized = !!collab;
  }

  if (!authorized) return { error: "No tenés acceso a esta tarea" };

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

  return { contextText };
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

function buildSystemPrompt(orgName: string, requesterName: string, contextText: string): string {
  return `Eres Aria, el asistente de Nexus dentro del workspace "${orgName}". Tu tono es cercano, claro y directo — ayudás a ${requesterName} a entender su trabajo (proyectos, tareas, cómo funciona algo), no sos un asistente genérico de escritura.

Contexto real disponible (nunca inventes datos que no estén acá):
${contextText}

Responde en español, de forma breve y concreta. Si no tenés información suficiente en el contexto para responder algo con certeza, decilo honestamente en vez de inventar.`;
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
    } else {
      contextText = await buildFreeContext(admin, requesterId, organizationId);
    }

    const systemPrompt = buildSystemPrompt(org.name, requesterName, contextText);

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
    const reply: string = groqData.choices?.[0]?.message?.content ?? "";
    if (!reply) return json({ error: "La IA no devolvió respuesta" }, 502);

    return json({ reply });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Error inesperado" }, 500);
  }
});
