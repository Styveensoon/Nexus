import { supabase } from "./supabase";

// Log de actividad del espacio de un cliente — paralelo a activity.ts pero
// apuntando a client_activity_log (tabla separada a propósito, ver
// docs/CLIENTE.md y la nota en schema.sql: activity_log_insert_self depende
// de my_organization_ids(), que un cliente nunca integra). Curado, sin
// "message_sent" — el chat es su propio registro.
export type ClientActivityAction =
  | "client_joined"
  | "assignment_changed"
  | "request_created"
  | "request_status_changed"
  | "deliverable_created"
  | "deliverable_approved"
  | "deliverable_rejected"
  | "home_section_created"
  | "home_section_regenerated"
  | "document_created"
  | "document_regenerated";

export type ClientActivityEntry = {
  id: string;
  organizationId: string;
  clientUserId: string;
  actorId: string | null;
  actorName: string;
  action: ClientActivityAction;
  entityId: string | null;
  entityName: string;
  metadata: Record<string, any>;
  createdAt: string;
};

type ClientActivityRow = {
  id: string;
  organization_id: string;
  client_user_id: string;
  actor_id: string | null;
  actor_name: string;
  action: string;
  entity_id: string | null;
  entity_name: string;
  metadata: Record<string, any>;
  created_at: string;
};

function mapRow(row: ClientActivityRow): ClientActivityEntry {
  return {
    id: row.id,
    organizationId: row.organization_id,
    clientUserId: row.client_user_id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    action: row.action as ClientActivityAction,
    entityId: row.entity_id,
    entityName: row.entity_name,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

async function resolveDisplayName(userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("full_name, nickname").eq("id", userId).maybeSingle();
  return data?.nickname || data?.full_name || "Alguien";
}

export async function logClientActivity(params: {
  organizationId: string;
  clientUserId: string;
  actorId: string;
  action: ClientActivityAction;
  entityName: string;
  entityId?: string | null;
  metadata?: Record<string, any>;
}) {
  const actorName = await resolveDisplayName(params.actorId);

  const { error } = await supabase.from("client_activity_log").insert({
    organization_id: params.organizationId,
    client_user_id: params.clientUserId,
    actor_id: params.actorId,
    actor_name: actorName,
    action: params.action,
    entity_id: params.entityId ?? null,
    entity_name: params.entityName,
    metadata: params.metadata ?? {},
  });

  // Best-effort, mismo criterio que logActivity: nunca tumba la acción principal.
  if (error) console.warn("No se pudo registrar la actividad del cliente:", error.message);
  return { error };
}

export async function listClientActivity(organizationId: string, clientUserId: string, limit = 50) {
  const { data, error } = await supabase
    .from("client_activity_log")
    .select("id, organization_id, client_user_id, actor_id, actor_name, action, entity_id, entity_name, metadata, created_at")
    .eq("organization_id", organizationId)
    .eq("client_user_id", clientUserId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { data: [] as ClientActivityEntry[], error };
  return { data: (data ?? []).map(mapRow), error: null };
}

export function describeClientActivity(entry: ClientActivityEntry): string {
  switch (entry.action) {
    case "client_joined":
      return `se unió como cliente`;
    case "assignment_changed":
      return `asignó a ${entry.entityName} para atender este espacio`;
    case "request_created":
      return `pidió "${entry.entityName}"`;
    case "request_status_changed":
      return `actualizó el estado de la solicitud "${entry.entityName}" a ${entry.metadata.toLabel ?? entry.metadata.toStatus}`;
    case "deliverable_created":
      return `subió el entregable "${entry.entityName}"`;
    case "deliverable_approved":
      return `aprobó "${entry.entityName}"`;
    case "deliverable_rejected":
      return `rechazó "${entry.entityName}"`;
    case "home_section_created":
      return `agregó la sección "${entry.entityName}"`;
    case "home_section_regenerated":
      return `actualizó la sección "${entry.entityName}"`;
    case "document_created":
      return `generó el documento "${entry.entityName}"`;
    case "document_regenerated":
      return `regeneró el documento "${entry.entityName}"`;
    default:
      return entry.action;
  }
}
