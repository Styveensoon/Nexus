import { supabase } from "./supabase";
import type { TeamSuggestion } from "./semillero";

export type ProjectStatus = "planning" | "active" | "on_hold" | "completed";

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planeación",
  active: "Activo",
  on_hold: "En pausa",
  completed: "Completado",
};

export const STATUS_ORDER: ProjectStatus[] = ["planning", "active", "on_hold", "completed"];

export type ProjectMemberProfile = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  avatarColor: string;
  roleInTeam: string | null;
};

export type Project = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  color: string;
  status: ProjectStatus;
  leaderId: string | null;
  firstSteps: string[];
  createdBy: string;
  createdAt: string;
  members: ProjectMemberProfile[];
};

export async function listProjects(organizationId: string) {
  const { data: projectRows, error: projectsError } = await supabase
    .from("projects")
    .select("id, organization_id, name, description, color, status, leader_id, first_steps, created_by, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (projectsError) return { data: [] as Project[], error: projectsError };

  const projectIds = (projectRows ?? []).map((p) => p.id);

  const { data: memberRows, error: membersError } = await supabase
    .from("project_members")
    .select("project_id, user_id, role_in_team")
    .in("project_id", projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"]);

  if (membersError) return { data: [] as Project[], error: membersError };

  const memberUserIds = Array.from(new Set((memberRows ?? []).map((m) => m.user_id)));

  const { data: profileRows, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, nickname, avatar_url, avatar_color")
    .in("id", memberUserIds.length ? memberUserIds : ["00000000-0000-0000-0000-000000000000"]);

  if (profilesError) return { data: [] as Project[], error: profilesError };

  const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]));

  const projects: Project[] = (projectRows ?? []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    color: row.color,
    status: row.status as ProjectStatus,
    leaderId: row.leader_id,
    firstSteps: row.first_steps ?? [],
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
  }));

  return { data: projects, error: null };
}

export async function createProject(params: {
  organizationId: string;
  createdBy: string;
  name: string;
  description?: string | null;
  color: string;
}) {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      organization_id: params.organizationId,
      created_by: params.createdBy,
      name: params.name,
      description: params.description ?? null,
      color: params.color,
      status: "planning",
    })
    .select("id")
    .single();

  return { data, error };
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

  return { data: project, error: null };
}

export async function updateProjectStatus(projectId: string, status: ProjectStatus) {
  const { error } = await supabase.from("projects").update({ status }).eq("id", projectId);
  return { error };
}

export async function deleteProject(projectId: string) {
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  return { error };
}
