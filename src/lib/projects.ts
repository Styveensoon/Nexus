import { supabase } from "./supabase";
import type { TeamSuggestion } from "./semillero";
import { getTeamsByIds, Team } from "./teams";
import { logActivity } from "./activity";
import { getDisplayName, notifyProjectMemberAdded, notifyProjectTeamAssigned } from "./emails";
import { createTask } from "./tasks";

// De 4 a 8 valores (mismo criterio que TaskStatus en lib/tasks.ts) — con el
// selector directo (ProjectStatusPickerModal, ver docs/PATRONES.md) ya no
// hace falta mantenerlo corto para que "ciclar" siga siendo práctico.
export type ProjectStatus =
  | "planning"
  | "active"
  | "in_review"
  | "on_hold"
  | "blocked"
  | "completed"
  | "cancelled"
  | "archived";

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planeación",
  active: "Activo",
  in_review: "En revisión",
  on_hold: "En pausa",
  blocked: "Bloqueado",
  completed: "Completado",
  cancelled: "Cancelado",
  archived: "Archivado",
};

export const STATUS_ORDER: ProjectStatus[] = [
  "planning",
  "active",
  "in_review",
  "on_hold",
  "blocked",
  "completed",
  "cancelled",
  "archived",
];

// Color funcional por status (no se toca con el acento de marca, ver
// docs/PATRONES.md "primaryColor vs orgColor") — centralizado acá porque lo
// usan ProjectsScreen, DashboardScreen y ProfileScreen; antes vivía duplicado
// como una constante local en cada uno de los 3 archivos.
export const STATUS_COLORS: Record<ProjectStatus, string> = {
  planning: "#F59E0B",
  active: "#10B981",
  in_review: "#A855F7",
  on_hold: "#94A3B8",
  blocked: "#EF4444",
  completed: "#2563EB",
  cancelled: "#78716C",
  archived: "#64748B",
};

// Abanico de áreas comunes para el picker rápido de "Áreas involucradas" al
// crear/editar un proyecto (ver ProjectsScreen.tsx) — no es una lista cerrada,
// el input de texto libre sigue existiendo para cualquier área que no esté acá.
export const PROJECT_AREA_OPTIONS = ["Diseño", "Desarrollo", "Marketing", "Ventas", "Soporte / Operaciones"];

export type ProjectMemberProfile = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  avatarColor: string;
  roleInTeam: string | null;
};

// Resumen semanal generado por IA (Edge Function project-weekly-digest, ver
// docs/ARQUITECTURA.md "Reportes automáticos con IA") — métricas siempre
// calculadas en TS/SQL, la IA solo redacta el resumen y compara contra el
// snapshot anterior (filosofía anti-fake, docs/PATRONES.md).
export type ProjectDigestMetrics = {
  tasksTotal: number;
  tasksCompleted: number;
  tasksActive: number;
  tasksOverdue: number;
  tasksBlocked: number;
  progressPercent: number;
};

export type ProjectDigestContent = {
  summary: string;
  metrics: ProjectDigestMetrics;
  previousMetrics: ProjectDigestMetrics | null;
};

export type Project = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  color: string;
  iconUrl: string | null;
  status: ProjectStatus;
  leaderId: string | null;
  firstSteps: string[];
  goals: string[];
  areas: string[];
  createdBy: string;
  createdAt: string;
  members: ProjectMemberProfile[];
  teams: Team[];
  lastDigestContent: ProjectDigestContent | null;
  lastDigestAt: string | null;
};

