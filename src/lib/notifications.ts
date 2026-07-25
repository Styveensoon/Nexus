import { supabase } from "./supabase";

// Centro de notificaciones IN-APP (campanita en la nav, NotificationBell.tsx)
// — paralelo a los correos transaccionales (docs/EMAILS.md), nunca los
// reemplaza. pushNotification se llama desde los mismos notify* de
// src/lib/emails.ts, justo después de que sendEmail ya se disparó, mismo
// criterio de resiliencia: si falla el insert, no aborta la mutación
// principal, solo console.warn. Acotado a propósito a eventos "core" de la
// organización (equipos/proyectos/tasks/badges) — el Módulo de Clientes y una
// notificación genérica de "tu home cambió" quedan fuera, ver docs/ESTADO.md.
export type NotificationType =
  | "team_member_added"
  | "project_member_added"
  | "project_team_assigned"
  | "task_assigned"
  | "task_team_assigned"
  | "task_collaborator_added"
  | "task_blocked_toggle"
  | "badge_granted"
  | "automation_triggered";

export type AppNotification = {
  id: string;
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  projectId: string | null;
  read: boolean;
  createdAt: string;
};

const COLUMNS = "id, organization_id, user_id, type, title, body, entity_type, entity_id, project_id, read, created_at";

function mapRow(row: any): AppNotification {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    entityType: row.entity_type,
    entityId: row.entity_id,
    projectId: row.project_id,
    read: row.read,
    createdAt: row.created_at,
  };
}

export async function pushNotification(
  organizationId: string,
  userIds: string[],
  type: NotificationType,
  title: string,
  body: string,
  extra?: { projectId?: string | null; entityType?: string; entityId?: string }
) {
  const uniqueIds = Array.from(new Set(userIds.filter((id): id is string => !!id)));
  if (!uniqueIds.length) return;

  const rows = uniqueIds.map((userId) => ({
    organization_id: organizationId,
    user_id: userId,
    type,
    title,
    body,
    project_id: extra?.projectId ?? null,
    entity_type: extra?.entityType ?? null,
    entity_id: extra?.entityId ?? null,
  }));

  const { error } = await supabase.from("notifications").insert(rows);
  if (error) console.warn(`No se pudo crear la notificación "${type}":`, error.message);
}

export async function listNotifications(userId: string, limit = 30) {
  const { data, error } = await supabase
    .from("notifications")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return { data: (data ?? []).map(mapRow), error };
}

export async function countUnreadNotifications(userId: string) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  return { count: count ?? 0, error };
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  return { error };
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
  return { error };
}
