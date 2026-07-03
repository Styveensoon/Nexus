// Edge Function: proxy entre el Semillero y la IA (Groq en dev, Ollama en prod
// self-hosted más adelante — no asumir que el formato de respuesta será
// idéntico cuando se migre).
//
// Por qué existe esta función y no se llama a Groq directo desde el cliente:
// la GROQ_API_KEY nunca debe llegar al bundle de JS (quedaría visible para
// cualquiera que inspeccione la app web). Acá vive como secreto de Supabase.
//
// Deploy:
//   supabase functions deploy semillero-chat
//   supabase secrets set GROQ_API_KEY=tu-key [GROQ_MODEL=llama-3.3-70b-versatile]
import { createClient } from "npm:@supabase/supabase-js@2";

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

type ChatMessage = { role: "user" | "assistant"; content: string };

type TeamSuggestion = {
  projectName: string;
  leader: { userId: string; name: string; reason: string };
  team: { userId: string; name: string; roleInTeam: string; reason: string }[];
  firstSteps: string[];
};

type MemberRoster = {
  userId: string;
  nombre: string;
  rol: string;
  habilidades: string[];
  idiomas: string[];
  badges: string[];
  timezone: string | null;
};

// Mismas keys/labels que BADGE_CATALOG en src/lib/badges.ts — duplicado acá
// porque esta función corre en Deno y no puede importar código de la app
// React Native (mismo criterio que badge-suggestions/index.ts). Si se agrega
// un badge nuevo al catálogo, agregarlo también acá para que el Semillero lo
// reconozca por nombre.
const BADGE_LABELS: Record<string, string> = {
  leader: "Líder Nato",
  team_player: "Team Player",
  mentor: "Mentor",
  reliable: "Confiable",
  communicator: "Comunicador/a",
  problem_solver: "Resolutivo/a",
  innovator: "Innovador/a",
  punctual: "Puntual",
  motivator: "Motivador/a",
  strategist: "Estratega",
};

function buildSystemPrompt(orgName: string, roster: MemberRoster[]) {
  const rosterText = roster.length
    ? roster
        .map(
          (m) =>
            `- id: ${m.userId} | nombre: ${m.nombre} | rol: ${m.rol} | habilidades: ${
              m.habilidades.join(", ") || "sin registrar"
            } | idiomas: ${m.idiomas.join(", ") || "sin registrar"} | zona horaria: ${
              m.timezone ?? "sin registrar"
            } | badges: ${m.badges.join(", ") || "ninguno"}`
        )
        .join("\n")
    : "(la organización todavía no tiene perfiles con datos cargados)";

  return `Eres el asistente de "El Semillero" dentro de Nexus, la herramienta de gestión de proyectos de la organización "${orgName}".

Tu trabajo tiene dos fases:
1. Conversar con el admin para entender y pulir su idea de proyecto (haz preguntas concretas si falta contexto: objetivo, alcance aproximado, urgencia).
2. En cuanto tengas contexto suficiente, sugerir un equipo ideal usando ÚNICAMENTE a las personas listadas abajo (nunca inventes miembros que no existan), eligiendo un líder de equipo, y proponiendo entre 3 y 5 primeros pasos concretos — NO un plan de proyecto completo, solo cómo arrancar.

Miembros reales de la organización disponibles:
${rosterText}

Al elegir el equipo, considera también la zona horaria (formato IANA, ej. "America/Bogota") de cada persona: entre candidatos con habilidades similares, prioriza combinaciones cuyos husos horarios permitan coordinarse en horario laboral (idealmente que no difieran en más de ~4-5 horas entre sí). Si para cubrir una habilidad clave (ej. un idioma específico) solo hay alguien en un huso muy distinto al resto del equipo, igual puedes incluirlo, pero dilo explícitamente en su "reason" para que el admin lo sepa conscientemente.

Los "badges" de cada persona son reconocimientos reales que la organización ya le otorgó (no los inventes, no todos tienen) y deben pesar de verdad en tus decisiones, no ser un dato decorativo: al elegir quién lidera, prioriza a alguien con el badge "Líder Nato" o "Estratega" si sus habilidades también encajan con el proyecto; al armar el resto del equipo, "Mentor" y "Team Player" son buena señal de colaboración, "Confiable" y "Puntual" de que va a cumplir con lo que se compromete. Si el candidato más obvio por habilidades no tiene ningún badge relevante pero otro sí, dilo explícitamente en el "reason" de tu elección.

Reglas de formato de tu respuesta:
- Responde siempre en español, en tono cercano y profesional, de forma breve.
- Mientras sigas reuniendo contexto, responde solo con texto conversacional normal. NO agregues ninguna sugerencia de equipo todavía.
- IMPORTANTE: en el texto conversacional (fuera del bloque de abajo) refiérete a las personas SOLO por su nombre. El "userId" (los códigos largo tipo uuid de la lista de arriba) es un identificador interno que el admin nunca debe ver en la conversación — solo va dentro del bloque de abajo, nunca escrito en una oración normal.
- IMPORTANTE: tu mensaje conversacional es lo único que el admin lee como texto de chat — nunca menciones, ni de pasada, que vas a generar/adjuntar/incluir un "JSON", "bloque", "objeto", "estructura de datos" ni ninguna palabra técnica sobre el formato de tu respuesta. El admin va a ver la sugerencia como una tarjeta visual armada por la app, no debe enterarse de que por debajo hay datos estructurados. Anuncia la sugerencia de forma natural, por ejemplo: "Con esto ya tengo lo necesario, aquí va mi sugerencia de equipo:" y ahí termina tu mensaje conversacional (el bloque va después, en una línea aparte, nunca lo menciones dentro del texto).
- Cuando decidas que ya puedes sugerir el equipo, escribe primero tu mensaje conversacional normal (mencionando a la gente solo por nombre, sin mencionar el bloque) y DESPUÉS, en una línea aparte, agrega EXACTAMENTE este bloque (sin texto extra dentro, JSON válido en una sola línea o multilínea):

<<<TEAM>>>
{"projectName": "nombre corto del proyecto", "leader": {"userId": "id del líder elegido", "name": "nombre del líder", "reason": "por qué lidera"}, "team": [{"userId": "id", "name": "nombre", "roleInTeam": "rol dentro de este proyecto", "reason": "por qué encaja"}], "firstSteps": ["paso 1", "paso 2", "paso 3"]}
<<<END_TEAM>>>

- Usa siempre el "userId" exacto de la lista de miembros de arriba dentro de ese bloque JSON, nunca inventes ids, y nunca lo repitas fuera del bloque.
- Solo incluye ese bloque una vez que tengas una recomendación real que dar, no antes.`;
}

