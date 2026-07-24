// Edge Function: El Semillero como copiloto continuo (docs/ARQUITECTURA.md
// "El Semillero", ya no solo arma el equipo/proyecto al crearlo — acá analiza
// un proyecto YA EN MARCHA y sugiere reasignar tareas puntuales cuando
// alguien está sobrecargado/vencido y otra persona del mismo roster tiene
// mejor calce de skills y menos carga. Mismo patrón que badge-suggestions:
// una sola llamada, no persiste sola, el cliente aplica cada sugerencia con
// un botón de un clic (updateTask).
//
// Alcance acotado a propósito (ver docs/CLIENTE.md-style "Notas de alcance"):
// solo tasks asignadas a una PERSONA (no a un equipo) dentro de un proyecto
// puntual — reasignar entre equipos es un análisis mucho más ambiguo y queda
// fuera de esta ronda.
//
// Deploy:
//   supabase functions deploy semillero-rebalance
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

type RosterMember = {
  userId: string;
  name: string;
  skills: string[];
  activeTaskCount: number;
};

function buildPrompt(
  projectName: string,
  tasksText: string,
  rosterText: string
): string {
  return `Eres El Semillero, el asistente de gestión de proyectos de Nexus. Ya no solo armas equipos al inicio — ahora también das seguimiento a proyectos en marcha.

Proyecto: "${projectName}"

Tareas activas y quién las tiene asignadas:
${tasksText}

Roster disponible para reasignar (persona, skills, cuántas tareas activas ya tiene EN ESTE PROYECTO):
${rosterText}

Tu tarea: sugerir hasta 4 reasignaciones puntuales que mejoren la situación — priorizando tareas vencidas o de prioridad alta/urgente que estén en manos de alguien sobrecargado, moviéndolas a alguien con skills relevantes y MENOS carga actual. Reglas:
- Nunca sugieras mover una tarea a la misma persona que ya la tiene.
- Nunca sugieras sobrecargar a alguien que ya tiene más tareas activas que el resto.
- Si nadie está claramente sobrecargado o no hay un mejor destino, no sugieras nada para esa tarea.
- Usa siempre los "id" exactos de la lista de arriba (tareas y personas), nunca inventes ids.
- "reason" debe ser una frase breve en español citando el dato concreto (ej. "Mateo tiene 5 tareas activas y esta está vencida; Julieta tiene 1 y sabe Figma").
- Responde ÚNICAMENTE con un array JSON válido, sin texto antes ni después, sin markdown, con este formato exacto:
[{"taskId": "id de la tarea", "toUserId": "id de la persona destino", "reason": "por qué"}]
- Si no hay ninguna sugerencia razonable, responde exactamente: []`;
}

