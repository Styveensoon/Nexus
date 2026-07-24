import { supabase } from "./supabase";
import { logClientActivity } from "./clientActivity";
import { getDisplayName, notifyClientDeliverableCreated, notifyStaffDeliverableDecided } from "./emails";
import { getStaffUserIdsForClient } from "./clients";

// Aprobaciones (docs/CLIENTE.md §9) — la tabla y el trigger
// enforce_client_deliverable_update ya existían sin ninguna UI (ver
// schema.sql): el cliente SOLO puede pasar pending->approved|rejected (nunca
// tocar contenido), el staff SOLO puede editar contenido mientras siga
// pending (nunca la decisión). Esta capa solo respeta esas columnas.
export type ClientDeliverableStatus = "pending" | "approved" | "rejected";

export const CLIENT_DELIVERABLE_STATUS_LABELS: Record<ClientDeliverableStatus, string> = {
  pending: "Pendiente de tu decisión",
  approved: "Aprobado",
  rejected: "Rechazado",
};

export const CLIENT_DELIVERABLE_STATUS_COLORS: Record<ClientDeliverableStatus, string> = {
  pending: "#F97316",
  approved: "#10B981",
  rejected: "#EF4444",
};

export type ClientDeliverable = {
  id: string;
  organizationId: string;
  clientUserId: string;
  title: string;
  content: string | null;
  attachmentUrl: string | null;
  status: ClientDeliverableStatus;
  createdBy: string;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
};

function mapDeliverableRow(row: any): ClientDeliverable {
  return {
    id: row.id,
    organizationId: row.organization_id,
    clientUserId: row.client_user_id,
    title: row.title,
    content: row.content,
    attachmentUrl: row.attachment_url,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
  };
}

const DELIVERABLE_COLUMNS =
  "id, organization_id, client_user_id, title, content, attachment_url, status, created_by, created_at, decided_by, decided_at";

export async function listClientDeliverables(organizationId: string, clientUserId: string) {
  const { data, error } = await supabase
    .from("client_deliverables")
    .select(DELIVERABLE_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("client_user_id", clientUserId)
    .order("created_at", { ascending: false });

  if (error) return { data: [] as ClientDeliverable[], error };
  return { data: (data ?? []).map(mapDeliverableRow), error: null };
}

export async function createClientDeliverable(params: {
  organizationId: string;
  clientUserId: string;
  title: string;
  content?: string | null;
  attachmentUrl?: string | null;
  createdBy: string;
}) {
  const { data, error } = await supabase
    .from("client_deliverables")
    .insert({
      organization_id: params.organizationId,
      client_user_id: params.clientUserId,
      title: params.title,
      content: params.content ?? null,
      attachment_url: params.attachmentUrl ?? null,
      created_by: params.createdBy,
    })
    .select("id")
    .single();

  if (!error && data) {
    await Promise.all([
      logClientActivity({
        organizationId: params.organizationId,
        clientUserId: params.clientUserId,
        actorId: params.createdBy,
        action: "deliverable_created",
        entityName: params.title,
        entityId: data.id,
      }),
      notifyClientDeliverableCreated(params.clientUserId, params.title, params.organizationId),
    ]);
  }

  return { data, error };
}

// Solo mientras status === 'pending' — el trigger lo impone igual, esto es
// solo la llamada conveniente (mismo criterio que cancelClientRequest).
export async function updateClientDeliverableContent(
  deliverableId: string,
  patch: { title?: string; content?: string | null; attachmentUrl?: string | null }
) {
  const { error } = await supabase
    .from("client_deliverables")
    .update({ title: patch.title, content: patch.content, attachment_url: patch.attachmentUrl })
    .eq("id", deliverableId);
  return { error };
}

// El cliente decide — dispara notificación al staff (docs/CLIENTE.md §9:
// "una decisión del cliente retroalimenta el flujo interno").
export async function decideClientDeliverable(deliverableId: string, clientUserId: string, decision: "approved" | "rejected") {
  const { data: before } = await supabase
    .from("client_deliverables")
    .select("organization_id, client_user_id, title")
    .eq("id", deliverableId)
    .maybeSingle();

  const { error } = await supabase
    .from("client_deliverables")
    .update({ status: decision, decided_by: clientUserId, decided_at: new Date().toISOString() })
    .eq("id", deliverableId);

  if (!error && before) {
    await logClientActivity({
      organizationId: before.organization_id,
      clientUserId: before.client_user_id,
      actorId: clientUserId,
      action: decision === "approved" ? "deliverable_approved" : "deliverable_rejected",
      entityName: before.title,
      entityId: deliverableId,
    });

    const [staffUserIds, clientName] = await Promise.all([
      getStaffUserIdsForClient(before.organization_id, before.client_user_id),
      getDisplayName(clientUserId),
    ]);
    await notifyStaffDeliverableDecided(staffUserIds, before.title, clientName, decision === "approved", before.organization_id);
  }

  return { error };
}
