import { supabase } from "./supabase";
import { logActivity } from "./activity";
import { notifyBadgeGranted } from "./emails";

// Catálogo fijo de tipos de badge — no hay tabla de tipos porque hoy no son
// personalizables (ver docs/PATRONES.md sobre catálogos fijos como
// TASK_PRIORITY_*). `icon` es solo el nombre del ícono de lucide-react-native;
// cada pantalla/componente resuelve el nombre al componente real (mismo
// patrón que TAB_ICONS en BottomTabs.tsx) para no importar componentes RN
// desde un archivo de lógica pura.
export type BadgeDefinition = {
  key: string;
  label: string;
  description: string;
  icon: string;
  color: string;
};

export const BADGE_CATALOG: BadgeDefinition[] = [
  { key: "leader", label: "Líder Nato", description: "Guía al equipo con claridad y toma decisiones con seguridad.", icon: "Crown", color: "#F59E0B" },
  { key: "team_player", label: "Team Player", description: "Colabora activamente y antepone el resultado del equipo.", icon: "Users", color: "#2563EB" },
  { key: "mentor", label: "Mentor", description: "Ayuda a que otros crezcan compartiendo lo que sabe.", icon: "GraduationCap", color: "#7C3AED" },
  { key: "reliable", label: "Confiable", description: "Cumple lo que promete, sin necesidad de seguimiento.", icon: "ShieldCheck", color: "#10B981" },
  { key: "communicator", label: "Comunicador/a", description: "Explica ideas con claridad y mantiene informado al equipo.", icon: "MessageCircle", color: "#06B6D4" },
  { key: "problem_solver", label: "Resolutivo/a", description: "Destraba problemas difíciles con soluciones prácticas.", icon: "Puzzle", color: "#F97316" },
  { key: "innovator", label: "Innovador/a", description: "Propone ideas y formas nuevas de hacer las cosas.", icon: "Lightbulb", color: "#EAB308" },
  { key: "punctual", label: "Puntual", description: "Entrega a tiempo y respeta las fechas acordadas.", icon: "Clock", color: "#64748B" },
  { key: "motivator", label: "Motivador/a", description: "Contagia energía positiva y mantiene al equipo enfocado.", icon: "Flame", color: "#EF4444" },
  { key: "strategist", label: "Estratega", description: "Piensa en el panorama completo antes de actuar.", icon: "Target", color: "#4F46E5" },
];

// Badges personalizados creados por cada organización (Punto 5 del feedback:
// CRUD completo, no solo el catálogo fijo BADGE_CATALOG). Viven en la tabla
// badge_definitions, propios de cada organización (organization_id), y se
// suman al catálogo fijo — nunca lo reemplazan ni lo pueden borrar (los 10 de
// BADGE_CATALOG siguen siendo el set "de fábrica" para toda organización
// nueva). getBadgeDefinition sigue siendo síncrono (muchos call sites ya
// asumen eso) así que los custom se resuelven contra un cache en memoria que
// listOrgBadgeDefinitions/listOrgBadges/listProfileBadges se encargan de
// mantener tibio antes de que la UI necesite pintar un badge_key custom.
const customBadgeCache = new Map<string, BadgeDefinition>();

type BadgeDefinitionRow = {
  key: string;
  label: string;
  description: string;
  icon: string;
  color: string;
};

export async function listOrgBadgeDefinitions(organizationId: string) {
  const { data: rows, error } = await supabase
    .from("badge_definitions")
    .select("key, label, description, icon, color")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) return { data: BADGE_CATALOG, error };

  const custom: BadgeDefinition[] = ((rows ?? []) as BadgeDefinitionRow[]).map((r) => ({
    key: r.key,
    label: r.label,
    description: r.description,
    icon: r.icon,
    color: r.color,
  }));
  custom.forEach((b) => customBadgeCache.set(b.key, b));

  return { data: [...BADGE_CATALOG, ...custom], error: null };
}

