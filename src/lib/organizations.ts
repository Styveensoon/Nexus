import { supabase } from "./supabase";

export type Organization = {
  id: string;
  name: string;
  color: string;
  logo_url: string | null;
  invite_code: string;
  owner_id: string;
};

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin caracteres ambiguos
  let code = "";
  for (let i = 0; i < 7; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createOrganization(params: {
  ownerId: string;
  name: string;
  color: string;
  logoUrl?: string | null;
}) {
  const { ownerId, name, color, logoUrl } = params;

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from("organizations")
      .insert({
        name,
        color,
        logo_url: logoUrl || null,
        owner_id: ownerId,
        invite_code: generateInviteCode(),
      })
      .select()
      .single();

    if (!error) {
      await supabase
        .from("organization_members")
        .insert({ organization_id: data.id, user_id: ownerId, role: "owner" });
      return { data: data as Organization, error: null };
    }

    // Reintenta si el invite_code colisionó (unique_violation = 23505)
    if (error.code !== "23505") {
      return { data: null, error };
    }
  }

  return { data: null, error: new Error("No se pudo generar un código de invitación único.") };
}

export async function getOrganizationByCode(code: string) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, color, logo_url, invite_code, owner_id")
    .eq("invite_code", code.trim().toUpperCase())
    .maybeSingle();

  return { data: data as Organization | null, error };
}

export async function joinOrganization(params: { organizationId: string; userId: string }) {
  const { organizationId, userId } = params;
  const { error } = await supabase
    .from("organization_members")
    .insert({ organization_id: organizationId, user_id: userId, role: "member" });

  return { error };
}

export async function getUserOrganization(userId: string) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization:organizations(id, name, color, logo_url, invite_code, owner_id)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return { data: null, error };
  return { data: data.organization as unknown as Organization, error: null };
}

export type OrganizationMemberProfile = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  avatarColor: string;
  role: string | null;
  customRole: string | null;
};

// Roster completo de la organización (para pickers de integrantes de equipos
// y proyectos) — dos queries en vez de un join embebido porque no hay FK
// directa entre organization_members y profiles (mismo patrón que la Edge
// Function semillero-chat).
export async function listOrganizationMembers(organizationId: string) {
  const { data: memberRows, error: membersError } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId);

  if (membersError) return { data: [] as OrganizationMemberProfile[], error: membersError };

  const memberIds = (memberRows ?? []).map((m) => m.user_id);

  const { data: profileRows, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, nickname, avatar_url, avatar_color, role, custom_role")
    .in("id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]);

  if (profilesError) return { data: [] as OrganizationMemberProfile[], error: profilesError };

  const members: OrganizationMemberProfile[] = (profileRows ?? []).map((p) => ({
    userId: p.id,
    name: p.nickname || p.full_name || "Sin nombre",
    avatarUrl: p.avatar_url,
    avatarColor: p.avatar_color ?? "#2563EB",
    role: p.role,
    customRole: p.custom_role,
  }));

  return { data: members, error: null };
}
