import { supabase } from "./supabase";
import { logActivity } from "./activity";

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

export function getBadgeDefinition(key: string): BadgeDefinition | null {
  return BADGE_CATALOG.find((b) => b.key === key) ?? null;
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
  const { data, error } = await supabase
    .from("profile_badges")
    .select("id, organization_id, profile_id, badge_key, granted_by, created_at")
    .eq("organization_id", organizationId);

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
  const { data, error } = await supabase
    .from("profile_badges")
    .select("id, organization_id, profile_id, badge_key, granted_by, created_at")
    .eq("organization_id", organizationId)
    .eq("profile_id", profileId);

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
    await logActivity({
      organizationId: params.organizationId,
      actorId: params.grantedBy,
      action: "badge_granted",
      entityType: "badge",
      entityName: getBadgeDefinition(params.badgeKey)?.label ?? params.badgeKey,
      targetUserId: params.profileId,
    });
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