function slugifyBadgeKey(label: string) {
  const base = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `custom_${base || "badge"}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createBadgeDefinition(params: {
  organizationId: string;
  createdBy: string;
  label: string;
  description: string;
  icon: string;
  color: string;
}) {
  const key = slugifyBadgeKey(params.label);
  const { error } = await supabase.from("badge_definitions").insert({
    organization_id: params.organizationId,
    key,
    label: params.label,
    description: params.description,
    icon: params.icon,
    color: params.color,
    created_by: params.createdBy,
  });

  if (!error) customBadgeCache.set(key, { key, label: params.label, description: params.description, icon: params.icon, color: params.color });

  return { error };
}

export async function deleteBadgeDefinition(organizationId: string, key: string) {
  const { error } = await supabase.from("badge_definitions").delete().eq("organization_id", organizationId).eq("key", key);
  return { error };
}

export function getBadgeDefinition(key: string): BadgeDefinition | null {
  return BADGE_CATALOG.find((b) => b.key === key) ?? customBadgeCache.get(key) ?? null;
}

// activity_log solo guarda el LABEL del badge (entityName), no su key — lo
// necesita ActivityDetailModal para resolver la descripción a mostrar en el
// detalle de un badge_granted/badge_revoked, incluidos los personalizados.
export function getBadgeDefinitionByLabel(label: string): BadgeDefinition | null {
  const fixed = BADGE_CATALOG.find((b) => b.label === label);
  if (fixed) return fixed;
  for (const def of customBadgeCache.values()) {
    if (def.label === label) return def;
  }
  return null;
}

export type ProfileBadge = {
  id: string;
  organizationId: string;
  profileId: string;
  badgeKey: string;
  grantedBy: string;
  // Nombre para mostrar de quien lo otorgó, resuelto acá (no en cada
  // pantalla) para que "click en un badge -> quién y cuándo" funcione igual
  // en ProfileScreen, MemberProfileModal y BadgeAwardModal sin que cada uno
  // tenga que cargar/pasar el roster completo de la organización.
  grantedByName: string;
  createdAt: string;
};

type ProfileBadgeRow = {
  id: string;
  organization_id: string;
  profile_id: string;
  badge_key: string;
  granted_by: string;
  created_at: string;
};

// Dos queries en vez de un join embebido porque no hay FK que Supabase pueda
// resolver directo entre profile_badges.granted_by y profiles (mismo patrón
// que hydrateTeams en lib/teams.ts y listOrganizationMembers).
async function hydrateGranterNames(rows: ProfileBadgeRow[]): Promise<ProfileBadge[]> {
  const granterIds = Array.from(new Set(rows.map((r) => r.granted_by)));

  const { data: granterRows } = await supabase
    .from("profiles")
    .select("id, full_name, nickname")
    .in("id", granterIds.length ? granterIds : ["00000000-0000-0000-0000-000000000000"]);

  const nameById = new Map((granterRows ?? []).map((p) => [p.id, p.nickname || p.full_name || "Alguien"]));

  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    profileId: row.profile_id,
    badgeKey: row.badge_key,
    grantedBy: row.granted_by,
    grantedByName: nameById.get(row.granted_by) ?? "alguien que ya no está en la organización",
    createdAt: row.created_at,
  }));
}

// Todos los badges de la organización, agrupados por colaborador — para
// pintar el buscador (conteo por tarjeta) y el modal de una persona sin
// disparar una query por miembro.
export async function listOrgBadges(organizationId: string) {
  const [{ data, error }] = await Promise.all([
    supabase
      .from("profile_badges")
      .select("id, organization_id, profile_id, badge_key, granted_by, created_at")
      .eq("organization_id", organizationId),
    listOrgBadgeDefinitions(organizationId),
  ]);

  if (error) return { data: new Map<string, ProfileBadge[]>(), error };

  const hydrated = await hydrateGranterNames((data ?? []) as ProfileBadgeRow[]);
  const byProfile = new Map<string, ProfileBadge[]>();
  hydrated.forEach((badge) => {
    const list = byProfile.get(badge.profileId) ?? [];
    list.push(badge);
    byProfile.set(badge.profileId, list);
  });

  return { data: byProfile, error: null };
}

// Badges de una sola persona — usado por ProfileScreen (los propios) y
// MemberProfileModal (los de quien se está viendo, ej. al elegir integrantes
// para un equipo/proyecto), a diferencia de listOrgBadges que trae todos de
// golpe para el buscador de BadgesScreen.
export async function listProfileBadges(organizationId: string, profileId: string) {
  const [{ data, error }] = await Promise.all([
    supabase
      .from("profile_badges")
      .select("id, organization_id, profile_id, badge_key, granted_by, created_at")
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId),
    listOrgBadgeDefinitions(organizationId),
  ]);

  if (error) return { data: [] as ProfileBadge[], error };
  return { data: await hydrateGranterNames((data ?? []) as ProfileBadgeRow[]), error: null };
}

export async function grantBadge(params: {
  organizationId: string;
  profileId: string;
  badgeKey: string;
  grantedBy: string;
}) {
  const { error } = await supabase.from("profile_badges").insert({
    organization_id: params.organizationId,
    profile_id: params.profileId,
    badge_key: params.badgeKey,
    granted_by: params.grantedBy,
  });

  if (!error) {
    const definition = getBadgeDefinition(params.badgeKey);
    await logActivity({
      organizationId: params.organizationId,
      actorId: params.grantedBy,
      action: "badge_granted",
      entityType: "badge",
      entityName: definition?.label ?? params.badgeKey,
      targetUserId: params.profileId,
    });
    await notifyBadgeGranted(params.profileId, definition?.label ?? params.badgeKey, definition?.description ?? "", params.organizationId);
  }

  return { error };
}

export async function revokeBadge(params: { organizationId: string; profileId: string; badgeKey: string }) {
  const { error } = await supabase
    .from("profile_badges")
    .delete()
    .eq("organization_id", params.organizationId)
    .eq("profile_id", params.profileId)
    .eq("badge_key", params.badgeKey);

  if (!error) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await logActivity({
        organizationId: params.organizationId,
        actorId: user.id,
        action: "badge_revoked",
        entityType: "badge",
        entityName: getBadgeDefinition(params.badgeKey)?.label ?? params.badgeKey,
        targetUserId: params.profileId,
      });
    }
  }

  return { error };
}

export async function countOrgBadges(organizationId: string) {
  const { count, error } = await supabase
    .from("profile_badges")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  return { count: count ?? 0, error };
}

// Sugerencia de la IA (badge-suggestions Edge Function): no se persiste, se
// recalcula bajo demanda cada vez que el owner/encargado pide "Analizar
// desempeño" — a diferencia de team_suggestion de El Semillero, que sí se
// guarda porque nace dentro de un chat con historial.
export type BadgeSuggestion = {
  userId: string;
  badgeKey: string;
  reason: string;
};

export async function requestBadgeSuggestions(organizationId: string) {
  const { data, error } = await supabase.functions.invoke("badge-suggestions", {
    body: { organizationId },
  });

  if (error) return { data: [] as BadgeSuggestion[], error };
  return { data: (data?.suggestions ?? []) as BadgeSuggestion[], error: null };
}