export async function listProjects(organizationId: string) {
  const { data: projectRows, error: projectsError } = await supabase
    .from("projects")
    .select(
      "id, organization_id, name, description, color, icon_url, status, leader_id, first_steps, goals, areas, created_by, created_at, last_digest_content, last_digest_at"
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (projectsError) return { data: [] as Project[], error: projectsError };

  const projectIds = (projectRows ?? []).map((p) => p.id);
  const safeProjectIds = projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"];

  const { data: memberRows, error: membersError } = await supabase
    .from("project_members")
    .select("project_id, user_id, role_in_team")
    .in("project_id", safeProjectIds);

  if (membersError) return { data: [] as Project[], error: membersError };

  const memberUserIds = Array.from(new Set((memberRows ?? []).map((m) => m.user_id)));

  const { data: profileRows, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, nickname, avatar_url, avatar_color")
    .in("id", memberUserIds.length ? memberUserIds : ["00000000-0000-0000-0000-000000000000"]);

  if (profilesError) return { data: [] as Project[], error: profilesError };

  const { data: projectTeamRows, error: projectTeamsError } = await supabase
    .from("project_teams")
    .select("project_id, team_id")
    .in("project_id", safeProjectIds);

  if (projectTeamsError) return { data: [] as Project[], error: projectTeamsError };

  const teamIds = Array.from(new Set((projectTeamRows ?? []).map((pt) => pt.team_id)));
  const { data: teams, error: teamsError } = await getTeamsByIds(teamIds);
  if (teamsError) return { data: [] as Project[], error: teamsError };

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]));

  const projects: Project[] = (projectRows ?? []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    color: row.color,
    iconUrl: row.icon_url,
    status: row.status as ProjectStatus,
    leaderId: row.leader_id,
    firstSteps: row.first_steps ?? [],
    goals: row.goals ?? [],
    areas: row.areas ?? [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    members: (memberRows ?? [])
      .filter((m) => m.project_id === row.id)
      .map((m) => {
        const profile = profileById.get(m.user_id);
        return {
          userId: m.user_id,
          name: profile?.nickname || profile?.full_name || "Miembro",
          avatarUrl: profile?.avatar_url ?? null,
          avatarColor: profile?.avatar_color ?? "#2563EB",
          roleInTeam: m.role_in_team,
        };
      }),
    teams: (projectTeamRows ?? [])
      .filter((pt) => pt.project_id === row.id)
      .map((pt) => teamById.get(pt.team_id))
      .filter((t): t is Team => !!t),
    lastDigestContent: row.last_digest_content ?? null,
    lastDigestAt: row.last_digest_at,
  }));

  return { data: projects, error: null };
}

export async function createProject(params: {
  organizationId: string;
  createdBy: string;
  name: string;
  description?: string | null;
  color: string;
  iconUrl?: string | null;
  goals?: string[];
  areas?: string[];
  teamIds?: string[];
}) {
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      organization_id: params.organizationId,
      created_by: params.createdBy,
      name: params.name,
      description: params.description ?? null,
      color: params.color,
      icon_url: params.iconUrl ?? null,
      goals: params.goals ?? [],
      areas: params.areas ?? [],
      status: "planning",
    })
    .select("id")
    .single();

  if (error || !project) return { data: null, error };

  const teamIds = params.teamIds ?? [];
  if (teamIds.length) {
    const { error: teamsError } = await supabase
      .from("project_teams")
      .insert(teamIds.map((teamId) => ({ project_id: project.id, team_id: teamId })));
    if (teamsError) return { data: project, error: teamsError };

    for (const teamId of teamIds) {
      await notifyProjectTeamAssigned(teamId, params.name, params.organizationId);
    }
  }

  await logActivity({
    organizationId: params.organizationId,
    actorId: params.createdBy,
    action: "project_created",
    entityType: "project",
    entityName: params.name,
    entityId: project.id,
    projectId: project.id,
  });

  return { data: project, error: null };
}

