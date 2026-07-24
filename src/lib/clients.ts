import { supabase } from "./supabase";
import { uploadFile } from "./icons";
import { logClientActivity } from "./clientActivity";
import { getDisplayName, notifyClientRequestCreated } from "./emails";

// Módulo de Clientes (docs/CLIENTE.md) — capa de datos para lo que todavía
// era placeholder: asignación de staff, chat persistente y solicitudes. Ver
// lib/spaces.ts para lo ya construido (código de cliente, unirse, listar
// espacios). Tablas paralelas a las de organización a propósito (ver el
// comentario grande en schema.sql, sección "Módulo de Clientes") — nunca
// tocan organization_members/my_organization_ids().

export type ClientAssigneeInfo =
  | { type: "user"; userId: string; name: string; avatarUrl: string | null; avatarColor: string }
  | { type: "team"; teamId: string; name: string; color: string; iconUrl: string | null };

export type OrgClient = {
  userId: string;
  organizationId: string;
  name: string;
  avatarUrl: string | null;
  avatarColor: string;
  joinedAt: string;
  assignment: ClientAssigneeInfo | null;
};

async function hydrateAssignments(organizationId: string, clientUserIds: string[]): Promise<Map<string, ClientAssigneeInfo>> {
  const map = new Map<string, ClientAssigneeInfo>();
  if (!clientUserIds.length) return map;

  const { data: rows } = await supabase
    .from("client_assignments")
    .select("client_user_id, assigned_user_id, assigned_team_id, created_at")
    .eq("organization_id", organizationId)
    .in("client_user_id", clientUserIds)
    .is("unassigned_at", null)
    .order("created_at", { ascending: false });

  if (!rows) return map;

  // Puede haber más de una fila "activa" por cliente solo si dos
  // reasignaciones se hicieron sin cerrar la anterior (no debería pasar si
  // siempre se usa assignClient de acá abajo) — nos quedamos con la más
  // reciente por si acaso, ya ordenado desc.
  const latestByClient = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latestByClient.has(row.client_user_id)) latestByClient.set(row.client_user_id, row);
  }

  const userIds = Array.from(latestByClient.values())
    .map((r) => r.assigned_user_id)
    .filter((id): id is string => !!id);
  const teamIds = Array.from(latestByClient.values())
    .map((r) => r.assigned_team_id)
    .filter((id): id is string => !!id);

  const [{ data: profiles }, { data: teams }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, nickname, avatar_url, avatar_color")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase
      .from("teams")
      .select("id, name, color, icon_url")
      .in("id", teamIds.length ? teamIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));

  latestByClient.forEach((row, clientUserId) => {
    if (row.assigned_user_id) {
      const p = profileById.get(row.assigned_user_id);
      map.set(clientUserId, {
        type: "user",
        userId: row.assigned_user_id,
        name: p?.nickname || p?.full_name || "Miembro",
        avatarUrl: p?.avatar_url ?? null,
        avatarColor: p?.avatar_color ?? "#2C7BD1",
      });
    } else if (row.assigned_team_id) {
      const t = teamById.get(row.assigned_team_id);
      map.set(clientUserId, {
        type: "team",
        teamId: row.assigned_team_id,
        name: t?.name ?? "Equipo",
        color: t?.color ?? "#2C7BD1",
        iconUrl: t?.icon_url ?? null,
      });
    }
  });

  return map;
}

// Roster de clientes de la organización (lado staff) — solo el owner puede
// ver todos (organization_clients_select_owner); un encargado ve, vía
// client_space_is_staff en cada tabla del módulo, solo los clientes que
// tiene asignados, así que este listado completo es específicamente para
// la pantalla de gestión del owner.
export async function listOrgClients(organizationId: string) {
  const { data: rows, error } = await supabase
    .from("organization_clients")
    .select("user_id, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) return { data: [] as OrgClient[], error };

  const clientIds = (rows ?? []).map((r) => r.user_id);
  const [{ data: profiles, error: profilesError }, assignmentMap] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, nickname, avatar_url, avatar_color")
      .in("id", clientIds.length ? clientIds : ["00000000-0000-0000-0000-000000000000"]),
    hydrateAssignments(organizationId, clientIds),
  ]);

  if (profilesError) return { data: [] as OrgClient[], error: profilesError };

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const clients: OrgClient[] = (rows ?? []).map((row) => {
    const p = profileById.get(row.user_id);
    return {
      userId: row.user_id,
      organizationId,
      name: p?.nickname || p?.full_name || "Cliente",
      avatarUrl: p?.avatar_url ?? null,
      avatarColor: p?.avatar_color ?? "#2C7BD1",
      joinedAt: row.created_at,
      assignment: assignmentMap.get(row.user_id) ?? null,
    };
  });

  return { data: clients, error: null };
}

