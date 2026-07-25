import { supabase } from "./supabase";

// Búsqueda global — conecta el input "Buscar…" del Dashboard, que hasta ahora
// era decorativo puro (sin value/onChangeText, ver docs/PATRONES.md sobre
// filosofía anti-fake). Busca en paralelo en proyectos/tareas/equipos dentro
// de la organización actual — no hace falta filtrar por organization_id acá
// porque las policies de select de esas 3 tablas ya lo hacen (mismo criterio
// documentado en TRAMPAS.md: "cuando una policy de select ya resuelve la
// distinción de rol/scope, el cliente no necesita reimplementarla").
export type SearchResultProject = { id: string; name: string; status: string };
export type SearchResultTask = { id: string; title: string; projectId: string; projectName: string; status: string };
export type SearchResultTeam = { id: string; name: string };

export type GlobalSearchResults = {
  projects: SearchResultProject[];
  tasks: SearchResultTask[];
  teams: SearchResultTeam[];
};

const EMPTY_RESULTS: GlobalSearchResults = { projects: [], tasks: [], teams: [] };

export async function globalSearch(organizationId: string, query: string): Promise<GlobalSearchResults> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return EMPTY_RESULTS;
  const pattern = `%${trimmed}%`;

  const [projectsRes, tasksRes, teamsRes] = await Promise.all([
    supabase.from("projects").select("id, name, status").eq("organization_id", organizationId).ilike("name", pattern).limit(6),
    supabase
      .from("tasks")
      .select("id, title, status, project_id, projects!inner(id, name, organization_id)")
      .eq("projects.organization_id", organizationId)
      .ilike("title", pattern)
      .limit(6),
    supabase.from("teams").select("id, name").eq("organization_id", organizationId).ilike("name", pattern).limit(6),
  ]);

  const projects: SearchResultProject[] = (projectsRes.data ?? []).map((p: any) => ({ id: p.id, name: p.name, status: p.status }));
  const tasks: SearchResultTask[] = (tasksRes.data ?? []).map((t: any) => ({
    id: t.id,
    title: t.title,
    projectId: t.project_id,
    projectName: t.projects?.name ?? "Proyecto",
    status: t.status,
  }));
  const teams: SearchResultTeam[] = (teamsRes.data ?? []).map((t: any) => ({ id: t.id, name: t.name }));

  return { projects, tasks, teams };
}
