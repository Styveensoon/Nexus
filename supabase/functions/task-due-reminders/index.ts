// Correo 5.4 de docs/EMAILS.md ("Tarea próxima a vencer") — a diferencia del
// resto, no lo dispara ninguna mutación de la app: es un chequeo por tiempo,
// así que necesita un disparador externo. Se invoca desde un cron job de
// Postgres (pg_cron + pg_net, ver el bloque al final de supabase/schema.sql)
// una vez al día, con la service role key como Bearer token.
//
// due_reminder_sent_at (columna nueva en tasks, ver schema.sql) evita mandar
// el mismo aviso dos veces — se resetea a null en src/lib/tasks.ts (updateTask)
// cada vez que alguien mueve la fecha límite, para que si se pospone una
// task ya avisada, vuelva a avisar cuando corresponda con la fecha nueva.
//
// Mismo umbral que DUE_SOON_DAYS en src/lib/tasks.ts (2 días) — si ese valor
// cambia allá, actualizar también acá.
//
// Deploy:
//   supabase functions deploy task-due-reminders
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildEmailTemplate } from "../_shared/email_templates.ts";
import { sendSmtpEmail } from "../_shared/smtp.ts";

const DUE_SOON_DAYS = 2;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Función mal configurada (Supabase)" }, 500);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date().toISOString().slice(0, 10);
    const limit = new Date(Date.now() + DUE_SOON_DAYS * 86400000).toISOString().slice(0, 10);

    const { data: tasks, error } = await admin
      .from("tasks")
      .select("id, title, due_date, assigned_user_id, assigned_team_id, project_id")
      .gte("due_date", today)
      .lte("due_date", limit)
      .is("due_reminder_sent_at", null)
      .neq("status", "completed")
      .neq("status", "cancelled");

    if (error) return json({ error: error.message }, 500);
    if (!tasks?.length) return json({ sent: 0 });

    // Logo de la organización de cada task (para el cuerpo del correo, ver
    // orgLogoUrl en _shared/email_templates.ts) — se resuelve en batch (2
    // queries extra para todo el lote) en vez de una por task.
    const projectIds = Array.from(new Set(tasks.map((t) => t.project_id)));
    const { data: projectRows } = await admin.from("projects").select("id, organization_id").in("id", projectIds);
    const orgIdByProject = new Map((projectRows ?? []).map((p: { id: string; organization_id: string }) => [p.id, p.organization_id]));

    const orgIds = Array.from(new Set(Array.from(orgIdByProject.values())));
    const { data: orgRows } = await admin.from("organizations").select("id, logo_url, name").in("id", orgIds.length ? orgIds : [""]);
    const logoByOrg = new Map((orgRows ?? []).map((o: { id: string; logo_url: string | null }) => [o.id, o.logo_url ?? ""]));
    const nameByOrg = new Map((orgRows ?? []).map((o: { id: string; name: string }) => [o.id, o.name ?? ""]));

    let sent = 0;

    for (const task of tasks) {
      const orgId = orgIdByProject.get(task.project_id) ?? "";
      const orgLogoUrl = logoByOrg.get(orgId) ?? "";
      const orgLogoName = nameByOrg.get(orgId) ?? "";
      const userIds: string[] = [];
      if (task.assigned_user_id) userIds.push(task.assigned_user_id);

      if (task.assigned_team_id) {
        const { data: teamMembers } = await admin.from("team_members").select("user_id").eq("team_id", task.assigned_team_id);
        (teamMembers ?? []).forEach((m: { user_id: string }) => userIds.push(m.user_id));
      }

      if (!userIds.length) continue;

      const { data: profiles } = await admin.from("profiles").select("email").in("id", userIds);
      const emails = (profiles ?? []).map((p: { email: string | null }) => p.email).filter((e): e is string => !!e);
      if (!emails.length) continue;

      const dueDateLabel = new Date(`${task.due_date}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" });
      const { subject, html } = buildEmailTemplate("task_due_soon", {
        taskTitle: task.title,
        dueDate: dueDateLabel,
        orgLogoUrl,
        orgLogoName,
      });

      try {
        await sendSmtpEmail(emails, subject, html);
      } catch (sendErr) {
        // No marca due_reminder_sent_at si falló el envío — se reintenta en
        // la próxima corrida del cron en vez de perder el aviso para siempre.
        console.warn(`No se pudo enviar el recordatorio de "${task.title}":`, sendErr);
        continue;
      }

      await admin.from("tasks").update({ due_reminder_sent_at: new Date().toISOString() }).eq("id", task.id);
      sent += 1;
    }

    return json({ sent });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Error inesperado" }, 500);
  }
});