export async function getClientAssignment(organizationId: string, clientUserId: string) {
  const map = await hydrateAssignments(organizationId, [clientUserId]);
  return map.get(clientUserId) ?? null;
}

// Mismo patrón que countTeams (lib/teams.ts) — para el tile "Clientes" del
// Dashboard. La RLS de organization_clients ya acota sola: el owner cuenta
// todos los clientes, un encargado no-owner cuenta solo los suyos.
export async function countOrgClients(organizationId: string) {
  const { count, error } = await supabase
    .from("organization_clients")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  return { count: count ?? 0, error };
}

// Reasignar: cierra (unassigned_at) cualquier asignación activa e inserta
// una nueva — APPEND-ONLY a propósito (docs/CLIENTE.md §4: el historial de
// quién atendió a un cliente nunca se reescribe). Solo el owner puede llamar
// esto (RLS client_assignments_insert_owner/update_owner).
export async function assignClient(params: {
  organizationId: string;
  clientUserId: string;
  assignedBy: string;
  target: { type: "user"; userId: string } | { type: "team"; teamId: string };
}) {
  const { organizationId, clientUserId, assignedBy, target } = params;

  const { data: activeRows } = await supabase
    .from("client_assignments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("client_user_id", clientUserId)
    .is("unassigned_at", null);

  if (activeRows?.length) {
    const { error: closeError } = await supabase
      .from("client_assignments")
      .update({ unassigned_at: new Date().toISOString() })
      .in(
        "id",
        activeRows.map((r) => r.id)
      );
    if (closeError) return { error: closeError };
  }

  const { error } = await supabase.from("client_assignments").insert({
    organization_id: organizationId,
    client_user_id: clientUserId,
    assigned_by: assignedBy,
    assigned_user_id: target.type === "user" ? target.userId : null,
    assigned_team_id: target.type === "team" ? target.teamId : null,
  });

  if (!error) {
    const entityName =
      target.type === "user"
        ? await getDisplayName(target.userId)
        : (await supabase.from("teams").select("name").eq("id", target.teamId).maybeSingle()).data?.name ?? "un equipo";

    await logClientActivity({
      organizationId,
      clientUserId,
      actorId: assignedBy,
      action: "assignment_changed",
      entityName,
    });
  }

  return { error };
}

// ----------------------------------------------------------------------------
// Chat (client_messages/client_message_reactions) — paralelo casi 1:1 a
// task_comments/task_comment_reactions en lib/tasks.ts, misma UX (burbujas,
// reacciones estilo WhatsApp, respuestas citadas, 4 tipos de adjunto).
// ----------------------------------------------------------------------------

export type ClientMessageAttachmentType = "image" | "file" | "link" | "date";
export type ClientMessageAttachment = { url: string; type: ClientMessageAttachmentType; name: string | null };
export type ClientReactionType = "like" | "heart" | "dislike" | "question";
export const CLIENT_REACTION_TYPES: ClientReactionType[] = ["like", "heart", "dislike", "question"];

export type ClientMessageReactions = {
  counts: Record<ClientReactionType, number>;
  myReaction: ClientReactionType | null;
};

export type ClientMessage = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
  authorAvatarColor: string;
  attachment: ClientMessageAttachment | null;
  replyTo: { id: string; authorName: string; content: string } | null;
  reactions: ClientMessageReactions;
};

function emptyClientReactions(): ClientMessageReactions {
  return { counts: { like: 0, heart: 0, dislike: 0, question: 0 }, myReaction: null };
}