// Red de seguridad además del prompt: si el modelo igual se le escapa una
// mención a "JSON"/"bloque"/etc. en el texto conversacional (los LLM no
// siguen instrucciones al 100%), se descarta esa oración completa en vez de
// dejar pasar una frase que expone detalles de implementación al admin.
const LEAK_TERMS = /\b(json|bloque de (datos|texto)|objeto de datos|estructura de datos)\b/i;

function sanitizeReply(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const clean = sentences.filter((s) => !LEAK_TERMS.test(s));
  const result = clean.join(" ").trim();
  return result.length ? result : text.trim();
}

function extractTeamSuggestion(raw: string): { reply: string; teamSuggestion: TeamSuggestion | null } {
  const match = raw.match(/<<<TEAM>>>([\s\S]*?)<<<END_TEAM>>>/);
  if (!match) return { reply: raw.trim(), teamSuggestion: null };

  const reply = raw.slice(0, match.index).trim();
  try {
    const teamSuggestion = JSON.parse(match[1].trim()) as TeamSuggestion;
    return { reply, teamSuggestion };
  } catch {
    return { reply: raw.trim(), teamSuggestion: null };
  }
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

    const { data: userData, error: userError } = await admin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !userData.user) return json({ error: "Sesión inválida" }, 401);
    const requesterId = userData.user.id;

    const { organizationId, messages } = (await req.json()) as {
      organizationId?: string;
      messages?: ChatMessage[];
    };

    if (!organizationId || !Array.isArray(messages) || messages.length === 0) {
      return json({ error: "Datos incompletos" }, 400);
    }

    const { data: org, error: orgError } = await admin
      .from("organizations")
      .select("id, name, owner_id")
      .eq("id", organizationId)
      .maybeSingle();

    if (orgError || !org) return json({ error: "Organización no encontrada" }, 404);
    if (org.owner_id !== requesterId) {
      return json({ error: "Solo el dueño de la organización puede usar el Semillero" }, 403);
    }

    const { data: memberRows, error: membersError } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId);

    if (membersError) return json({ error: "No se pudo leer el equipo" }, 500);

    const memberIds = (memberRows ?? []).map((m) => m.user_id);

    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, full_name, nickname, role, custom_role, skill_levels, language_levels, timezone")
      .in("id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]);

    if (profilesError) return json({ error: "No se pudo leer los perfiles del equipo" }, 500);

    // Badges reales (tabla profile_badges), no la columna legacy profiles.badges
    // (siempre vacía, nunca se escribió desde el cliente — ver docs/ESTADO.md).
    const { data: badgeRows, error: badgesError } = await admin
      .from("profile_badges")
      .select("profile_id, badge_key")
      .eq("organization_id", organizationId);

    if (badgesError) return json({ error: "No se pudo leer los badges del equipo" }, 500);

    const roster: MemberRoster[] = (profiles ?? []).map((p: any) => ({
      userId: p.id,
      nombre: p.nickname || p.full_name || "Sin nombre",
      rol: p.custom_role || p.role || "Sin rol definido",
      habilidades: Object.entries(p.skill_levels ?? {}).map(([k, v]) => `${k} (${v}/10)`),
      idiomas: Object.entries(p.language_levels ?? {}).map(([k, v]) => `${k} (${v})`),
      badges: (badgeRows ?? [])
        .filter((b: any) => b.profile_id === p.id)
        .map((b: any) => BADGE_LABELS[b.badge_key] ?? b.badge_key),
      timezone: p.timezone ?? null,
    }));

    const systemPrompt = buildSystemPrompt(org.name, roster);

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: groqModel,
        temperature: 0.6,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      return json({ error: `Error de la IA: ${errText}` }, 502);
    }

    const groqData = await groqResponse.json();
    const rawContent: string = groqData.choices?.[0]?.message?.content ?? "";
    const { reply, teamSuggestion } = extractTeamSuggestion(rawContent);

    return json({ reply: sanitizeReply(reply), teamSuggestion });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Error inesperado" }, 500);
  }
});
