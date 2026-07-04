// Edge Function: la IA (Groq en dev, Ollama en prod más adelante — no asumir
// que el formato de respuesta será idéntico al migrar, ver semillero-chat)
// analiza señales reales de desempeño de la organización (tasks completadas/
// vencidas, liderazgo de equipos/proyectos, participación en comentarios) y
// sugiere a quién otorgarle qué badge del catálogo COMPLETO: el fijo
// (BADGE_CATALOG en src/lib/badges.ts, duplicado acá porque esta función
// corre en Deno, no puede importar código de la app React Native) + los
// personalizados que esa organización haya creado (tabla badge_definitions,
// ver Punto 5 del feedback — la IA también debe poder sugerirlos).
//
// A diferencia de semillero-chat, no es un chat con historial: una sola
// llamada, una sola respuesta JSON, nada se persiste (se recalcula cada vez
// que el owner/encargado pide "Analizar desempeño").
//
// Deploy:
//   supabase functions deploy badge-suggestions
// (reusa el secreto GROQ_API_KEY/GROQ_MODEL ya configurado para semillero-chat,
// no hace falta configurar nada nuevo).
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Mismas keys/labels/descriptions que BADGE_CATALOG en src/lib/badges.ts.
// Si se agrega un badge nuevo ahí, agregarlo también acá.
const BADGE_CATALOG: { key: string; label: string; description: string }[] = [
  { key: "leader", label: "Líder Nato", description: "Guía al equipo con claridad y toma decisiones con seguridad." },
  { key: "team_player", label: "Team Player", description: "Colabora activamente y antepone el resultado del equipo." },
  { key: "mentor", label: "Mentor", description: "Ayuda a que otros crezcan compartiendo lo que sabe." },
  { key: "reliable", label: "Confiable", description: "Cumple lo que promete, sin necesidad de seguimiento." },
  { key: "communicator", label: "Comunicador/a", description: "Explica ideas con claridad y mantiene informado al equipo." },
  { key: "problem_solver", label: "Resolutivo/a", description: "Destraba problemas difíciles con soluciones prácticas." },
  { key: "innovator", label: "Innovador/a", description: "Propone ideas y formas nuevas de hacer las cosas." },
  { key: "punctual", label: "Puntual", description: "Entrega a tiempo y respeta las fechas acordadas." },
  { key: "motivator", label: "Motivador/a", description: "Contagia energía positiva y mantiene al equipo enfocado." },
  { key: "strategist", label: "Estratega", description: "Piensa en el panorama completo antes de actuar." },
];

type MemberStats = {
  userId: string;
  nombre: string;
  rol: string;
  tasksAsignadas: number;
  tasksCompletadas: number;
  tasksVencidasSinCompletar: number;
  comentariosEscritos: number;
  lideraEquipo: boolean;
  lideraProyecto: boolean;
  badgesActuales: string[];
};

