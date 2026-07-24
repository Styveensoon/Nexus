import { supabase } from "./supabase";
import { logClientActivity } from "./clientActivity";

// Home del cliente armado con widgets (docs/CLIENTE.md §6, ver "Plan de
// implementación — Home con widgets"). El equipo asignado agrega/configura/
// reordena/borra secciones; el cliente solo las ve (RLS
// client_home_sections_select_access). Chat y Solicitudes siguen siendo tabs
// propios e intactos — "chat_preview"/"requests_summary" acá son solo
// teasers con link al tab completo, nunca reemplazan esa pantalla.
export type ClientHomeSectionType = "dashboard" | "project_overview" | "requests_summary" | "chat_preview" | "deliverables";

export type ClientWidgetSource = { projectIds: string[]; teamIds: string[] };
export type DashboardConfig = ClientWidgetSource & { extraPrompt: string };

export type DashboardMetrics = {
  projects: { id: string; name: string; status: string }[];
  teams: { id: string; name: string }[];
  tasksTotal: number;
  tasksCompleted: number;
  tasksInProgress: number;
  tasksOverdue: number;
  progressPercent: number;
  upcomingDueDates: { taskTitle: string; dueDate: string }[];
};

export type DashboardGeneratedContent = {
  summary: string;
  highlights: string[];
  metrics: DashboardMetrics;
};

export type ClientHomeSection = {
  id: string;
  organizationId: string;
  clientUserId: string;
  type: ClientHomeSectionType;
  title: string;
  config: any;
  generatedContent: DashboardGeneratedContent | null;
  generatedAt: string | null;
  position: number;
  createdBy: string;
  createdAt: string;
};

// Catálogo fijo de tipos de widget — mismo criterio que BADGE_CATALOG
// (src/lib/badges.ts): no hay tabla de tipos, el picker se arma desde acá.
export const CLIENT_WIDGET_TYPES: {
  type: ClientHomeSectionType;
  label: string;
  description: string;
  icon: string;
  needsSource: boolean;
  needsPrompt: boolean;
}[] = [
  {
    type: "dashboard",
    label: "Dashboard IA",
    description: "Resumen ejecutivo + métricas de avance, generado por IA a partir de proyectos/equipos reales.",
    icon: "Sparkles",
    needsSource: true,
    needsPrompt: true,
  },
  {
    type: "project_overview",
    label: "Tu Proyecto",
    description: "Ficha con datos reales (status, avance, próxima fecha límite) — sin IA.",
    icon: "FolderKanban",
    needsSource: true,
    needsPrompt: false,
  },
  {
    type: "requests_summary",
    label: "Resumen de Solicitudes",
    description: "Conteo por estado + últimas solicitudes, con link al tab Solicitudes.",
    icon: "ClipboardList",
    needsSource: false,
    needsPrompt: false,
  },
  {
    type: "chat_preview",
    label: "Resumen de Chat",
    description: "Últimos mensajes del chat, con link al tab Chat.",
    icon: "MessageCircle",
    needsSource: false,
    needsPrompt: false,
  },
  {
    type: "deliverables",
    label: "Entregables",
    description: "El cliente aprueba o rechaza entregables directamente desde acá.",
    icon: "FileCheck2",
    needsSource: false,
    needsPrompt: false,
  },
];

export const CLIENT_WIDGET_DEFAULT_TITLES: Record<ClientHomeSectionType, string> = {
  dashboard: "Dashboard",
  project_overview: "Tu Proyecto",
  requests_summary: "Solicitudes",
  chat_preview: "Chat",
  deliverables: "Entregables",
};

