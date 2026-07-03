import { supabase } from "./supabase";

// Log de actividad de la organización — curado, no exhaustivo: se registran
// creaciones y cambios de estado clave (ver docs/ESTADO.md), no cada edición
// de campo. Self-contained (mismo criterio que el resto de lib/*.ts): cada
// función que loguea resuelve lo que le falta (organization_id, nombres,
// actor) con una consulta liviana en vez de exigirle ese contexto a cada
// pantalla que ya llama a createProject/updateTaskStatus/etc.
export type ActivityAction =
  | "project_created"
  | "project_status_changed"
  | "project_deleted"
  | "team_created"
  | "team_deleted"
  | "task_created"
  | "task_status_changed"
  | "task_deleted"
  | "task_comment_created"
  | "badge_granted"
  | "badge_revoked"
  | "member_joined";

export type ActivityEntityType = "project" | "team" | "task" | "badge" | "member";

export type ActivityEntry = {
  id: string;
  organizationId: string;
  actorId: string | null;
  actorName: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string | null;
  entityName: string;
  projectId: string | null;
  teamId: string | null;
  targetUserId: string | null;
  targetName: string | null;
  metadata: Record<string, any>;
  createdAt: string;
};

type ActivityRow = {
  id: string;
  organization_id: string;
  actor_id: string | null;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string;
  project_id: string | null;
  team_id: string | null;
  target_user_id: string | null;
  target_name: string | null;
  metadata: Record<string, any>;
  created_at: string;
};

function mapRow(row: ActivityRow): ActivityEntry {
  return {
    id: row.id,
    organizationId: row.organization_id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    action: row.action as ActivityAction,
    entityType: row.entity_type as ActivityEntityType,
    entityId: row.entity_id,
    entityName: row.entity_name,
    projectId: row.project_id,
    teamId: row.team_id,
    targetUserId: row.target_user_id,
    targetName: row.target_name,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

// Snapshot del nombre en el momento del log (no un join en cada lectura):
// si la persona más tarde deja la organización, profiles_select_org_members
// ya no dejaría verla al resto — el log seguiría siendo legible igual.
async function resolveDisplayName(userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("full_name, nickname").eq("id", userId).maybeSingle();
  return data?.nickname || data?.full_name || "Alguien";
}

export async function logActivity(params: {
  organizationId: string;
  actorId: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityName: string;
  entityId?: string | null;
  projectId?: string | null;
  teamId?: string | null;
  targetUserId?: string | null;
  metadata?: Record<string, any>;
}) {
  const actorName = await resolveDisplayName(params.actorId);
  const targetName = params.targetUserId ? await resolveDisplayName(params.targetUserId) : null;

  const { error } = await supabase.from("activity_log").insert({
    organization_id: params.organizationId,
    actor_id: params.actorId,
    actor_name: actorName,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    entity_name: params.entityName,
    project_id: params.projectId ?? null,
    team_id: params.teamId ?? null,
    target_user_id: params.targetUserId ?? null,
    target_name: targetName,
    metadata: params.metadata ?? {},
  });

  // Best-effort: si falla el log no debe tumbar la acción principal que ya
  // se completó (crear/borrar/etc.), solo se pierde ese renglón de historial.
  if (error) console.warn("No se pudo registrar la actividad:", error.message);
  return { error };
}

export async function listActivity(params: {
  organizationId: string;
  limit?: number;
  projectId?: string;
  teamId?: string;
  userId?: string; // actor o destinatario (ej. quien recibió un badge)
}) {
  let query = supabase
    .from("activity_log")
    .select(
      "id, organization_id, actor_id, actor_name, action, entity_type, entity_id, entity_name, project_id, team_id, target_user_id, target_name, metadata, created_at"
    )
    .eq("organization_id", params.organizationId)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 50);

  if (params.projectId) query = query.eq("project_id", params.projectId);
  if (params.teamId) query = query.eq("team_id", params.teamId);
  if (params.userId) query = query.or(`actor_id.eq.${params.userId},target_user_id.eq.${params.userId}`);

  const { data, error } = await query;
  if (error) return { data: [] as ActivityEntry[], error };
  return { data: (data ?? []).map(mapRow), error: null };
}

// Texto de la acción, sin el nombre del actor (eso lo antepone quien renderiza,
// ver ActivityRow.tsx) — todo lo que hace falta ya viene resuelto en el
// entry (entityName/targetName/metadata.toLabel), sin imports cruzados hacia
// projects.ts/tasks.ts/badges.ts para evitar dependencias circulares.
export function describeActivity(entry: ActivityEntry): string {
  switch (entry.action) {
    case "project_created":
      return `creó el proyecto "${entry.entityName}"`;
    case "project_status_changed":
      return `cambió el estado de "${entry.entityName}" a ${entry.metadata.toLabel ?? entry.metadata.toStatus}`;
    case "project_deleted":
      return `borró el proyecto "${entry.entityName}"`;
    case "team_created":
      return `creó el equipo "${entry.entityName}"`;
    case "team_deleted":
      return `borró el equipo "${entry.entityName}"`;
    case "task_created":
      return `creó la tarea "${entry.entityName}"`;
    case "task_status_changed":
      if (entry.metadata.toStatus === "completed") return `completó la tarea "${entry.entityName}"`;
      return `cambió el estado de "${entry.entityName}" a ${entry.metadata.toLabel ?? entry.metadata.toStatus}`;
    case "task_deleted":
      return `borró la tarea "${entry.entityName}"`;
    case "task_comment_created":
      return `comentó en la tarea "${entry.entityName}"`;
    case "badge_granted":
      return `le otorgó el badge "${entry.entityName}" a ${entry.targetName ?? "alguien"}`;
    case "badge_revoked":
      return `le quitó el badge "${entry.entityName}" a ${entry.targetName ?? "alguien"}`;
    case "member_joined":
      return `se unió a la organización`;
    default:
      return entry.action;
  }
}
