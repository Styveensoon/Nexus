import { supabase } from "./supabase";

// El Semillero como copiloto continuo (docs/ARQUITECTURA.md) — a diferencia
// de team_suggestion (arma un proyecto/equipo nuevo, una sola vez), esto
// analiza un proyecto YA EN MARCHA y sugiere reasignaciones puntuales. Mismo
// patrón que requestBadgeSuggestions: no se persiste, se recalcula cada vez
// que se pide.
export type RebalanceSuggestion = {
  taskId: string;
  taskTitle: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  reason: string;
};

export async function requestRebalanceSuggestions(projectId: string) {
  const { data, error } = await supabase.functions.invoke("semillero-rebalance", {
    body: { projectId },
  });

  if (error) return { data: [] as RebalanceSuggestion[], error };
  return { data: (data?.suggestions ?? []) as RebalanceSuggestion[], error: null };
}
