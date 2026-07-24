import { supabase } from "./supabase";

// Correos transaccionales (docs/EMAILS.md) — cada notify* se llama desde
// lib/organizations.ts, teams.ts, projects.ts, tasks.ts o badges.ts justo
// después de que la mutación real ya tuvo éxito, mismo criterio de
// resiliencia que logActivity en activity.ts: si falla el envío, se loguea
// con console.warn y nunca se aborta la acción principal. templateKey debe
// coincidir exactamente con EmailTemplateKey en
// supabase/functions/_shared/email_templates.ts (ese archivo corre en Deno,
// no puede importarse acá).
//
// organizationId es opcional (no todo correo tiene contexto de organización,
// ej. welcome_after_confirm) — cuando se pasa, se resuelve acá el logo y
// nombre del workspace (organizations.logo_url/name) y se inyectan como
// `orgLogoUrl`/`orgLogoName` para que el layout compartido los muestre juntos
// en el cuerpo del correo, sin que cada notify* tenga que repetir esa consulta.
async function sendEmail(
  to: (string | null | undefined)[],
  templateKey: string,
  variables: Record<string, string>,
  organizationId?: string
) {
  const recipients = to.filter((e): e is string => !!e);
  if (!recipients.length) return;

  let orgLogoUrl = "";
  let orgLogoName = "";
  if (organizationId) {
    const { data: org } = await supabase.from("organizations").select("logo_url, name").eq("id", organizationId).maybeSingle();
    orgLogoUrl = org?.logo_url ?? "";
    orgLogoName = org?.name ?? "";
  }

  const { error } = await supabase.functions.invoke("send-email", {
    body: { to: recipients, templateKey, variables: { ...variables, orgLogoUrl, orgLogoName } },
  });

  if (error) console.warn(`No se pudo enviar el correo "${templateKey}":`, error.message);
}

export async function getDisplayName(userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("full_name, nickname").eq("id", userId).maybeSingle();
  return data?.nickname || data?.full_name || "Alguien";
}

async function getEmailsForUserIds(userIds: string[]): Promise<string[]> {
  if (!userIds.length) return [];
  const { data } = await supabase.from("profiles").select("email").in("id", userIds);
  return (data ?? []).map((p) => p.email).filter((e): e is string => !!e);
}

async function getEmailsForTeam(teamId: string): Promise<string[]> {
  const { data: memberRows } = await supabase.from("team_members").select("user_id").eq("team_id", teamId);
  return getEmailsForUserIds((memberRows ?? []).map((m) => m.user_id));
}

// 2.1
export async function notifyOrganizationCreated(ownerId: string, orgName: string, inviteCode: string, organizationId: string) {
  await sendEmail(await getEmailsForUserIds([ownerId]), "org_created", { orgName, inviteCode }, organizationId);
}

// 2.2
export async function notifyOrganizationJoined(userId: string, orgName: string, organizationId: string) {
  await sendEmail(await getEmailsForUserIds([userId]), "org_joined", { orgName }, organizationId);
}

// 3.1
export async function notifyTeamMembersAdded(userIds: string[], teamName: string, addedByName: string, organizationId: string) {
  await sendEmail(await getEmailsForUserIds(userIds), "team_member_added", { teamName, addedByName }, organizationId);
}

// 4.1
export async function notifyProjectMemberAdded(userId: string, projectName: string, addedByName: string, organizationId: string) {
  await sendEmail(await getEmailsForUserIds([userId]), "project_member_added", { projectName, addedByName }, organizationId);
}

// 4.2 (grupal)
export async function notifyProjectTeamAssigned(teamId: string, projectName: string, organizationId: string) {
  const [{ data: teamRow }, emails] = await Promise.all([
    supabase.from("teams").select("name").eq("id", teamId).maybeSingle(),
    getEmailsForTeam(teamId),
  ]);
  await sendEmail(emails, "project_team_assigned", { teamName: teamRow?.name ?? "tu equipo", projectName }, organizationId);
}

// 5.1
export async function notifyTaskAssigned(
  userId: string,
  taskTitle: string,
  projectName: string,
  assignedByName: string,
  dueDate: string | null,
  organizationId: string
) {
  await sendEmail(
    await getEmailsForUserIds([userId]),
    "task_assigned",
    {
      taskTitle,
      projectName,
      assignedByName,
      dueDate: dueDate ? new Date(`${dueDate}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" }) : "",
    },
    organizationId
  );
}

// 5.2 (grupal)
export async function notifyTaskTeamAssigned(teamId: string, taskTitle: string, projectName: string, organizationId: string) {
  await sendEmail(await getEmailsForTeam(teamId), "task_team_assigned", { taskTitle, projectName }, organizationId);
}

// 5.3
export async function notifyTaskCollaboratorAdded(userId: string, taskTitle: string, addedByName: string, organizationId: string) {
  await sendEmail(await getEmailsForUserIds([userId]), "task_collaborator_added", { taskTitle, addedByName }, organizationId);
}

// 5.5 (bloqueada/desbloqueada) — a quien esté asignado (persona, o todo el
// equipo si el asignado es un equipo).
export async function notifyTaskBlockedToggle(
  userIds: string[],
  taskTitle: string,
  toBlocked: boolean,
  changedByName: string,
  organizationId: string
) {
  await sendEmail(
    await getEmailsForUserIds(userIds),
    "task_blocked_toggle",
    { taskTitle, changedByName, toBlocked: toBlocked ? "true" : "false" },
    organizationId
  );
}

// 7.1
export async function notifyBadgeGranted(userId: string, badgeLabel: string, badgeDescription: string, organizationId: string) {
  await sendEmail(await getEmailsForUserIds([userId]), "badge_granted", { badgeLabel, badgeDescription }, organizationId);
}

// docs/CLIENTE.md §8: notifica a TODOS los encargados actuales de un cliente
// (persona directa, o todo el equipo asignado — o el owner si todavía nadie
// fue asignado), no solo a uno.
export async function notifyClientRequestCreated(userIds: string[], requestTitle: string, clientName: string, organizationId: string) {
  await sendEmail(await getEmailsForUserIds(userIds), "client_request_created", { requestTitle, clientName }, organizationId);
}

// docs/CLIENTE.md §7: al cliente, cuando el staff generó/regeneró el
// documento que pidió. Nunca se notifica una regeneración del widget
// Dashboard (§6) — sería ruido, ese es "vivo" pero no dispara correo.
export async function notifyClientDocumentReady(clientUserId: string, documentTitle: string, organizationId: string) {
  await sendEmail(await getEmailsForUserIds([clientUserId]), "client_document_ready", { documentTitle }, organizationId);
}

// docs/CLIENTE.md §9: al cliente, cuando el staff sube un entregable nuevo
// para que apruebe/rechace.
export async function notifyClientDeliverableCreated(clientUserId: string, deliverableTitle: string, organizationId: string) {
  await sendEmail(await getEmailsForUserIds([clientUserId]), "client_deliverable_created", { deliverableTitle }, organizationId);
}

// docs/CLIENTE.md §9: "una decisión del cliente retroalimenta el flujo
// interno" — al staff (todos los encargados actuales), cuando el cliente
// aprueba o rechaza un entregable.
export async function notifyStaffDeliverableDecided(
  staffUserIds: string[],
  deliverableTitle: string,
  clientName: string,
  approved: boolean,
  organizationId: string
) {
  await sendEmail(
    await getEmailsForUserIds(staffUserIds),
    "client_deliverable_decided",
    { deliverableTitle, clientName, approved: approved ? "true" : "false" },
    organizationId
  );
}
