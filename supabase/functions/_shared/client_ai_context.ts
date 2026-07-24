// Compartido entre client-dashboard-generate y client-document-generate
// (docs/CLIENTE.md, "Plan de implementación — Home con widgets"). Corre en
// Deno (Edge Functions), no puede importar código de src/.
//
// verifyClientStaffAccess reimplementa en TS la misma regla que
// client_space_is_staff() en schema.sql (owner de la organización, o
// persona/equipo con una client_assignments activa para ese cliente) —
// no se puede llamar a esa función de Postgres vía RPC con el cliente
// admin/service-role porque auth.uid() ahí adentro depende del JWT de sesión,
// que no existe en ese contexto.
//
// buildProjectTeamMetrics calcula las métricas EN CÓDIGO (nunca se le piden
// números a la IA, ver docs/PATRONES.md filosofía anti-fake) a partir de los
// proyectos/equipos que el staff eligió como fuente para un widget Dashboard
// o un documento. Un equipo aporta tasks vía tasks.assigned_team_id (en
// cualquier proyecto de la organización, no solo vía project_teams); un
// proyecto aporta tasks vía tasks.project_id — se deduplican por id de task.
export async function verifyClientStaffAccess(
  admin: any,
  organizationId: string,
  clientUserId: string,
  requesterId: string
): Promise<boolean> {
  const { data: org } = await admin.from("organizations").select("owner_id").eq("id", organizationId).maybeSingle();
  if (org?.owner_id === requesterId) return true;

  const { data: assignmentRows } = await admin
    .from("client_assignments")
    .select("assigned_user_id, assigned_team_id")
    .eq("organization_id", organizationId)
    .eq("client_user_id", clientUserId)
    .is("unassigned_at", null);

  for (const row of assignmentRows ?? []) {
    if (row.assigned_user_id && row.assigned_user_id === requesterId) return true;
    if (row.assigned_team_id) {
      const { data: memberRow } = await admin
        .from("team_members")
        .select("user_id")
        .eq("team_id", row.assigned_team_id)
        .eq("user_id", requesterId)
        .maybeSingle();
      if (memberRow) return true;
    }
  }

  return false;
}

export type ProjectTeamMetrics = {
  projects: { id: string; name: string; status: string }[];
  teams: { id: string; name: string }[];
  tasksTotal: number;
  tasksCompleted: number;
  tasksInProgress: number;
  tasksOverdue: number;
  progressPercent: number;
  upcomingDueDates: { taskTitle: string; dueDate: string }[];
};

export async function buildProjectTeamMetrics(
  admin: any,
  organizationId: string,
  projectIds: string[],
  teamIds: string[]
): Promise<ProjectTeamMetrics> {
  const { data: projectRows } = projectIds.length
    ? await admin.from("projects").select("id, name, status").eq("organization_id", organizationId).in("id", projectIds)
    : { data: [] };

  const { data: teamRows } = teamIds.length
    ? await admin.from("teams").select("id, name").eq("organization_id", organizationId).in("id", teamIds)
    : { data: [] };

  const validProjectIds = (projectRows ?? []).map((p: any) => p.id);
  const { data: tasksFromProjects } = validProjectIds.length
    ? await admin.from("tasks").select("id, title, status, due_date").in("project_id", validProjectIds)
    : { data: [] };

  const validTeamIds = (teamRows ?? []).map((t: any) => t.id);
  let tasksFromTeams: any[] = [];
  if (validTeamIds.length) {
    const { data: orgProjectRows } = await admin.from("projects").select("id").eq("organization_id", organizationId);
    const orgProjectIds = (orgProjectRows ?? []).map((p: any) => p.id);
    if (orgProjectIds.length) {
      const { data } = await admin
        .from("tasks")
        .select("id, title, status, due_date")
        .in("project_id", orgProjectIds)
        .in("assigned_team_id", validTeamIds);
      tasksFromTeams = data ?? [];
    }
  }

  const taskMap = new Map<string, any>();
  [...(tasksFromProjects ?? []), ...tasksFromTeams].forEach((t) => taskMap.set(t.id, t));
  const allTasks = Array.from(taskMap.values());

  const today = new Date().toISOString().slice(0, 10);
  const tasksTotal = allTasks.length;
  const tasksCompleted = allTasks.filter((t) => t.status === "completed").length;
  const tasksInProgress = allTasks.filter((t) => t.status === "in_progress").length;
  const tasksOverdue = allTasks.filter(
    (t) => t.status !== "completed" && t.status !== "cancelled" && t.due_date && t.due_date < today
  ).length;
  const progressPercent = tasksTotal ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;
  const upcomingDueDates = allTasks
    .filter((t) => t.status !== "completed" && t.status !== "cancelled" && t.due_date && t.due_date >= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5)
    .map((t) => ({ taskTitle: t.title as string, dueDate: t.due_date as string }));

  return {
    projects: (projectRows ?? []).map((p: any) => ({ id: p.id, name: p.name, status: p.status })),
    teams: (teamRows ?? []).map((t: any) => ({ id: t.id, name: t.name })),
    tasksTotal,
    tasksCompleted,
    tasksInProgress,
    tasksOverdue,
    progressPercent,
    upcomingDueDates,
  };
}

export function metricsToPromptText(m: ProjectTeamMetrics): string {
  const sourceLine = [
    m.projects.length ? `Proyectos: ${m.projects.map((p) => `${p.name} (status: ${p.status})`).join(", ")}` : null,
    m.teams.length ? `Equipos: ${m.teams.map((t) => t.name).join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const upcoming = m.upcomingDueDates.length
    ? m.upcomingDueDates.map((u) => `"${u.taskTitle}" vence ${u.dueDate}`).join("; ")
    : "ninguna";

  return `Fuente de datos: ${sourceLine || "sin fuente seleccionada"}
Tareas totales: ${m.tasksTotal}
Tareas completadas: ${m.tasksCompleted}
Tareas en progreso: ${m.tasksInProgress}
Tareas vencidas sin completar: ${m.tasksOverdue}
Porcentaje de avance: ${m.progressPercent}%
Próximos vencimientos: ${upcoming}`;
}

// Extracción robusta de JSON de la respuesta del modelo — mismo patrón que
// badge-suggestions/index.ts (JSON.parse directo, con fallback de regex por
// si el modelo agrega texto/markdown alrededor).
export function extractJson<T>(raw: string): T | null {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // sigue abajo con el fallback
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}
