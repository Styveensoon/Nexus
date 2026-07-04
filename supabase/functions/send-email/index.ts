// Edge Function genérica de envío de correo transaccional (docs/EMAILS.md),
// llamada desde src/lib/emails.ts después de que la mutación real (ya
// protegida por su propia RLS) tuvo éxito — mismo criterio de "resolver la
// notificación desde la capa de datos" que logActivity en src/lib/activity.ts.
// No dispara auth/user-management por su cuenta: eso vive en Supabase Auth
// (correo de confirmación) y en on-user-confirmed (bienvenida tras confirmar).
//
// Deploy:
//   supabase functions deploy send-email
// Secretos requeridos (ver docs/SETUP.md):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL, SMTP_FROM_NAME
//   APP_URL (opcional — URL de la app para el botón de cada correo)
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildEmailTemplate, EmailTemplateKey } from "../_shared/email_templates.ts";
import { sendSmtpEmail } from "../_shared/smtp.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Función mal configurada (Supabase)" }, 500);

    const token = authHeader.replace("Bearer ", "");

    // Acepta el JWT de un usuario autenticado normal (llamadas desde la app,
    // vía src/lib/emails.ts) o directamente la service role key (llamadas
    // server-a-server, ej. un cron/webhook futuro que reuse este endpoint en
    // vez de mandar el correo directo). La resolución de destinatarios y el
    // criterio de "quién puede notificar a quién" ya ocurrió del lado del
    // cliente antes de llegar acá — mismo nivel de confianza que
    // semillero-chat/badge-suggestions, no hay chequeo adicional de rol acá.
    if (token !== serviceRoleKey) {
      const admin = createClient(supabaseUrl, serviceRoleKey);
      const { data: userData, error: userError } = await admin.auth.getUser(token);
      if (userError || !userData.user) return json({ error: "Sesión inválida" }, 401);
    }

    const body = (await req.json()) as {
      to?: string | string[];
      templateKey?: EmailTemplateKey;
      variables?: Record<string, string>;
    };

    const recipients = Array.isArray(body.to) ? body.to : body.to ? [body.to] : [];
    if (!recipients.length || !body.templateKey) return json({ error: "Datos incompletos" }, 400);

    const { subject, html } = buildEmailTemplate(body.templateKey, body.variables ?? {});
    await sendSmtpEmail(recipients, subject, html);

    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Error inesperado" }, 500);
  }
});
