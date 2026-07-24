import { supabase } from "./supabase";
import { listTasksForProjects, Task, isOverdue } from "./tasks";

// Workload Balancer — mapa de carga del equipo (tasks activas/vencidas por
// persona), calculado 100% con datos ya existentes (tasks + team_members),
// mismo criterio de agregación que ya usa badge-suggestions (Edge Function)
// para sus señales de desempeño, pero acá corre client-side porque solo lee
// tasks/team_members, tablas donde cualquier miembro de la organización ya
// tiene RLS de select. Visible en el Dashboard: el owner ve toda la
// organización, un encargado de equipo ve solo los integrantes de los
// equipos que lidera (mismo scoping que is_badge_manager_for).
export type WorkloadEntry = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  avatarColor: string;
  activeTasks: number;
  overdueTasks: number;
};

async function loadTasksForOrganization(organizationId: string): Promise<Task[]> {
  const { data: projectRows } = await supabase.from("projects").select("id").eq("organization_id", organizationId);
  const projectIds = (projectRows ?? []).map((p) => p.id);
  const { data: tasks } = await listTasksForProjects(projectIds);
  return tasks;
}

// memberIds: a quién incluir en el mapa (todos los de la organización para
// el owner, o solo los integrantes de los equipos que lidera un encargado —
// resuelto por el caller, ver getWorkloadForLeader más abajo).
async function buildWorkload(organizationId: string, memberIds: string[]): Promise<{ data: WorkloadEntry[]; error: any }> {
  if (!memberIds.length) return { data: [], error: null };

  const [tasks, { data: teamMemberRows }, { data: profileRows, error: profilesError }] = await Promise.all([
    loadTasksForOrganization(organizationId),
    supabase.from("team_members").select("team_id, user_id"),
    supabase
      .from("profiles")
      .select("id, full_name, nickname, avatar_url, avatar_color")
      .in("id", memberIds),
  ]);

  if (profilesError) return { data: [], error: profilesError };

  // team_id -> [userId, ...], para repartir una task asignada a un equipo
  // entre todos sus integrantes (mismo criterio que listTasksForUser).
  const teamMemberIdsByTeam = new Map<string, string[]>();
  (teamMemberRows ?? []).forEach((row: { team_id: string; user_id: string }) => {
    const arr = teamMemberIdsByTeam.get(row.team_id) ?? [];
    arr.push(row.user_id);
    teamMemberIdsByTeam.set(row.team_id, arr);
  });

  const activeTasks = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");

  const countsByUser = new Map<string, { active: number; overdue: number }>();
  const bump = (userId: string, overdue: boolean) => {
    const entry = countsByUser.get(userId) ?? { active: 0, overdue: 0 };
    entry.active += 1;
    if (overdue) entry.overdue += 1;
    countsByUser.set(userId, entry);
  };

  for (const task of activeTasks) {
    const overdue = isOverdue(task);
    if (task.assignee.type === "user") {
      bump(task.assignee.userId, overdue);
    } else {
      const teamUserIds = teamMemberIdsByTeam.get(task.assignee.teamId) ?? [];
      teamUserIds.forEach((userId) => bump(userId, overdue));
    }
  }

  const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]));

  const entries: WorkloadEntry[] = memberIds.map((userId) => {
    const profile = profileById.get(userId);
    const counts = countsByUser.get(userId) ?? { active: 0, overdue: 0 };
    return {
      userId,
      name: profile?.nickname || profile?.full_name || "Miembro",
      avatarUrl: profile?.avatar_url ?? null,
      avatarColor: profile?.avatar_color ?? "#2563EB",
      activeTasks: counts.active,
      overdueTasks: counts.overdue,
    };
  });

  entries.sort((a, b) => b.activeTasks - a.activeTasks);
  return { data: entries, error: null };
}

// Owner: carga de toda la organización.
export async function getWorkloadForOrganization(organizationId: string) {
  const { data: memberRows, error } = await supabase.from("organization_members").select("user_id").eq("organization_id", organizationId);
  if (error) return { data: [] as WorkloadEntry[], error };
  return buildWorkload(organizationId, (memberRows ?? []).map((m) => m.user_id));
}

// Encargado de equipo (no owner): carga solo de los equipos que lidera —
// mismo scoping que is_badge_manager_for/badge-suggestions.
export async function getWorkloadForLeader(organizationId: string, leaderUserId: string) {
  const { data: ledTeamRows, error: teamsError } = await supabase
    .from("teams")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("leader_id", leaderUserId);
  if (teamsError) return { data: [] as WorkloadEntry[], error: teamsError };

  const teamIds = (ledTeamRows ?? []).map((t) => t.id);
  if (!teamIds.length) return { data: [] as WorkloadEntry[], error: null };

  const { data: teamMemberRows, error: membersError } = await supabase.from("team_members").select("user_id").in("team_id", teamIds);
  if (membersError) return { data: [] as WorkloadEntry[], error: membersError };

  const memberIds = Array.from(new Set((teamMemberRows ?? []).map((m) => m.user_id)));
  return buildWorkload(organizationId, memberIds);
}
