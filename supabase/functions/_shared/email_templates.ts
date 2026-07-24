// Catálogo de plantillas de correo transaccional — ver docs/EMAILS.md para el
// texto original de cada una. Layout único reutilizable (header con marca +
// cuerpo + botón + footer, tal como pide "Notas de implementación" en
// EMAILS.md) para no duplicar HTML por cada tipo de correo. Corre en Deno
// (Edge Functions), no puede importar código de src/ — si se agrega un
// template acá, agregar también el `notify*` correspondiente en
// src/lib/emails.ts (client) que arma las `variables` y resuelve destinatarios.
const AZURE = "#2C7BD1"; // mismo acento que el resto de la app, ver docs/PATRONES.md
const BG = "#F1F5FA";
const TEXT_DARK = "#101828";
const TEXT_MUTED = "#5B6472";

// Logo de Nexus (assets/images/nexus-logo.png, 128x128), base64 SIN el
// prefijo "data:" — Gmail (y varios otros clientes) bloquean/no renderizan
// imágenes <img src="data:..."> embebidas en el cuerpo del correo, así que en
// vez de eso se manda como adjunto embebido (cid:nexus-logo) vía nodemailer
// (ver _shared/smtp.ts, que importa esta misma constante para el adjunto) y
// el <img> del header referencia src="cid:nexus-logo" — el método que sí
// soportan de forma consistente los clientes de correo.
export const NEXUS_LOGO_BASE64 =
  "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";