export async function createProjectFromSuggestion(
  organizationId: string,
  createdBy: string,
  color: string,
  suggestion: TeamSuggestion
) {
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      organization_id: organizationId,
      created_by: createdBy,
      name: suggestion.projectName,
      color,
      status: "planning",
      leader_id: suggestion.leader.userId,
      first_steps: suggestion.firstSteps,
    })
    .select("id")
    .single();

  if (error || !project) return { data: null, error };

  const members = [
    { project_id: project.id, user_id: suggestion.leader.userId, role_in_team: "Líder" },
    ...suggestion.team.map((m) => ({
      project_id: project.id,
      user_id: m.userId,
      role_in_team: m.roleInTeam,
    })),
  ];

  const { error: membersError } = await supabase.from("project_members").insert(members);
  if (membersError) return { data: project, error: membersError };

  const addedByName = await getDisplayName(createdBy);
  for (const m of members) {
    await notifyProjectMemberAdded(m.user_id, suggestion.projectName, addedByName, organizationId);
  }

  await logActivity({
    organizationId,
    actorId: createdBy,
    action: "project_created",
    entityType: "project",
    entityName: suggestion.projectName,
    entityId: project.id,
    projectId: project.id,
  });

  return { data: project, error: null };
}

export async function updateProjectStatus(projectId: string, status: ProjectStatus) {
  const { data: before } = await supabase.from("projects").select("organization_id, name, status").eq("id", projectId).maybeSingle();
  const { error } = await supabase.from("projects").update({ status }).eq("id", projectId);

  if (!error && before) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await logActivity({
        organizationId: before.organization_id,
        actorId: user.id,
        action: "project_status_changed",
        entityType: "project",
        entityName: before.name,
        entityId: projectId,
        projectId,
        metadata: {
          toStatus: status,
          toLabel: STATUS_LABELS[status],
          fromStatus: before.status,
          fromLabel: STATUS_LABELS[before.status as ProjectStatus],
        },
      });
    }
  }

  return { error };
}

export async function updateProject(
  projectId: string,
  updates: Partial<{
    name: string;
    description: string | null;
    color: string;
    iconUrl: string | null;
    goals: string[];
    areas: string[];
    firstSteps: string[];
  }>
) {
  const { error } = await supabase
    .from("projects")
    .update({
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.color !== undefined && { color: updates.color }),
      ...(updates.iconUrl !== undefined && { icon_url: updates.iconUrl }),
      ...(updates.goals !== undefined && { goals: updates.goals }),
      ...(updates.areas !== undefined && { areas: updates.areas }),
      ...(updates.firstSteps !== undefined && { first_steps: updates.firstSteps }),
    })
    .eq("id", projectId);

  return { error };
}

// Convierte un "primer paso" sugerido por El Semillero en una task real del
// proyecto (docs/ARQUITECTURA.md: "Pendiente: que los primeros pasos se
// conviertan en tasks reales, no solo texto guardado en projects.first_steps").
// Al lograrlo, lo quita de first_steps — así ese array funciona como la lista
// de sugerencias TODAVÍA no convertidas, sin necesitar una columna nueva para
// "marcar" cuáles ya se usaron.
export async function convertFirstStepToTask(project: Project, step: string, createdBy: string) {
  const { error: taskError } = await createTask({
    projectId: project.id,
    createdBy,
    title: step,
  });
  if (taskError) return { error: taskError };

  const remaining = project.firstSteps.filter((s) => s !== step);
  const { error } = await updateProject(project.id, { firstSteps: remaining });
  return { error };
}

// Reemplaza la lista completa de equipos asignados al proyecto (mismo patrón
// que setTeamMembers en teams.ts) — borra y vuelve a insertar en vez de
// diffear, porque project_teams no guarda más que el vínculo project<->team.
export async function setProjectTeams(projectId: string, teamIds: string[]) {
  // Igual que setTeamMembers en teams.ts: se guarda quién ya estaba vinculado
  // antes de borrar, para avisar (4.2) solo a los equipos REALMENTE nuevos.
  const { data: beforeRows } = await supabase.from("project_teams").select("team_id").eq("project_id", projectId);
  const beforeTeamIds = new Set((beforeRows ?? []).map((r) => r.team_id));

  const { error: deleteError } = await supabase.from("project_teams").delete().eq("project_id", projectId);
  if (deleteError) return { error: deleteError };

  if (teamIds.length) {
    const rows = teamIds.map((teamId) => ({ project_id: projectId, team_id: teamId }));
    const { error } = await supabase.from("project_teams").insert(rows);
    if (error) return { error };
  }

  const newlyLinkedTeamIds = teamIds.filter((id) => !beforeTeamIds.has(id));
  if (newlyLinkedTeamIds.length) {
    const { data: project } = await supabase.from("projects").select("name, organization_id").eq("id", projectId).maybeSingle();
    if (project) {
      for (const teamId of newlyLinkedTeamIds) {
        await notifyProjectTeamAssigned(teamId, project.name, project.organization_id);
      }
    }
  }

  return { error: null };
}