function extractSuggestions(raw: string): { taskId: string; toUserId: string; reason: string }[] | null {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // sigue abajo con el fallback
  }
  const match = trimmed.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
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

    const { projectId } = (await req.json()) as { projectId?: string };
    if (!projectId) return json({ error: "Datos incompletos" }, 400);

    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id, name, organization_id, leader_id")
      .eq("id", projectId)
      .maybeSingle();
    if (projectError || !project) return json({ error: "Proyecto no encontrado" }, 404);

    const { data: org } = await admin.from("organizations").select("owner_id").eq("id", project.organization_id).maybeSingle();
    const isAuthorized = project.leader_id === requesterId || org?.owner_id === requesterId;
    if (!isAuthorized) return json({ error: "Solo el líder del proyecto o el owner pueden pedir sugerencias" }, 403);

    // Roster del proyecto: miembros directos + integrantes de los equipos vinculados.
    const [{ data: directMembers }, { data: projectTeamRows }] = await Promise.all([
      admin.from("project_members").select("user_id").eq("project_id", projectId),
      admin.from("project_teams").select("team_id").eq("project_id", projectId),
    ]);

    const teamIds = (projectTeamRows ?? []).map((pt: { team_id: string }) => pt.team_id);
    const { data: teamMemberRows } = teamIds.length
      ? await admin.from("team_members").select("user_id").in("team_id", teamIds)
      : { data: [] };

    const rosterUserIds = Array.from(
      new Set([
        ...(directMembers ?? []).map((m: { user_id: string }) => m.user_id),
        ...(teamMemberRows ?? []).map((m: { user_id: string }) => m.user_id),
      ])
    );

    if (rosterUserIds.length < 2) return json({ suggestions: [] });

    const [{ data: tasks, error: tasksError }, { data: profiles, error: profilesError }] = await Promise.all([
      admin
        .from("tasks")
        .select("id, title, priority, due_date, assigned_user_id")
        .eq("project_id", projectId)
        .not("status", "in", "(completed,cancelled)")
        .not("assigned_user_id", "is", null),
      admin.from("profiles").select("id, full_name, nickname, skills").in("id", rosterUserIds),
    ]);

    if (tasksError) return json({ error: "No se pudieron leer las tareas" }, 500);
    if (profilesError) return json({ error: "No se pudieron leer los perfiles" }, 500);
    if (!tasks?.length) return json({ suggestions: [] });

    const today = new Date().toISOString().slice(0, 10);
    const nameById = new Map(
      (profiles ?? []).map((p: { id: string; full_name: string | null; nickname: string | null }) => [p.id, p.nickname || p.full_name || "Sin nombre"])
    );

    const activeCountByUser = new Map<string, number>();
    (tasks ?? []).forEach((t: { assigned_user_id: string | null }) => {
      if (!t.assigned_user_id) return;
      activeCountByUser.set(t.assigned_user_id, (activeCountByUser.get(t.assigned_user_id) ?? 0) + 1);
    });

    const roster: RosterMember[] = (profiles ?? []).map((p: { id: string; skills: string[] | null }) => ({
      userId: p.id,
      name: nameById.get(p.id) ?? "Sin nombre",
      skills: p.skills ?? [],
      activeTaskCount: activeCountByUser.get(p.id) ?? 0,
    }));

    const tasksText = (tasks ?? [])
      .map((t: { id: string; title: string; priority: string; due_date: string | null; assigned_user_id: string }) => {
        const overdue = t.due_date && t.due_date < today ? " (VENCIDA)" : "";
        return `- id: ${t.id} | "${t.title}" | prioridad: ${t.priority}${overdue} | asignada a: ${nameById.get(t.assigned_user_id) ?? "?"} (id: ${t.assigned_user_id})`;
      })
      .join("\n");

    const rosterText = roster
      .map((m) => `- id: ${m.userId} | ${m.name} | skills: ${m.skills.join(", ") || "sin skills cargadas"} | tareas activas en este proyecto: ${m.activeTaskCount}`)
      .join("\n");

    const prompt = buildPrompt(project.name, tasksText, rosterText);

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqApiKey}` },
      body: JSON.stringify({ model: groqModel, temperature: 0.4, messages: [{ role: "user", content: prompt }] }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      return json({ error: `Error de la IA: ${errText}` }, 502);
    }

    const groqData = await groqResponse.json();
    const rawContent: string = groqData.choices?.[0]?.message?.content ?? "";
    const parsed = extractSuggestions(rawContent);
    if (parsed === null) return json({ error: "La IA no devolvió un formato válido, intenta de nuevo" }, 502);

    const validTaskIds = new Map((tasks ?? []).map((t: { id: string; title: string; assigned_user_id: string }) => [t.id, t]));
    const validUserIds = new Set(roster.map((m) => m.userId));

    const suggestions = parsed
      .filter(
        (s) =>
          s &&
          typeof s.taskId === "string" &&
          typeof s.toUserId === "string" &&
          validTaskIds.has(s.taskId) &&
          validUserIds.has(s.toUserId) &&
          (validTaskIds.get(s.taskId) as any).assigned_user_id !== s.toUserId
      )
      .map((s) => {
        const task = validTaskIds.get(s.taskId) as any;
        return {
          taskId: s.taskId,
          taskTitle: task.title as string,
          fromUserId: task.assigned_user_id as string,
          fromUserName: nameById.get(task.assigned_user_id) ?? "Sin nombre",
          toUserId: s.toUserId,
          toUserName: nameById.get(s.toUserId) ?? "Sin nombre",
          reason: s.reason ?? "",
        };
      });

    return json({ suggestions });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Error inesperado" }, 500);
  }
});
