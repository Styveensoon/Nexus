import { supabase } from "./supabase";
import { CUSTOM_ROLE_VALUE } from "./profiles";
import type { TeamSuggestion } from "./semillero";
import { logActivity } from "./activity";
import { getDisplayName, notifyTeamMembersAdded } from "./emails";

export const TEAM_ROLE_OPTIONS = [
  "Desarrollador/a",
  "Diseñador/a",
  "QA / Testing",
  "Product Manager",
  "Marketing",
  "Soporte / Operaciones",
];

export const CUSTOM_TEAM_ROLE_VALUE = CUSTOM_ROLE_VALUE;
export const TEAM_LEADER_ROLE_LABEL = "Encargado/a";

export type TeamMemberProfile = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  avatarColor: string;
  roleInTeam: string | null;
};

export type Team = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  color: string;
  iconUrl: string | null;
  leaderId: string | null;
  createdBy: string;
  createdAt: string;
  members: TeamMemberProfile[];
};

type TeamRow = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  color: string;
  icon_url: string | null;
  leader_id: string | null;
  created_by: string;
  created_at: string;
};

async function hydrateTeams(teamRows: TeamRow[]) {
  const teamIds = teamRows.map((t) => t.id);

  const { data: memberRows, error: membersError } = await supabase
    .from("team_members")
    .select("team_id, user_id, role_in_team")
    .in("team_id", teamIds.length ? teamIds : ["00000000-0000-0000-0000-000000000000"]);

  if (membersError) return { data: [] as Team[], error: membersError };

  const memberUserIds = Array.from(new Set((memberRows ?? []).map((m) => m.user_id)));

  const { data: profileRows, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, nickname, avatar_url, avatar_color")
    .in("id", memberUserIds.length ? memberUserIds : ["00000000-0000-0000-0000-000000000000"]);

  if (profilesError) return { data: [] as Team[], error: profilesError };

  const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]));

  const teams: Team[] = teamRows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    color: row.color,
    iconUrl: row.icon_url,
    leaderId: row.leader_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    members: (memberRows ?? [])
      .filter((m) => m.team_id === row.id)
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

  return { data: teams, error: null };
}

export async function listTeams(organizationId: string) {
  const { data: teamRows, error } = await supabase
    .from("teams")
    .select("id, organization_id, name, description, color, icon_url, leader_id, created_by, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) return { data: [] as Team[], error };
  return hydrateTeams(teamRows ?? []);
}

export async function getTeamsByIds(teamIds: string[]) {
  if (!teamIds.length) return { data: [] as Team[], error: null };

  const { data: teamRows, error } = await supabase
    .from("teams")
    .select("id, organization_id, name, description, color, icon_url, leader_id, created_by, created_at")
    .in("id", teamIds);

  if (error) return { data: [] as Team[], error };
  return hydrateTeams(teamRows ?? []);
}

export async function createTeam(params: {
  organizationId: string;
  createdBy: string;
  name: string;
  description?: string | null;
  color: string;
  iconUrl?: string | null;
  leaderId?: string | null;
  members: { userId: string; roleInTeam: string | null }[];
}) {
  const { data: team, error } = await supabase
    .from("teams")
    .insert({
      organization_id: params.organizationId,
      created_by: params.createdBy,
      name: params.name,
      description: params.description ?? null,
      color: params.color,
      icon_url: params.iconUrl ?? null,
      leader_id: params.leaderId ?? null,
    })
    .select("id")
    .single();

  if (error || !team) return { data: null, error };

  await logActivity({
    organizationId: params.organizationId,
    actorId: params.createdBy,
    action: "team_created",
    entityType: "team",
    entityName: params.name,
    entityId: team.id,
    teamId: team.id,
  });

  const rows = params.members.map((m) => ({
    team_id: team.id,
    user_id: m.userId,
    role_in_team: m.roleInTeam,
  }));

  if (rows.length) {
    const { error: membersError } = await supabase.from("team_members").insert(rows);
    if (membersError) return { data: team, error: membersError };

    const addedByName = await getDisplayName(params.createdBy);
    await notifyTeamMembersAdded(
      params.members.map((m) => m.userId),
      params.name,
      addedByName,
      params.organizationId
    );
  }

  return { data: team, error: null };
}

export async function createTeamFromSuggestion(
  organizationId: string,
  createdBy: string,
  color: string,
  suggestion: TeamSuggestion
) {
  return createTeam({
    organizationId,
    createdBy,
    name: suggestion.projectName,
    color,
    leaderId: suggestion.leader.userId,
    members: [
      { userId: suggestion.leader.userId, roleInTeam: TEAM_LEADER_ROLE_LABEL },
      ...suggestion.team.map((m) => ({ userId: m.userId, roleInTeam: m.roleInTeam })),
    ],
  });
}

export async function updateTeam(
  teamId: string,
  updates: Partial<{
    name: string;
    description: string | null;
    color: string;
    iconUrl: string | null;
    leaderId: string | null;
  }>
) {
  const { error } = await supabase
    .from("teams")
    .update({
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.color !== undefined && { color: updates.color }),
      ...(updates.iconUrl !== undefined && { icon_url: updates.iconUrl }),
      ...(updates.leaderId !== undefined && { leader_id: updates.leaderId }),
    })
    .eq("id", teamId);

  return { error };
}

