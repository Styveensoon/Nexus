// Edge Function: resumen semanal de un proyecto, generado por IA
// (docs/ARQUITECTURA.md "Reportes automáticos con IA en lenguaje natural" —
// hasta esta ronda estaba marcado como "No implementado"). Dos modos de
// invocación, mismo patrón que send-email:
//   - Cron semanal (pg_cron + pg_net, ver el bloque al final de schema.sql):
//     Authorization = la propia service role key, sin `projectId` en el body
//     -> recorre TODOS los proyectos activos de TODAS las organizaciones.
//   - Botón manual "Generar ahora" (ProjectsScreen.tsx): Authorization = JWT
//     de un usuario normal, con `projectId` en el body -> solo ese proyecto,
//     y solo si el requester es el líder del proyecto o el owner de la
//     organización.
//
// Las métricas (tasksTotal/completed/active/overdue/blocked) se calculan acá
// en TS, nunca se le piden a la IA — a Groq solo se le pide el resumen
// narrativo, comparando contra el snapshot de la corrida anterior
// (projects.last_digest_content) para poder hablar de avance real. No hay
// columna completed_at en tasks (limitación conocida, ver docs/ESTADO.md),
// así que "esta semana" es una aproximación honesta: el delta contra el
// último resumen generado, no un rango de fechas exacto.
//
// Deploy:
//   supabase functions deploy project-weekly-digest
// (reusa el secreto GROQ_API_KEY/GROQ_MODEL ya configurado).
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildEmailTemplate } from "../_shared/email_templates.ts";
import { sendSmtpEmail } from "../_shared/smtp.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

const ACTIVE_PROJECT_STATUSES = ["planning", "active", "in_review", "on_hold", "blocked"];

type Metrics = {
  tasksTotal: number;
  tasksCompleted: number;
  tasksActive: number;
  tasksOverdue: number;
  tasksBlocked: number;
  progressPercent: number;
};

function computeMetrics(tasks: { status: string; due_date: string | null }[]): Metrics {
  const today = new Date().toISOString().slice(0, 10);
  const tasksTotal = tasks.length;
  const tasksCompleted = tasks.filter((t) => t.status === "completed").length;
  const tasksActive = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled").length;
  const tasksOverdue = tasks.filter(
    (t) => t.status !== "completed" && t.status !== "cancelled" && t.due_date && t.due_date < today
  ).length;
  const tasksBlocked = tasks.filter((t) => t.status === "blocked").length;
  const progressPercent = tasksTotal ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;
  return { tasksTotal, tasksCompleted, tasksActive, tasksOverdue, tasksBlocked, progressPercent };
}

function metricsToPromptText(current: Metrics, previous: Metrics | null): string {
  const currentText = `Total: ${current.tasksTotal} | Completadas: ${current.tasksCompleted} | Activas: ${current.tasksActive} | Vencidas: ${current.tasksOverdue} | Bloqueadas: ${current.tasksBlocked} | Avance: ${current.progressPercent}%`;
  if (!previous) return `Estado actual (primer resumen, sin comparación anterior):\n${currentText}`;
  const completedDelta = current.tasksCompleted - previous.tasksCompleted;
  const overdueDelta = current.tasksOverdue - previous.tasksOverdue;
  return `Estado actual:\n${currentText}\n\nDesde el último resumen: ${completedDelta >= 0 ? "+" : ""}${completedDelta} completadas, ${
    overdueDelta >= 0 ? "+" : ""
  }${overdueDelta} vencidas.`;
}

function buildPrompt(projectName: string, orgName: string, metricsText: string): string {
  return `Eres un asistente de Nexus que redacta el resumen semanal de un proyecto para su equipo, dentro del workspace "${orgName}".

Proyecto: "${projectName}"

Datos reales (ya calculados, no los recalcules ni los cuestiones):
${metricsText}

Tu tarea: redactar un resumen breve (3-5 frases) en español, tono profesional y directo, sobre el estado del proyecto y su evolución. Si hay tareas vencidas o bloqueadas, mencionarlo con tacto, sin alarmismo. Nunca inventes cifras que no estén en los datos de arriba.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, sin markdown, con este formato exacto:
{"summary": "resumen de 3-5 frases"}`;
}

function extractSummary(raw: string): string | null {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed.summary === "string") return parsed.summary;
  } catch {
    // sigue abajo con el fallback
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return typeof parsed.summary === "string" ? parsed.summary : null;
  } catch {
    return null;
  }
}

