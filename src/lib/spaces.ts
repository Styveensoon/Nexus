import { supabase } from "./supabase";
import { Organization } from "./organizations";
import { logClientActivity } from "./clientActivity";

// Un "espacio" es cualquier workspace al que el usuario puede entrar con su
// misma cuenta — como team member/owner de su propia organización, o como
// cliente de una organización ajena (docs/CLIENTE.md §2). Mutuamente
// excluyentes por organización (no podés ser miembro Y cliente de la misma
// organización a la vez), pero un usuario puede tener varios espacios
// simultáneos de cualquier combinación.
export type Space =
  | { kind: "member"; organization: Organization; role: "owner" | "member" }
  | { kind: "client"; organization: Organization; clientUserId: string };

export function spaceKey(space: Space): string {
  return space.kind === "member" ? `member:${space.organization.id}` : `client:${space.organization.id}`;
}

const ORGANIZATION_COLUMNS = "id, name, color, logo_url, invite_code, client_invite_code, owner_id";

// Dos queries en vez de un join embebido (mismo patrón "sin FK directa" que
// listOrganizationMembers en organizations.ts) — organization_members y
// organization_clients son tablas deliberadamente no relacionadas entre sí.
export async function listMySpaces(userId: string): Promise<{ data: Space[]; error: any }> {
  const [memberRes, clientRes] = await Promise.all([
    supabase
      .from("organization_members")
      .select(`role, organization:organizations(${ORGANIZATION_COLUMNS})`)
      .eq("user_id", userId),
    supabase
      .from("organization_clients")
      .select(`organization:organizations(${ORGANIZATION_COLUMNS})`)
      .eq("user_id", userId),
  ]);

  if (memberRes.error) return { data: [], error: memberRes.error };
  if (clientRes.error) return { data: [], error: clientRes.error };

  const memberSpaces: Space[] = (memberRes.data ?? [])
    .filter((row: any) => !!row.organization)
    .map((row: any) => ({ kind: "member", organization: row.organization as Organization, role: row.role }));

  const clientSpaces: Space[] = (clientRes.data ?? [])
    .filter((row: any) => !!row.organization)
    .map((row: any) => ({ kind: "client", organization: row.organization as Organization, clientUserId: userId }));

  return { data: [...memberSpaces, ...clientSpaces], error: null };
}

export async function getOrganizationByClientCode(code: string) {
  const { data, error } = await supabase
    .from("organizations")
    .select(ORGANIZATION_COLUMNS)
    .eq("client_invite_code", code.trim().toUpperCase())
    .maybeSingle();

  return { data: data as Organization | null, error };
}

export async function joinOrganizationAsClient(params: { organizationId: string; userId: string; dataConsent: boolean }) {
  const { organizationId, userId, dataConsent } = params;
  const { error } = await supabase.from("organization_clients").insert({
    organization_id: organizationId,
    user_id: userId,
    data_consent: dataConsent,
    data_consent_at: dataConsent ? new Date().toISOString() : null,
  });

  if (!error) {
    // Autoatestiguado (client_activity_log_insert_access ya permite esto vía
    // client_space_can_access, porque auth.uid() = client_user_id).
    await logClientActivity({
      organizationId,
      clientUserId: userId,
      actorId: userId,
      action: "client_joined",
      entityName: "este espacio",
    });
  }

  return { error };
}