function buildPrompt(orgName: string, roster: MemberStats[], catalog: { key: string; label: string; description: string }[]) {
  const catalogText = catalog.map((b) => `- ${b.key} ("${b.label}"): ${b.description}`).join("\n");

  const rosterText = roster
    .map(
      (m) =>
        `- id: ${m.userId} | nombre: ${m.nombre} | rol: ${m.rol} | tasks asignadas: ${m.tasksAsignadas} | tasks completadas: ${m.tasksCompletadas} | tasks vencidas sin completar: ${m.tasksVencidasSinCompletar} | comentarios escritos: ${m.comentariosEscritos} | lidera un equipo: ${m.lideraEquipo ? "sí" : "no"} | lidera un proyecto: ${m.lideraProyecto ? "sí" : "no"} | badges que ya tiene: ${m.badgesActuales.join(", ") || "ninguno"}`
    )
    .join("\n");

  return `Eres un analista de desempeño dentro de Nexus, la herramienta de gestión de proyectos de la organización "${orgName}".

Catálogo de badges disponibles (usa EXACTAMENTE estas keys):
${catalogText}

Señales reales de desempeño de los miembros de la organización:
${rosterText}

Tu tarea: sugerir hasta 6 asignaciones de badge a personas que realmente demuestren esa cualidad según las señales de arriba. Reglas:
- Nunca sugieras un badge que la persona ya tiene (ver "badges que ya tiene").
- Basa cada sugerencia en datos concretos de arriba, no inventes logros. Si nadie destaca claramente para un badge, no lo sugieras.
- Usa siempre el "id" exacto de la lista de arriba, nunca inventes ids.
- "reason" debe ser una frase breve en español citando el dato concreto que justifica la sugerencia (ej. "completó 8 de 9 tasks asignadas sin ninguna vencida").
- Responde ÚNICAMENTE con un array JSON válido, sin texto antes ni después, sin markdown, con este formato exacto:
[{"userId": "id de la persona", "badgeKey": "key del badge", "reason": "por qué"}]
- Si no hay ninguna sugerencia razonable, responde exactamente: []`;
}