function mapSectionRow(row: any): ClientHomeSection {
  return {
    id: row.id,
    organizationId: row.organization_id,
    clientUserId: row.client_user_id,
    type: row.type,
    title: row.title,
    config: row.config ?? {},
    generatedContent: row.generated_content ?? null,
    generatedAt: row.generated_at,
    position: row.position,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function listClientHomeSections(organizationId: string, clientUserId: string) {
  const { data, error } = await supabase
    .from("client_home_sections")
    .select("id, organization_id, client_user_id, type, title, config, generated_content, generated_at, position, created_by, created_at")
    .eq("organization_id", organizationId)
    .eq("client_user_id", clientUserId)
    .order("position", { ascending: true });

  if (error) return { data: [] as ClientHomeSection[], error };
  return { data: (data ?? []).map(mapSectionRow), error: null };
}

export async function createClientHomeSection(params: {
  organizationId: string;
  clientUserId: string;
  type: ClientHomeSectionType;
  title: string;
  config?: any;
  createdBy: string;
}) {
  const { data: existing } = await supabase
    .from("client_home_sections")
    .select("position")
    .eq("organization_id", params.organizationId)
    .eq("client_user_id", params.clientUserId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = existing?.length ? existing[0].position + 1 : 0;

  const { data, error } = await supabase
    .from("client_home_sections")
    .insert({
      organization_id: params.organizationId,
      client_user_id: params.clientUserId,
      type: params.type,
      title: params.title,
      config: params.config ?? {},
      position: nextPosition,
      created_by: params.createdBy,
    })
    .select("id")
    .single();

  if (!error && data) {
    await logClientActivity({
      organizationId: params.organizationId,
      clientUserId: params.clientUserId,
      actorId: params.createdBy,
      action: "home_section_created",
      entityName: params.title,
      entityId: data.id,
    });
  }

  return { data, error };
}

// Cambiar la fuente (config) invalida el contenido generado anterior — ya no
// corresponde a los proyectos/equipos nuevos, mismo criterio que
// due_reminder_sent_at reseteándose en updateTask al cambiar due_date.
export async function updateClientHomeSectionConfig(sectionId: string, config: any, title?: string) {
  const patch: Record<string, any> = { config, updated_at: new Date().toISOString(), generated_content: null, generated_at: null };
  if (title !== undefined) patch.title = title;
  const { error } = await supabase.from("client_home_sections").update(patch).eq("id", sectionId);
  return { error };
}

export async function deleteClientHomeSection(sectionId: string) {
  const { error } = await supabase.from("client_home_sections").delete().eq("id", sectionId);
  return { error };
}

// Reordenar con flechas subir/bajar — swap simple de `position` con el
// vecino inmediato, no drag-and-drop (docs/CLIENTE.md, decisión conservadora).
export async function reorderClientHomeSection(
  organizationId: string,
  clientUserId: string,
  sectionId: string,
  direction: "up" | "down"
) {
  const { data: sections, error } = await listClientHomeSections(organizationId, clientUserId);
  if (error) return { error };

  const idx = sections.findIndex((s) => s.id === sectionId);
  if (idx === -1) return { error: null };
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sections.length) return { error: null };

  const a = sections[idx];
  const b = sections[swapIdx];

  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from("client_home_sections").update({ position: b.position }).eq("id", a.id),
    supabase.from("client_home_sections").update({ position: a.position }).eq("id", b.id),
  ]);

  return { error: e1 ?? e2 ?? null };
}

// Invoca client-dashboard-generate y persiste el resultado — la función no
// persiste sola (mismo patrón que badge-suggestions/askSemillero).
export async function generateDashboardContent(section: ClientHomeSection, actorId: string) {
  const { data, error } = await supabase.functions.invoke("client-dashboard-generate", {
    body: { sectionId: section.id },
  });

  if (error) return { error };
  const content = data?.content as DashboardGeneratedContent | undefined;
  if (!content) return { error: new Error("La IA no devolvió contenido") };

  const { error: updateError } = await supabase
    .from("client_home_sections")
    .update({ generated_content: content, generated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", section.id);

  if (!updateError) {
    await logClientActivity({
      organizationId: section.organizationId,
      clientUserId: section.clientUserId,
      actorId,
      action: "home_section_regenerated",
      entityName: section.title,
      entityId: section.id,
    });
  }

  return { error: updateError, content };
}