async function processProject(admin: any, groqApiKey: string, groqModel: string, project: any) {
  const { data: taskRows } = await admin.from("tasks").select("status, due_date").eq("project_id", project.id);
  const metrics = computeMetrics(taskRows ?? []);
  const previousMetrics: Metrics | null = project.last_digest_content?.metrics ?? null;
  const metricsText = metricsToPromptText(metrics, previousMetrics);

  const { data: org } = await admin.from("organizations").select("id, name, owner_id, logo_url").eq("id", project.organization_id).maybeSingle();
  if (!org) return { ok: false, reason: "org-not-found" };

  const prompt = buildPrompt(project.name, org.name, metricsText);

  const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqApiKey}` },
    body: JSON.stringify({ model: groqModel, temperature: 0.5, messages: [{ role: "user", content: prompt }] }),
  });

  if (!groqResponse.ok) return { ok: false, reason: "groq-error" };

  const groqData = await groqResponse.json();
  const rawContent: string = groqData.choices?.[0]?.message?.content ?? "";
  const summary = extractSummary(rawContent);
  if (!summary) return { ok: false, reason: "invalid-ai-response" };

  const content = { summary, metrics, previousMetrics };

  await admin.from("projects").update({ last_digest_content: content, last_digest_at: new Date().toISOString() }).eq("id", project.id);

  // Destinatarios: líder del proyecto + owner de la organización (sin duplicar).
  const recipientIds = Array.from(new Set([project.leader_id, org.owner_id].filter((id): id is string => !!id)));
  if (recipientIds.length) {
    const { data: profiles } = await admin.from("profiles").select("email").in("id", recipientIds);
    const emails = (profiles ?? []).map((p: { email: string | null }) => p.email).filter((e: string | null): e is string => !!e);
    if (emails.length) {
      const { subject, html } = buildEmailTemplate("project_weekly_digest", {
        projectName: project.name,
        summary,
        orgLogoUrl: org.logo_url ?? "",
        orgLogoName: org.name ?? "",
      });
      try {
        await sendSmtpEmail(emails, subject, html);
      } catch (sendErr) {
        console.warn(`No se pudo enviar el resumen semanal de "${project.name}":`, sendErr);
      }
    }
  }

  return { ok: true, content };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    const groqModel = Deno.env.get("GROQ_MODEL") ?? "llama-3.3-70b-versatile";

    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Función mal configurada (Supabase)" }, 500);
    if (!groqApiKey) return json({ error: "Función mal configurada (falta GROQ_API_KEY)" }, 500);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace("Bearer ", "");
    const isBatchMode = token === serviceRoleKey;

    const body = (await req.json().catch(() => ({}))) as { projectId?: string };

    if (isBatchMode) {
      // Modo cron: todos los proyectos activos de todas las organizaciones,
      // o uno puntual si se pasó projectId (permite reusar este mismo modo
      // para pruebas manuales server-a-server).
      const query = admin.from("projects").select("id, organization_id, name, leader_id, last_digest_content").in("status", ACTIVE_PROJECT_STATUSES);
      const { data: projects, error } = body.projectId ? await query.eq("id", body.projectId) : await query;
      if (error) return json({ error: error.message }, 500);

      let processed = 0;
      for (const project of projects ?? []) {
        const result = await processProject(admin, groqApiKey, groqModel, project);
        if (result.ok) processed += 1;
      }
      return json({ processed, total: projects?.length ?? 0 });
    }

    // Modo usuario: requiere projectId + ser líder del proyecto u owner de la organización.
    if (!body.projectId) return json({ error: "Datos incompletos" }, 400);

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Sesión inválida" }, 401);

    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id, organization_id, name, leader_id, last_digest_content")
      .eq("id", body.projectId)
      .maybeSingle();
    if (projectError || !project) return json({ error: "Proyecto no encontrado" }, 404);

    const { data: org } = await admin.from("organizations").select("owner_id").eq("id", project.organization_id).maybeSingle();
    const isAuthorized = project.leader_id === userData.user.id || org?.owner_id === userData.user.id;
    if (!isAuthorized) return json({ error: "Solo el líder del proyecto o el owner pueden generar este resumen" }, 403);

    const result = await processProject(admin, groqApiKey, groqModel, project);
    if (!result.ok) return json({ error: `No se pudo generar el resumen (${result.reason})` }, 502);

    return json({ content: result.content });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Error inesperado" }, 500);
  }
});
