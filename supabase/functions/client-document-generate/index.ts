// Edge Function: genera un documento/reporte bajo demanda para una solicitud
// de cliente (docs/CLIENTE.md §7, ver "Plan de implementación — Home con
// widgets"). A diferencia del Dashboard (§6, automático/vivo), esto es
// SIEMPRE reactivo — el cliente lo pidió vía Solicitudes, el staff genera acá
// y lo entrega dentro de esa misma solicitud. Mismo patrón que
// badge-suggestions/client-dashboard-generate: una sola llamada, no persiste
// sola — el cliente (src/lib/clientDocuments.ts) hace el insert/update en
// client_documents tras recibir la respuesta.
//
// Deploy:
//   supabase functions deploy client-document-generate
// (reusa el secreto GROQ_API_KEY/GROQ_MODEL ya configurado).
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

function buildPrompt(orgName: string, clientName: string, title: string, metricsText: string, extraPrompt: string) {
  return `Eres un asistente de Nexus que redacta documentos/reportes para que un equipo se los entregue a su cliente "${clientName}" en el workspace de "${orgName}".

Título del documento pedido: "${title}"

Datos reales disponibles (ya calculados, no los recalcules ni los cuestiones):
${metricsText}

${extraPrompt ? `Instrucción de tono/enfoque del equipo: ${extraPrompt}` : "Sin instrucción de tono especial: usa un tono profesional, claro y ejecutivo."}

Tu tarea: redactar un documento en español, dividido en 3 a 5 secciones cortas (cada una con un encabezado y un cuerpo de 2-5 frases), basado en los datos de arriba y en el título pedido. Nunca inventes cifras que no estén en los datos de arriba.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, sin markdown, con este formato exacto:
{"sections": [{"heading": "Encabezado", "body": "Cuerpo del párrafo"}]}`;
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

    const { organizationId, clientUserId, projectIds, teamIds, extraPrompt, title } = (await req.json()) as {
      organizationId?: string;
      clientUserId?: string;
      projectIds?: string[];
      teamIds?: string[];
      extraPrompt?: string;
      title?: string;
    };

    if (!organizationId || !clientUserId || !title) return json({ error: "Datos incompletos" }, 400);

    const hasAccess = await verifyClientStaffAccess(admin, organizationId, clientUserId, requesterId);
    if (!hasAccess) return json({ error: "No autorizado para generar este documento" }, 403);

    const [{ data: org }, { data: clientProfile }] = await Promise.all([
      admin.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
      admin.from("profiles").select("full_name, nickname").eq("id", clientUserId).maybeSingle(),
    ]);

    const metrics = await buildProjectTeamMetrics(admin, organizationId, projectIds ?? [], teamIds ?? []);
    const metricsText = metricsToPromptText(metrics);
    const clientName = clientProfile?.nickname || clientProfile?.full_name || "el cliente";
    const prompt = buildPrompt(org?.name ?? "la organización", clientName, title, metricsText, extraPrompt ?? "");

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
    const parsed = extractJson<{ sections?: { heading?: string; body?: string }[] }>(rawContent);

    if (!parsed || !Array.isArray(parsed.sections) || !parsed.sections.length) {
      return json({ error: "La IA no devolvió un formato válido, intenta de nuevo" }, 502);
    }

    const sections = parsed.sections
      .filter((s) => typeof s.heading === "string" && typeof s.body === "string")
      .map((s) => ({ heading: s.heading as string, body: s.body as string }));

    if (!sections.length) return json({ error: "La IA no devolvió un formato válido, intenta de nuevo" }, 502);

    return json({ content: { sections } });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Error inesperado" }, 500);
  }
});