export async function listClientMessages(organizationId: string, clientUserId: string) {
  const { data: rows, error } = await supabase
    .from("client_messages")
    .select("id, sender_id, content, reply_to_id, attachment_url, attachment_type, attachment_name, created_at")
    .eq("organization_id", organizationId)
    .eq("client_user_id", clientUserId)
    .order("created_at", { ascending: true });

  if (error) return { data: [] as ClientMessage[], error };

  const senderIds = Array.from(new Set((rows ?? []).map((r) => r.sender_id)));
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, nickname, avatar_url, avatar_color")
    .in("id", senderIds.length ? senderIds : ["00000000-0000-0000-0000-000000000000"]);

  if (profilesError) return { data: [] as ClientMessage[], error: profilesError };

  const messageIds = (rows ?? []).map((r) => r.id);
  const { data: reactionRows, error: reactionsError } = await supabase
    .from("client_message_reactions")
    .select("message_id, user_id, reaction")
    .in("message_id", messageIds.length ? messageIds : ["00000000-0000-0000-0000-000000000000"]);

  if (reactionsError) return { data: [] as ClientMessage[], error: reactionsError };

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const reactionsByMessage = new Map<string, ClientMessageReactions>();
  (reactionRows ?? []).forEach((r) => {
    const entry = reactionsByMessage.get(r.message_id) ?? emptyClientReactions();
    entry.counts[r.reaction as ClientReactionType] += 1;
    if (currentUser && r.user_id === currentUser.id) entry.myReaction = r.reaction as ClientReactionType;
    reactionsByMessage.set(r.message_id, entry);
  });

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const rowById = new Map((rows ?? []).map((r) => [r.id, r]));

  const messages: ClientMessage[] = (rows ?? []).map((row) => {
    const profile = profileById.get(row.sender_id);
    const parentRow = row.reply_to_id ? rowById.get(row.reply_to_id) : null;
    const parentProfile = parentRow ? profileById.get(parentRow.sender_id) : null;

    return {
      id: row.id,
      senderId: row.sender_id,
      content: row.content,
      createdAt: row.created_at,
      authorName: profile?.nickname || profile?.full_name || "Alguien",
      authorAvatarUrl: profile?.avatar_url ?? null,
      authorAvatarColor: profile?.avatar_color ?? "#2C7BD1",
      attachment: row.attachment_url
        ? { url: row.attachment_url, type: (row.attachment_type as ClientMessageAttachmentType) ?? "file", name: row.attachment_name }
        : null,
      replyTo: parentRow
        ? { id: parentRow.id, authorName: parentProfile?.nickname || parentProfile?.full_name || "Alguien", content: parentRow.content }
        : null,
      reactions: reactionsByMessage.get(row.id) ?? emptyClientReactions(),
    };
  });

  return { data: messages, error: null };
}

export async function sendClientMessage(params: {
  organizationId: string;
  clientUserId: string;
  senderId: string;
  content: string;
  replyToId?: string | null;
  attachmentUrl?: string | null;
  attachmentType?: ClientMessageAttachmentType | null;
  attachmentName?: string | null;
}) {
  const { error } = await supabase.from("client_messages").insert({
    organization_id: params.organizationId,
    client_user_id: params.clientUserId,
    sender_id: params.senderId,
    content: params.content,
    reply_to_id: params.replyToId ?? null,
    attachment_url: params.attachmentUrl ?? null,
    attachment_type: params.attachmentType ?? null,
    attachment_name: params.attachmentName ?? null,
  });

  return { error };
}

export async function deleteClientMessage(messageId: string) {
  const { error } = await supabase.from("client_messages").delete().eq("id", messageId);
  return { error };
}

// Estilo WhatsApp: una sola reacción por persona por mensaje (toggle/reemplazo).
export async function reactToClientMessage(messageId: string, userId: string, reaction: ClientReactionType) {
  const { data: existing } = await supabase
    .from("client_message_reactions")
    .select("id, reaction")
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.reaction === reaction) {
    const { error } = await supabase.from("client_message_reactions").delete().eq("id", existing.id);
    return { error };
  }

  if (existing) {
    const { error } = await supabase.from("client_message_reactions").update({ reaction }).eq("id", existing.id);
    return { error };
  }

  const { error } = await supabase.from("client_message_reactions").insert({ message_id: messageId, user_id: userId, reaction });
  return { error };
}

export async function uploadClientAttachment(ownerUserId: string, data: ArrayBuffer | File, contentType: string, ext: string) {
  return uploadFile(ownerUserId, data, contentType, ext, "client-attachment");
}

// ----------------------------------------------------------------------------
// Solicitudes (client_requests, docs/CLIENTE.md §8).
// ----------------------------------------------------------------------------

export type ClientRequestStatus = "open" | "in_progress" | "done" | "cancelled";

export const CLIENT_REQUEST_STATUS_LABELS: Record<ClientRequestStatus, string> = {
  open: "Abierta",
  in_progress: "En proceso",
  done: "Resuelta",
  cancelled: "Cancelada",
};

