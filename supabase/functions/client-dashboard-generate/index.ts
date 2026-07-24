// Edge Function: genera el contenido del widget "Dashboard" del home de un
// cliente (docs/CLIENTE.md §6, ver "Plan de implementación — Home con
// widgets"). Mismo patrón que badge-suggestions: una sola llamada, no
// persiste sola — el cliente (src/lib/clientHome.ts) hace el update de
// generated_content/generated_at en client_home_sections tras recibir la
// respuesta.
//
// Las métricas numéricas se calculan en TS (buildProjectTeamMetrics,
// _shared/client_ai_context.ts) ANTES de llamar a la IA — a Groq solo se le
// pide el resumen narrativo y los highlights, nunca que invente cifras
// (filosofía anti-fake, docs/PATRONES.md).
//
// Deploy:
//   supabase functions deploy client-dashboard-generate
// (reusa el secreto GROQ_API_KEY/GROQ_MODEL ya configurado, no hace falta uno nuevo).
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildProjectTeamMetrics, extractJson, metricsToPromptText, verifyClientStaffAccess } from "../_shared/client_ai_context.ts";

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

function buildPrompt(orgName: string, clientName: string, metricsText: string, extraPrompt: string) {
  return `Eres un asistente de Nexus que redacta el resumen ejecutivo que un equipo le muestra a su cliente "${clientName}" en el workspace de "${orgName}".

Datos reales (ya calculados, no los recalcules ni los cuestiones):
${metricsText}

${extraPrompt ? `Instrucción de tono/enfoque del equipo: ${extraPrompt}` : "Sin instrucción de tono especial: usa un tono profesional y cercano."}

Tu tarea: redactar un resumen breve (3-5 frases) en español dirigido directamente al cliente, y 2-4 highlights cortos (frases de menos de 12 palabras) destacando lo más relevante de los datos de arriba. Nunca inventes cifras que no estén en los datos. Si hay tareas vencidas, mencionarlo con tacto, sin alarmismo.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, sin markdown, con este formato exacto:
{"summary": "resumen de 3-5 frases", "highlights": ["highlight 1", "highlight 2"]}`;
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

    const { data: userData, error: userError } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !userData.user) return json({ error: "Sesión inválida" }, 401);
    const requesterId = userData.user.id;

    const { sectionId } = (await req.json()) as { sectionId?: string };
    if (!sectionId) return json({ error: "Datos incompletos" }, 400);

    const { data: section, error: sectionError } = await admin
      .from("client_home_sections")
      .select("id, organization_id, client_user_id, type, config")
      .eq("id", sectionId)
      .maybeSingle();

    if (sectionError || !section) return json({ error: "Sección no encontrada" }, 404);
    if (section.type !== "dashboard") return json({ error: "Esta sección no es de tipo dashboard" }, 400);

    const hasAccess = await verifyClientStaffAccess(admin, section.organization_id, section.client_user_id, requesterId);
    if (!hasAccess) return json({ error: "No autorizado para generar este dashboard" }, 403);

    const [{ data: org }, { data: clientProfile }] = await Promise.all([
      admin.from("organizations").select("name").eq("id", section.organization_id).maybeSingle(),
      admin.from("profiles").select("full_name, nickname").eq("id", section.client_user_id).maybeSingle(),
    ]);

    const config = (section.config ?? {}) as { projectIds?: string[]; teamIds?: string[]; extraPrompt?: string };
    const projectIds = config.projectIds ?? [];
    const teamIds = config.teamIds ?? [];
    const extraPrompt = config.extraPrompt ?? "";

    const metrics = await buildProjectTeamMetrics(admin, section.organization_id, projectIds, teamIds);
    const metricsText = metricsToPromptText(metrics);

    const clientName = clientProfile?.nickname || clientProfile?.full_name || "el cliente";
    const prompt = buildPrompt(org?.name ?? "la organización", clientName, metricsText, extraPrompt);

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqApiKey}` },
      body: JSON.stringify({ model: groqModel, temperature: 0.5, messages: [{ role: "user", content: prompt }] }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      return json({ error: `Error de la IA: ${errText}` }, 502);
    }

    const groqData = await groqResponse.json();
    const rawContent: string = groqData.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson<{ summary?: string; highlights?: string[] }>(rawContent);

    if (!parsed || typeof parsed.summary !== "string") {
      return json({ error: "La IA no devolvió un formato válido, intenta de nuevo" }, 502);
    }

    const highlights = Array.isArray(parsed.highlights) ? parsed.highlights.filter((h) => typeof h === "string").slice(0, 4) : [];

    return json({ content: { summary: parsed.summary, highlights, metrics } });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Error inesperado" }, 500);
  }
});