function renderLayout(opts: { title: string; bodyHtml: string; buttonText?: string; orgLogoUrl?: string; orgLogoName?: string }): string {
  const appUrl = Deno.env.get("APP_URL") ?? "#";
  const button = opts.buttonText
    ? `<tr><td style="padding:8px 32px 8px;"><a href="${appUrl}" style="background:${AZURE};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:999px;display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:15px;">${opts.buttonText}</a></td></tr>`
    : "";

  // Logo de LA ORGANIZACIÓN (organizations.logo_url, distinto del logo de
  // Nexus del header) — solo aparece si el correo tiene contexto de una
  // organización con logo cargado (ver getOrgLogoUrl en src/lib/emails.ts).
  // No confundir con primaryColor/orgColor de docs/PATRONES.md: acá sí
  // corresponde mostrar la marca del workspace, es justamente el lugar
  // pensado para eso.
  const orgLogoBlock = opts.orgLogoUrl
    ? `<tr><td align="center" style="padding:24px 32px 0;text-align:center;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
          <td style="vertical-align:middle;padding-right:10px;"><img src="${opts.orgLogoUrl}" alt="Logo de tu organización" style="max-height:40px;max-width:120px;border-radius:6px;display:block;" /></td>
          ${opts.orgLogoName ? `<td style="vertical-align:middle;"><span style="font-size:19px;font-weight:700;color:${TEXT_DARK};font-family:Arial,Helvetica,sans-serif;">${opts.orgLogoName}</span></td>` : ""}
        </tr></table>
      </td></tr>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${BG};font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="background:${AZURE};padding:20px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;padding-right:10px;">
                      <img src="cid:nexus-logo" width="28" height="28" alt="Nexus" style="display:block;border-radius:6px;" />
                    </td>
                    <td style="vertical-align:middle;">
                      <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.3px;font-family:Arial,Helvetica,sans-serif;">Nexus</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${orgLogoBlock}
            <tr>
              <td style="padding:24px 32px 8px;">
                <h1 style="margin:0 0 12px;font-size:20px;color:${TEXT_DARK};font-family:Arial,Helvetica,sans-serif;">${opts.title}</h1>
                <div style="font-size:15px;line-height:1.6;color:${TEXT_MUTED};font-family:Arial,Helvetica,sans-serif;">${opts.bodyHtml}</div>
              </td>
            </tr>
            ${button}
            <tr>
              <td style="padding:28px 32px;border-top:1px solid #EEF2F7;">
                <span style="font-size:12px;color:#94A3B8;font-family:Arial,Helvetica,sans-serif;">Nexus · gestión de proyectos con IA local</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Debe reflejar exactamente las mismas keys que usa src/lib/emails.ts al
// llamar a la Edge Function `send-email` (documentado ahí también).
export type EmailTemplateKey =
  | "welcome_after_confirm"
  | "org_created"
  | "org_joined"
  | "team_member_added"
  | "project_member_added"
  | "project_team_assigned"
  | "task_assigned"
  | "task_team_assigned"
  | "task_collaborator_added"
  | "task_due_soon"
  | "task_blocked_toggle"
  | "badge_granted"
  | "client_request_created"
  | "client_document_ready"
  | "client_deliverable_created"
  | "client_deliverable_decided"
  | "project_weekly_digest";

export function buildEmailTemplate(key: EmailTemplateKey, v: Record<string, string>): { subject: string; html: string } {
  // Wrapper que propaga v.orgLogoUrl a cada caso sin tener que repetirlo en
  // los 12 — v.orgLogoUrl ya viene resuelto por sendEmail (src/lib/emails.ts)
  // o por task-due-reminders/index.ts (los dos únicos llamadores).
  const layout = (opts: { title: string; bodyHtml: string; buttonText?: string }) =>
    renderLayout({ ...opts, orgLogoUrl: v.orgLogoUrl, orgLogoName: v.orgLogoName });

  switch (key) {
    case "welcome_after_confirm":
      return {
        subject: `¡Bienvenido a Nexus, ${v.name}!`,
        html: layout({
          title: `¡Bienvenido a Nexus, ${v.name}!`,
          bodyHtml: `Tu cuenta ya está activa. Empieza a organizar tus proyectos o únete a una organización con tu código.`,
          buttonText: "Ir a Nexus",
        }),
      };
    case "org_created":
      return {
        subject: `Tu organización ${v.orgName} está lista`,
        html: layout({
          title: `Tu organización ${v.orgName} está lista`,
          bodyHtml: `Creaste <strong>${v.orgName}</strong> en Nexus. Comparte tu código de organización para invitar a tu equipo:<br/><br/><span style="font-size:22px;font-weight:700;color:${AZURE};letter-spacing:2px;">${v.inviteCode}</span>`,
          buttonText: "Ir a mi organización",
        }),
      };
    case "org_joined":
      return {
        subject: `Te uniste a ${v.orgName}`,
        html: layout({
          title: `Te uniste a ${v.orgName}`,
          bodyHtml: `Ya formas parte de <strong>${v.orgName}</strong> en Nexus.`,
          buttonText: "Ver organización",
        }),
      };
    case "team_member_added":
      return {
        subject: `Ahora formas parte de ${v.teamName}`,
        html: layout({
          title: `Ahora formas parte de ${v.teamName}`,
          bodyHtml: `${v.addedByName} te agregó al equipo <strong>${v.teamName}</strong>.`,
          buttonText: "Ver equipo",
        }),
      };
    case "project_member_added":
      return {
        subject: `Te agregaron al proyecto ${v.projectName}`,
        html: layout({
          title: `Te agregaron al proyecto ${v.projectName}`,
          bodyHtml: `${v.addedByName} te agregó al proyecto <strong>${v.projectName}</strong>.`,
          buttonText: "Ver proyecto",
        }),
      };
    case "project_team_assigned":
      return {
        subject: `Tu equipo ${v.teamName} fue asignado a un nuevo proyecto`,
        html: layout({
          title: `Nuevo proyecto para tu equipo`,
          bodyHtml: `Tu equipo <strong>${v.teamName}</strong> fue asignado al proyecto <strong>${v.projectName}</strong>. Todos los miembros del equipo ahora tienen acceso.`,
          buttonText: "Ver proyecto",
        }),
      };
    case "task_assigned":
      return {
        subject: `Nueva tarea asignada: ${v.taskTitle}`,
        html: layout({
          title: `Nueva tarea asignada`,
          bodyHtml: `${v.assignedByName} te asignó la tarea <strong>${v.taskTitle}</strong> en el proyecto ${v.projectName}.${v.dueDate ? ` Fecha límite: ${v.dueDate}.` : ""}`,
          buttonText: "Ver tarea",
        }),
      };
    case "task_team_assigned":
      return {
        subject: `Nueva tarea para tu equipo: ${v.taskTitle}`,
        html: layout({
          title: `Nueva tarea para tu equipo`,
          bodyHtml: `Se asignó la tarea <strong>${v.taskTitle}</strong> a tu equipo en el proyecto ${v.projectName}.`,
          buttonText: "Ver tarea",
        }),
      };
    case "task_collaborator_added":
      return {
        subject: `Te agregaron a la tarea ${v.taskTitle}`,
        html: layout({
          title: `Te agregaron como colaborador`,
          bodyHtml: `${v.addedByName} te agregó como colaborador en la tarea <strong>${v.taskTitle}</strong>.`,
          buttonText: "Ver tarea",
        }),
      };
    case "task_due_soon":
      return {
        subject: `${v.taskTitle} vence pronto`,
        html: layout({
          title: `${v.taskTitle} vence pronto`,
          bodyHtml: `Tu tarea <strong>${v.taskTitle}</strong> vence el ${v.dueDate}.`,
          buttonText: "Ver tarea",
        }),
      };
    case "task_blocked_toggle": {
      const blocked = v.toBlocked === "true";
      return {
        subject: blocked ? `${v.taskTitle} fue marcada como bloqueada` : `${v.taskTitle} ya no está bloqueada`,
        html: layout({
          title: blocked ? `Tarea bloqueada` : `Tarea desbloqueada`,
          bodyHtml: blocked
            ? `${v.changedByName} marcó <strong>${v.taskTitle}</strong> como bloqueada.`
            : `${v.changedByName} desbloqueó <strong>${v.taskTitle}</strong>.`,
          buttonText: "Ver tarea",
        }),
      };
    }
    case "badge_granted":
      return {
        subject: `¡Ganaste un nuevo badge!`,
        html: layout({
          title: `¡Ganaste un nuevo badge! 🏅`,
          bodyHtml: `<strong>${v.badgeLabel}</strong> — ${v.badgeDescription}. ¡Sigue así!`,
          buttonText: "Ver mis badges",
        }),
      };
    case "client_request_created":
      return {
        subject: `Nueva solicitud de ${v.clientName}`,
        html: layout({
          title: `Nueva solicitud de tu cliente`,
          bodyHtml: `<strong>${v.clientName}</strong> pidió: <strong>${v.requestTitle}</strong>. Respondan a la brevedad.`,
          buttonText: "Ver solicitud",
        }),
      };
    case "client_document_ready":
      return {
        subject: `Tu documento "${v.documentTitle}" está listo`,
        html: layout({
          title: `Tu documento está listo`,
          bodyHtml: `Tu equipo generó <strong>${v.documentTitle}</strong>, ya lo puedes ver dentro de tu solicitud.`,
          buttonText: "Ver documento",
        }),
      };
    case "client_deliverable_created":
      return {
        subject: `Nuevo entregable para revisar: ${v.deliverableTitle}`,
        html: layout({
          title: `Tienes un entregable para revisar`,
          bodyHtml: `Tu equipo compartió <strong>${v.deliverableTitle}</strong> para que lo apruebes o rechaces.`,
          buttonText: "Revisar entregable",
        }),
      };
    case "client_deliverable_decided": {
      const approved = v.approved === "true";
      return {
        subject: approved ? `${v.clientName} aprobó "${v.deliverableTitle}"` : `${v.clientName} rechazó "${v.deliverableTitle}"`,
        html: layout({
          title: approved ? `Entregable aprobado` : `Entregable rechazado`,
          bodyHtml: approved
            ? `<strong>${v.clientName}</strong> aprobó el entregable <strong>${v.deliverableTitle}</strong>.`
            : `<strong>${v.clientName}</strong> rechazó el entregable <strong>${v.deliverableTitle}</strong>. Puede que necesite ajustes.`,
          buttonText: "Ver cliente",
        }),
      };
    }
    case "project_weekly_digest":
      return {
        subject: `Resumen semanal de ${v.projectName}`,
        html: layout({
          title: `Resumen semanal — ${v.projectName}`,
          bodyHtml: `${v.summary}`,
          buttonText: "Ver proyecto",
        }),
      };
    default:
      throw new Error(`Plantilla de correo desconocida: ${key}`);
  }
}
