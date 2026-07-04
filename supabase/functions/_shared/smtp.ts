// Envío real vía el SMTP propio del usuario (mismo servidor que ya configuró
// como SMTP custom de Supabase Auth) — Supabase Auth NO expone ese SMTP a las
// Edge Functions, así que esto habla directo con el servidor usando
// credenciales separadas, cargadas como secretos (nunca hardcodeadas, ver
// docs/SETUP.md para el comando `supabase secrets set` de cada una):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL, SMTP_FROM_NAME
//
// Usa nodemailer (vía `npm:`, igual que @supabase/supabase-js) en vez de la
// librería Deno-nativa `denomailer` — se probó primero con denomailer y falló
// con "invalid cmd" contra Gmail tanto en 587 (STARTTLS) como en 465 (TLS
// directo), consistente con un problema de compatibilidad de esa librería
// (años sin mantenimiento) con la versión de Deno del runtime de Supabase, no
// con la configuración. nodemailer es mucho más madura/probada y ya es un
// patrón común para SMTP dentro de Supabase Edge Functions.
import nodemailer from "npm:nodemailer@6.9.16";
import { NEXUS_LOGO_BASE64 } from "./email_templates.ts";

export async function sendSmtpEmail(to: string[], subject: string, html: string): Promise<void> {
  const host = Deno.env.get("SMTP_HOST");
  const port = Number(Deno.env.get("SMTP_PORT") ?? "587");
  const user = Deno.env.get("SMTP_USER");
  const password = Deno.env.get("SMTP_PASSWORD");
  const fromEmail = Deno.env.get("SMTP_FROM_EMAIL");
  const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "Nexus";

  if (!host || !user || !password || !fromEmail) {
    throw new Error("Función mal configurada: faltan secretos SMTP_HOST/SMTP_USER/SMTP_PASSWORD/SMTP_FROM_EMAIL");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    // 465 = TLS directo (secure). Cualquier otro (587/25) = STARTTLS, que
    // nodemailer negocia solo si el servidor lo anuncia.
    secure: port === 465,
    auth: { user, pass: password },
  });

  // Fallback de texto plano — no necesita fidelidad, solo evita que el correo
  // llegue vacío en clientes que no rendericen HTML.
  const plainTextFallback = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || subject;

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: to.join(", "),
    subject,
    text: plainTextFallback,
    html,
    // Logo de Nexus como adjunto embebido (cid:nexus-logo, referenciado en el
    // <img> del header de email_templates.ts) — no como <img src="data:...">
    // porque Gmail y otros clientes bloquean/no renderizan data URIs inline
    // en el cuerpo del correo, pero sí soportan este método (cid).
    attachments: [
      {
        filename: "nexus-logo.png",
        content: NEXUS_LOGO_BASE64,
        encoding: "base64",
        cid: "nexus-logo",
      },
    ],
  });
}