export async function setTeamMembers(teamId: string, members: { userId: string; roleInTeam: string | null }[]) {
  // Antes de borrar, se guarda quién ya estaba para poder avisar (3.1) solo a
  // los integrantes REALMENTE nuevos — no a los que ya formaban parte del
  // equipo y solo se están re-guardando en este mismo edit.
  const { data: beforeRows } = await supabase.from("team_members").select("user_id").eq("team_id", teamId);
  const beforeIds = new Set((beforeRows ?? []).map((r) => r.user_id));

  const { error: deleteError } = await supabase.from("team_members").delete().eq("team_id", teamId);
  if (deleteError) return { error: deleteError };

  if (members.length) {
    const rows = members.map((m) => ({ team_id: teamId, user_id: m.userId, role_in_team: m.roleInTeam }));
    const { error } = await supabase.from("team_members").insert(rows);
    if (error) return { error };
  }

  const newlyAdded = members.filter((m) => !beforeIds.has(m.userId));
  if (newlyAdded.length) {
    const [{ data: team }, { data: { user } }] = await Promise.all([
      supabase.from("teams").select("name, organization_id").eq("id", teamId).maybeSingle(),
      supabase.auth.getUser(),
    ]);
    if (team && user) {
      const addedByName = await getDisplayName(user.id);
      await notifyTeamMembersAdded(
        newlyAdded.map((m) => m.userId),
        team.name,
        addedByName,
        team.organization_id
      );
    }
  }

  return { error: null };
}

export async function deleteTeam(teamId: string) {
  const { data: before } = await supabase.from("teams").select("organization_id, name").eq("id", teamId).maybeSingle();
  const { error } = await supabase.from("teams").delete().eq("id", teamId);

  if (!error && before) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await logActivity({
        organizationId: before.organization_id,
        actorId: user.id,
        action: "team_deleted",
        entityType: "team",
        entityName: before.name,
      });
    }
  }

  return { error };
}

// Equipos de los que el usuario es integrante — se muestra de solo lectura
// en ProfileScreen (Punto 1 del feedback), reusa listTeams en vez de duplicar
// la hidratación de miembros con una query aparte.
export async function listMyTeams(organizationId: string, userId: string) {
  const { data: allTeams, error } = await listTeams(organizationId);
  if (error) return { data: [] as Team[], error };
  return { data: allTeams.filter((t) => t.members.some((m) => m.userId === userId)), error: null };
}

export async function countTeams(organizationId: string) {
  const { count, error } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  return { count: count ?? 0, error };
}