export async function deleteProject(projectId: string) {
  const { data: before } = await supabase.from("projects").select("organization_id, name").eq("id", projectId).maybeSingle();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);

  if (!error && before) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // Sin project_id: la fila del proyecto ya no existe, y esa columna es
      // una FK real (on delete set null) — insertar un id inexistente ahí
      // violaría la constraint.
      await logActivity({
        organizationId: before.organization_id,
        actorId: user.id,
        action: "project_deleted",
        entityType: "project",
        entityName: before.name,
      });
    }
  }

  return { error };
}

// Proyectos en los que el usuario trabaja — de solo lectura en ProfileScreen
// (Punto 1 del feedback). "Trabaja en" = miembro directo (project_members) O
// integrante de algún equipo asignado al proyecto (project_teams). Reusa
// listProjects en vez de duplicar la hidratación de miembros/equipos.
export async function listMyProjects(organizationId: string, userId: string) {
  const { data: allProjects, error } = await listProjects(organizationId);
  if (error) return { data: [] as Project[], error };
  return {
    data: allProjects.filter(
      (p) => p.members.some((m) => m.userId === userId) || p.teams.some((t) => t.members.some((m) => m.userId === userId))
    ),
    error: null,
  };
}

// "Desde cuándo" trabaja alguien en un proyecto puntual (Punto 1 del
// feedback, click en un proyecto del perfil). Si es miembro directo, es la
// fecha de esa fila; si llegó vía uno o más equipos asignados al proyecto,
// es la fecha MÁS TARDÍA entre "se unió al equipo" y "el equipo se vinculó al
// proyecto" (recién ahí empezó a estar realmente involucrado en ESTE
// proyecto) — y si participa por más de un equipo, la más temprana de esas
// fechas combinadas.
export async function getProjectMembershipSince(projectId: string, userId: string) {
  const { data: directRow, error: directError } = await supabase
    .from("project_members")
    .select("created_at")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (directError) return { data: null as string | null, error: directError };
  if (directRow) return { data: directRow.created_at as string, error: null };

  const { data: projectTeamRows, error: ptError } = await supabase
    .from("project_teams")
    .select("team_id, created_at")
    .eq("project_id", projectId);

  if (ptError) return { data: null as string | null, error: ptError };

  const teamIds = (projectTeamRows ?? []).map((r) => r.team_id);
  if (!teamIds.length) return { data: null as string | null, error: null };

  const { data: teamMemberRows, error: tmError } = await supabase
    .from("team_members")
    .select("team_id, created_at")
    .in("team_id", teamIds)
    .eq("user_id", userId);

  if (tmError) return { data: null as string | null, error: tmError };
  if (!teamMemberRows?.length) return { data: null as string | null, error: null };

  const linkedAtByTeam = new Map((projectTeamRows ?? []).map((r) => [r.team_id, r.created_at as string]));
  const dates = teamMemberRows.map((tm) => {
    const linkedAt = linkedAtByTeam.get(tm.team_id)!;
    return tm.created_at > linkedAt ? (tm.created_at as string) : linkedAt;
  });
  dates.sort();
  return { data: dates[0], error: null };
}

export async function countProjects(organizationId: string) {
  const { count, error } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  return { count: count ?? 0, error };
}
