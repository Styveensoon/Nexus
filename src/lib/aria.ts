import { supabase } from "./supabase";

// Aria — el Semillero reciclado como asistente general (accesible a
// cualquier miembro, no solo owner). Capa de datos calcada de
// src/lib/semillero.ts (mismo patrón de chats/mensajes) pero sin
// team_suggestion — Aria no arma equipos, ayuda a entender lo que ya existe.
export type AriaContextType = "free" | "project" | "task";

export type AriaChat = {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  context_type: AriaContextType;
  context_id: string | null;
  created_at: string;
  updated_at: string;
};

// Acción propuesta por Aria sobre la tarea del contexto de este chat (solo
// aplica en modo "task", ver aria-assistant/index.ts). "state" es el estado
// de la CARD (pendiente/ya decidida) — distinto de "status", que cuando
// type === "update_status" es el status objetivo de la TAREA (ej. "in_progress").
export type AriaActionType = "update_status" | "update_due_date" | "update_start_date" | "update_priority" | "reassign";

export type AriaProposedAction = {
  type: AriaActionType;
  taskId: string;
  taskTitle: string;
  description: string;
  state: "pending" | "applied" | "dismissed";
  status?: string;
  dueDate?: string;
  startDate?: string;
  priority?: string;
  assigneeUserId?: string;
  assigneeName?: string;
};

// Tarjeta de detalle de una tarea que Aria decidió mostrar junto a su
// respuesta (en vez de describirla en prosa larga) — datos ya resueltos
// 100% server-side (aria-assistant/index.ts, resolveTaskCards), nunca texto
// libre que el modelo haya escrito. status/priority son los valores crudos
// del enum (TaskStatus/TaskPriority de lib/tasks.ts) para poder reusar
// TASK_STATUS_LABELS/COLORS y TASK_PRIORITY_LABELS/COLORS al pintarla.
export type AriaTaskCard = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  startDate: string | null;
  assigneeLabel: string;
};

// Tarjeta de resumen del PROYECTO en sí (distinta de una AriaTaskCard) —
// solo aplica en modo "project", cuando la respuesta describe el proyecto en
// general (metas/áreas/status/líder/conteo de tareas) en vez del detalle de
// una tarea puntual. Mismo criterio: datos 100% reales resueltos server-side.
export type AriaProjectCard = {
  name: string;
  description: string | null;
  status: string;
  goals: string[];
  areas: string[];
  leaderName: string | null;
  teamNames: string[];
  memberCount: number;
  tasksTotal: number;
  tasksCompleted: number;
  tasksOverdue: number;
  tasksBlocked: number;
};

export type AriaMessage = {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  proposedAction: AriaProposedAction | null;
  taskCards: AriaTaskCard[];
  projectCard: AriaProjectCard | null;
  created_at: string;
};

export function autoTitle(text: string) {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "Nueva conversación";
  return clean.length > 48 ? `${clean.slice(0, 48)}…` : clean;
}

export async function listChats(organizationId: string, userId: string) {
  const { data, error } = await supabase
    .from("assistant_chats")
    .select("id, organization_id, user_id, title, context_type, context_id, created_at, updated_at")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  return { data: (data as AriaChat[] | null) ?? [], error };
}

export async function createChat(
  organizationId: string,
  userId: string,
  title: string,
  contextType: AriaContextType,
  contextId: string | null
) {
  const { data, error } = await supabase
    .from("assistant_chats")
    .insert({ organization_id: organizationId, user_id: userId, title, context_type: contextType, context_id: contextId })
    .select("id, organization_id, user_id, title, context_type, context_id, created_at, updated_at")
    .single();

  return { data: data as AriaChat | null, error };
}

export async function touchChat(chatId: string) {
  const { error } = await supabase.from("assistant_chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
  return { error };
}

export async function deleteChat(chatId: string) {
  const { error } = await supabase.from("assistant_chats").delete().eq("id", chatId);
  return { error };
}

export async function renameChat(chatId: string, title: string) {
  const { error } = await supabase.from("assistant_chats").update({ title }).eq("id", chatId);
  return { error };
}

const MESSAGE_COLUMNS = "id, chat_id, role, content, proposed_action, task_cards, project_card, created_at";

function mapMessageRow(row: any): AriaMessage {
  return { ...row, proposedAction: row.proposed_action ?? null, taskCards: row.task_cards ?? [], projectCard: row.project_card ?? null };
}

export async function getMessages(chatId: string) {
  const { data, error } = await supabase
    .from("assistant_messages")
    .select(MESSAGE_COLUMNS)
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  return { data: (data ?? []).map(mapMessageRow), error };
}

export async function addMessage(
  chatId: string,
  role: "user" | "assistant",
  content: string,
  proposedAction?: AriaProposedAction | null,
  taskCards?: AriaTaskCard[],
  projectCard?: AriaProjectCard | null
) {
  const { data, error } = await supabase
    .from("assistant_messages")
    .insert({
      chat_id: chatId,
      role,
      content,
      proposed_action: proposedAction ?? null,
      task_cards: taskCards?.length ? taskCards : null,
      project_card: projectCard ?? null,
    })
    .select(MESSAGE_COLUMNS)
    .single();

  return { data: data ? mapMessageRow(data) : null, error };
}

export async function deleteMessage(messageId: string) {
  const { error } = await supabase.from("assistant_messages").delete().eq("id", messageId);
  return { error };
}

// Marca la card de una acción propuesta como aplicada o descartada — se
// llama DESPUÉS de que la escritura real (updateTask/updateTaskStatus) ya
// tuvo éxito en el caso de "applied", nunca antes.
export async function resolveProposedAction(messageId: string, proposedAction: AriaProposedAction, state: "applied" | "dismissed") {
  const { error } = await supabase
    .from("assistant_messages")
    .update({ proposed_action: { ...proposedAction, state } })
    .eq("id", messageId);
  return { error };
}

export async function askAria(
  organizationId: string,
  mode: AriaContextType,
  contextId: string | null,
  history: { role: "user" | "assistant"; content: string }[]
) {
  const { data, error } = await supabase.functions.invoke("aria-assistant", {
    body: { organizationId, mode, contextId, messages: history },
  });

  if (error) return { data: null, error };
  return {
    data: data as {
      reply: string;
      proposedAction: Omit<AriaProposedAction, "state"> | null;
      taskCards: AriaTaskCard[];
      projectCard: AriaProjectCard | null;
    },
    error: null,
  };
}