function extractSuggestions(raw: string): { userId: string; badgeKey: string; reason: string }[] | null {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // sigue abajo con el fallback de extraer el primer bloque [...]
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

    const { organizationId } = (await req.json()) as { organizationId?: string };
    if (!organizationId) return json({ error: "Datos incompletos" }, 400);

    const { data: org, error: orgError } = await admin
      .from("organizations")
      .select("id, name, owner_id")
      .eq("id", organizationId)
      .maybeSingle();

    if (orgError || !org) return json({ error: "Organización no encontrada" }, 404);

    const isOwner = org.owner_id === requesterId;

    const { data: leaderTeamRows, error: leaderTeamsError } = await admin
      .from("teams")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("leader_id", requesterId);

    if (leaderTeamsError) return json({ error: "No se pudo verificar tu permiso" }, 500);

    const leaderTeamIds = (leaderTeamRows ?? []).map((t) => t.id);
    if (!isOwner && leaderTeamIds.length === 0) {
      return json({ error: "Solo el owner de la organización o el encargado de un equipo pueden pedir sugerencias" }, 403);
    }

    // Roster: todo el organigrama si es owner; solo los integrantes de los
    // equipos que lidera si es encargado (mismo criterio que la RLS de
    // profile_badges, is_badge_manager_for).
    let memberIds: string[];
    if (isOwner) {
      const { data: memberRows, error: membersError } = await admin
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organizationId);
      if (membersError) return json({ error: "No se pudo leer el equipo" }, 500);
      memberIds = Array.from(new Set((memberRows ?? []).map((m) => m.user_id)));
    } else {
      const { data: teamMemberRows, error: teamMembersError } = await admin
        .from("team_members")
        .select("user_id")
        .in("team_id", leaderTeamIds);
      if (teamMembersError) return json({ error: "No se pudo leer tu equipo" }, 500);
      memberIds = Array.from(new Set((teamMemberRows ?? []).map((m) => m.user_id)));
    }

    if (memberIds.length === 0) return json({ suggestions: [] });

    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, full_name, nickname, role, custom_role")
      .in("id", memberIds);
    if (profilesError) return json({ error: "No se pudo leer los perfiles" }, 500);

    const { data: projectRows, error: projectsError } = await admin
      .from("projects")
      .select("id, leader_id")
      .eq("organization_id", organizationId);
    if (projectsError) return json({ error: "No se pudo leer los proyectos" }, 500);
    const orgProjectIds = (projectRows ?? []).map((p) => p.id);
    const projectLeaderIds = new Set((projectRows ?? []).map((p) => p.leader_id).filter(Boolean));

    const { data: teamRows, error: teamsError } = await admin
      .from("teams")
      .select("leader_id")
      .eq("organization_id", organizationId);
    if (teamsError) return json({ error: "No se pudo leer los equipos" }, 500);
    const teamLeaderIds = new Set((teamRows ?? []).map((t) => t.leader_id).filter(Boolean));

    const { data: taskRows, error: tasksError } = orgProjectIds.length
      ? await admin
          .from("tasks")
          .select("assigned_user_id, status, due_date")
          .in("project_id", orgProjectIds)
      : { data: [], error: null };
    if (tasksError) return json({ error: "No se pudo leer las tasks" }, 500);

    const { data: taskIdRows } = orgProjectIds.length
      ? await admin.from("tasks").select("id").in("project_id", orgProjectIds)
      : { data: [] };
    const orgTaskIds = (taskIdRows ?? []).map((t: any) => t.id);

    const { data: commentRows, error: commentsError } = orgTaskIds.length
      ? await admin.from("task_comments").select("user_id").in("task_id", orgTaskIds)
      : { data: [], error: null };
    if (commentsError) return json({ error: "No se pudo leer los comentarios" }, 500);

    const { data: badgeRows, error: badgesError } = await admin
      .from("profile_badges")
      .select("profile_id, badge_key")
      .eq("organization_id", organizationId);
    if (badgesError) return json({ error: "No se pudo leer los badges actuales" }, 500);

    // Badges personalizados de esta organización (Punto 5 del feedback: la
    // IA también debe poder sugerirlos, no solo los 10 del catálogo fijo).
    const { data: customBadgeRows, error: customBadgesError } = await admin
      .from("badge_definitions")
      .select("key, label, description")
      .eq("organization_id", organizationId);
    if (customBadgesError) return json({ error: "No se pudo leer los badges personalizados" }, 500);

    const catalog = [...BADGE_CATALOG, ...(customBadgeRows ?? [])];

    const today = new Date().toISOString().slice(0, 10);

    const roster: MemberStats[] = (profiles ?? []).map((p: any) => {
      const myTasks = (taskRows ?? []).filter((t: any) => t.assigned_user_id === p.id);
      const completed = myTasks.filter((t: any) => t.status === "completed").length;
      const overdue = myTasks.filter((t: any) => t.status !== "completed" && t.due_date && t.due_date < today).length;
      const comments = (commentRows ?? []).filter((c: any) => c.user_id === p.id).length;
      const currentBadgeKeys = (badgeRows ?? []).filter((b: any) => b.profile_id === p.id).map((b: any) => b.badge_key);
      const currentBadgeLabels = currentBadgeKeys.map((k: string) => catalog.find((b) => b.key === k)?.label ?? k);

      return {
        userId: p.id,
        nombre: p.nickname || p.full_name || "Sin nombre",
        rol: p.custom_role || p.role || "Sin rol definido",
        tasksAsignadas: myTasks.length,
        tasksCompletadas: completed,
        tasksVencidasSinCompletar: overdue,
        comentariosEscritos: comments,
        lideraEquipo: teamLeaderIds.has(p.id),
        lideraProyecto: projectLeaderIds.has(p.id),
        badgesActuales: currentBadgeLabels,
      };
    });

    const prompt = buildPrompt(org.name, roster, catalog);

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: groqModel,
        temperature: 0.4,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      return json({ error: `Error de la IA: ${errText}` }, 502);
    }

    const groqData = await groqResponse.json();
    const rawContent: string = groqData.choices?.[0]?.message?.content ?? "";
    const parsed = extractSuggestions(rawContent);

    if (parsed === null) return json({ error: "La IA no devolvió un formato válido, intenta de nuevo" }, 502);

    const validKeys = new Set(catalog.map((b) => b.key));
    const validUserIds = new Set(roster.map((m) => m.userId));
    const suggestions = parsed.filter(
      (s) => s && typeof s.userId === "string" && typeof s.badgeKey === "string" && validKeys.has(s.badgeKey) && validUserIds.has(s.userId)
    );

    return json({ suggestions });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Error inesperado" }, 500);
  }
});
