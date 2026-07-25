import { supabase } from "./supabase";
import type { TaskStatus } from "./tasks";

// Automatizaciones por proyecto: reglas "CUANDO <trigger> ENTONCES <acción>",
// gestionadas solo por el líder del proyecto o el owner (mismo criterio que
// crear/editar tasks). Este archivo es solo CRUD + matching puro (sin efectos
// secundarios) — el motor que EJECUTA las acciones vive en tasks.ts
// (runProjectAutomations), no acá, a propósito: automations.ts necesitaría
// importar updateTask/updateTaskStatus/addTaskComment de tasks.ts para
// ejecutar acciones, pero tasks.ts necesita llamar a este archivo para
// evaluar qué automatizaciones corren — un import circular real. Al dejar la
// ejecución en tasks.ts (que ya tiene esas funciones en el mismo scope), se
// evita el ciclo sin sacrificar el criterio de "reusar las mismas funciones
// de escritura, nunca un camino paralelo". Ver el comentario grande en
// schema.sql para el resto del razonamiento, incluida la protección anti-loop.
export type AutomationTriggerType = "task_created" | "task_status_changed" | "task_assigned";
export type AutomationActionType = "change_status" | "change_priority" | "add_label" | "assign_to_user" | "post_comment" | "notify_user";

export const TRIGGER_LABELS: Record<AutomationTriggerType, string> = {
  task_created: "Se crea una tarea",
  task_status_changed: "Una tarea cambia de status",
  task_assigned: "Una tarea se reasigna",
};

export const ACTION_LABELS: Record<AutomationActionType, string> = {
  change_status: "Cambiar el status",
  change_priority: "Cambiar la prioridad",
  add_label: "Agregar una etiqueta",
  assign_to_user: "Reasignar a una persona",
  post_comment: "Comentar automáticamente",
  notify_user: "Notificar a alguien",
};

export type ProjectAutomation = {
  id: string;
  projectId: string;
  name: string;
  triggerType: AutomationTriggerType;
  triggerConfig: Record<string, any>;
  actionType: AutomationActionType;
  actionConfig: Record<string, any>;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
};

const COLUMNS = "id, project_id, name, trigger_type, trigger_config, action_type, action_config, enabled, created_by, created_at";

function mapRow(row: any): ProjectAutomation {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    triggerType: row.trigger_type,
    triggerConfig: row.trigger_config ?? {},
    actionType: row.action_type,
    actionConfig: row.action_config ?? {},
    enabled: row.enabled,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function listProjectAutomations(projectId: string) {
  const { data, error } = await supabase
    .from("project_automations")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return { data: (data ?? []).map(mapRow), error };
}

export async function createAutomation(params: {
  projectId: string;
  createdBy: string;
  name: string;
  triggerType: AutomationTriggerType;
  triggerConfig: Record<string, any>;
  actionType: AutomationActionType;
  actionConfig: Record<string, any>;
}) {
  const { data, error } = await supabase
    .from("project_automations")
    .insert({
      project_id: params.projectId,
      created_by: params.createdBy,
      name: params.name,
      trigger_type: params.triggerType,
      trigger_config: params.triggerConfig,
      action_type: params.actionType,
      action_config: params.actionConfig,
    })
    .select(COLUMNS)
    .single();
  return { data: data ? mapRow(data) : null, error };
}

export async function toggleAutomation(id: string, enabled: boolean) {
  const { error } = await supabase.from("project_automations").update({ enabled }).eq("id", id);
  return { error };
}

export async function deleteAutomation(id: string) {
  const { error } = await supabase.from("project_automations").delete().eq("id", id);
  return { error };
}

// Eventos que pueden disparar automatizaciones — emitidos desde tasks.ts justo
// después de que la mutación real (creación/cambio de status/reasignación) ya
// tuvo éxito. `actorUserId`/`organizationId` viajan en el evento porque el
// motor corre en el mismo tick que la acción humana original: no hay "usuario
// actual" propio de una automatización, todo se atribuye a quien disparó el
// trigger.
export type AutomationEvent =
  | { type: "task_created"; taskId: string; projectId: string; organizationId: string; actorUserId: string }
  | {
      type: "task_status_changed";
      taskId: string;
      projectId: string;
      organizationId: string;
      actorUserId: string;
      toStatus: TaskStatus;
      fromStatus: TaskStatus;
    }
  | {
      type: "task_assigned";
      taskId: string;
      projectId: string;
      organizationId: string;
      actorUserId: string;
      assignedUserId: string | null;
      assignedTeamId: string | null;
    };

function triggerMatches(automation: ProjectAutomation, event: AutomationEvent): boolean {
  if (automation.triggerType !== event.type) return false;
  if (event.type === "task_status_changed") {
    const wanted = automation.triggerConfig.toStatus;
    return !wanted || wanted === event.toStatus;
  }
  return true;
}

// Trae las reglas del proyecto y devuelve solo las habilitadas cuyo trigger
// calza con el evento — sin ejecutar nada (eso lo hace runProjectAutomations
// en tasks.ts, que reusa esta función).
export async function matchEnabledAutomations(event: AutomationEvent): Promise<ProjectAutomation[]> {
  const { data: automations } = await listProjectAutomations(event.projectId);
  return automations.filter((a) => a.enabled && triggerMatches(a, event));
}
