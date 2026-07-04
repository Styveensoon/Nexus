// Correo 1.2 de docs/EMAILS.md ("Bienvenida tras confirmar") — a diferencia
// del resto de correos (disparados desde src/lib/*.ts después de una
// mutación), este no lo dispara ninguna acción de la app: Supabase Auth
// confirma el correo por su cuenta cuando el usuario toca el link del email
// de confirmación (1.1, que Supabase ya manda solo, sin código nuestro).
//
// Requiere un Database Webhook configurado a mano en el dashboard de Supabase
// (Database → Webhooks) — no vía schema.sql, porque el webhook necesita la
// service role key en un header y esa key nunca debe vivir en un archivo
// versionado en git:
//   Tabla: auth.users (schema "auth")
//   Evento: UPDATE
//   Tipo: HTTP Request → esta función (supabase functions deploy on-user-confirmed)
//   Header extra: Authorization: Bearer <tu Service Role Key>
//
// Supabase dispara el webhook en CUALQUIER UPDATE de auth.users (login,
// refresh de token, etc.), no solo al confirmar — por eso la función chequea
// explícitamente la transición null -> con fecha antes de enviar nada.
//
// Deploy:
//   supabase functions deploy on-user-confirmed
import { buildEmailTemplate } from "../_shared/email_templates.ts";
import { sendSmtpEmail } from "../_shared/smtp.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const payload = (await req.json()) as {
      record?: { email?: string; email_confirmed_at?: string | null; raw_user_meta_data?: { full_name?: string } };
      old_record?: { email_confirmed_at?: string | null };
    };

    const wasUnconfirmed = !payload.old_record?.email_confirmed_at;
    const isNowConfirmed = !!payload.record?.email_confirmed_at;

    if (!wasUnconfirmed || !isNowConfirmed) {
      return json({ skipped: true });
    }

    const email = payload.record?.email;
    if (!email) return json({ skipped: true, reason: "sin email" });

    const fullName = payload.record?.raw_user_meta_data?.full_name || "";
    const { subject, html } = buildEmailTemplate("welcome_after_confirm", { name: fullName || "por aquí" });
    await sendSmtpEmail([email], subject, html);

    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Error inesperado" }, 500);
  }
});