export const CLIENT_REQUEST_STATUS_COLORS: Record<ClientRequestStatus, string> = {
  open: "#2C7BD1",
  in_progress: "#F97316",
  done: "#10B981",
  cancelled: "#94A3B8",
};

export const CLIENT_REQUEST_STATUS_ORDER: ClientRequestStatus[] = ["open", "in_progress", "done", "cancelled"];

export type ClientRequest = {
  id: string;
  organizationId: string;
  clientUserId: string;
  title: string;
  description: string | null;
  status: ClientRequestStatus;
  createdAt: string;
  updatedAt: string;
};

function mapRequestRow(row: any): ClientRequest {
  return {
    id: row.id,
    organizationId: row.organization_id,
    clientUserId: row.client_user_id,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listClientRequests(organizationId: string, clientUserId: string) {
  const { data, error } = await supabase
    .from("client_requests")
    .select("id, organization_id, client_user_id, title, description, status, created_at, updated_at")
    .eq("organization_id", organizationId)
    .eq("client_user_id", clientUserId)
    .order("created_at", { ascending: false });

  if (error) return { data: [] as ClientRequest[], error };
  return { data: (data ?? []).map(mapRequestRow), error: null };
}

// userIds de todo el staff ACTUALMENTE asignado (persona directa, o
// integrantes del equipo asignado) — docs/CLIENTE.md §8: "se notifica por
// email a TODOS los encargados, no solo a uno". Si todavía no hay nadie
// asignado, se avisa al owner (para que la solicitud no quede sin nadie
// enterado). Devuelve userIds, no emails ya resueltos — mismo patrón que el
// resto de notify* en emails.ts, que resuelven sus propios emails vía
// getEmailsForUserIds.
export async function getStaffUserIdsForClient(organizationId: string, clientUserId: string): Promise<string[]> {
  const assignment = await getClientAssignment(organizationId, clientUserId);

  if (assignment?.type === "user") return [assignment.userId];
  if (assignment?.type === "team") {
    const { data: memberRows } = await supabase.from("team_members").select("user_id").eq("team_id", assignment.teamId);
    return (memberRows ?? []).map((m) => m.user_id);
  }

  const { data: org } = await supabase.from("organizations").select("owner_id").eq("id", organizationId).maybeSingle();
  return org?.owner_id ? [org.owner_id] : [];
}

export async function createClientRequest(params: {
  organizationId: string;
  clientUserId: string;
  title: string;
  description?: string | null;
}) {
  const { data, error } = await supabase
    .from("client_requests")
    .insert({
      organization_id: params.organizationId,
      client_user_id: params.clientUserId,
      title: params.title,
      description: params.description ?? null,
    })
    .select("id")
    .single();

  if (!error && data) {
    await logClientActivity({
      organizationId: params.organizationId,
      clientUserId: params.clientUserId,
      actorId: params.clientUserId,
      action: "request_created",
      entityName: params.title,
      entityId: data.id,
    });

    const [staffUserIds, clientName] = await Promise.all([
      getStaffUserIdsForClient(params.organizationId, params.clientUserId),
      getDisplayName(params.clientUserId),
    ]);
    await notifyClientRequestCreated(staffUserIds, params.title, clientName, params.organizationId);
  }

  return { data, error };
}

export async function updateClientRequestStatus(requestId: string, status: ClientRequestStatus, actorId: string) {
  const { data: before } = await supabase
    .from("client_requests")
    .select("organization_id, client_user_id, title, status")
    .eq("id", requestId)
    .maybeSingle();

  const { error } = await supabase.from("client_requests").update({ status, updated_at: new Date().toISOString() }).eq("id", requestId);

  if (!error && before) {
    await logClientActivity({
      organizationId: before.organization_id,
      clientUserId: before.client_user_id,
      actorId,
      action: "request_status_changed",
      entityName: before.title,
      entityId: requestId,
      metadata: { toStatus: status, toLabel: CLIENT_REQUEST_STATUS_LABELS[status], fromStatus: before.status },
    });
  }

  return { error };
}

// El cliente puede cancelar su propia solicitud mientras siga abierta
// (client_requests_update_client_cancel en schema.sql impone lo mismo a
// nivel de RLS, esto es solo la llamada conveniente).
export async function cancelClientRequest(requestId: string, clientUserId: string) {
  return updateClientRequestStatus(requestId, "cancelled", clientUserId);
}
