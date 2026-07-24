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

export type AriaMessage = {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
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

export async function getMessages(chatId: string) {
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("id, chat_id, role, content, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  return { data: (data as AriaMessage[] | null) ?? [], error };
}

export async function addMessage(chatId: string, role: "user" | "assistant", content: string) {
  const { data, error } = await supabase
    .from("assistant_messages")
    .insert({ chat_id: chatId, role, content })
    .select("id, chat_id, role, content, created_at")
    .single();

  return { data: data as AriaMessage | null, error };
}

export async function deleteMessage(messageId: string) {
  const { error } = await supabase.from("assistant_messages").delete().eq("id", messageId);
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
  return { data: data as { reply: string }, error: null };
}
