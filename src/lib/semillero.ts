import { supabase } from "./supabase";

export type SemilleroChat = {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type TeamSuggestionMember = {
  userId: string;
  name: string;
  roleInTeam: string;
  reason: string;
};

export type TeamSuggestion = {
  projectName: string;
  leader: { userId: string; name: string; reason: string };
  team: TeamSuggestionMember[];
  firstSteps: string[];
  // Se llenan después de crear el proyecto/equipo real desde esta sugerencia,
  // para que "Ver proyecto"/"Ver equipo" sobreviva a salir de esta pantalla y
  // volver (antes solo vivía en estado local, que se perdía al remontar el
  // componente y causaba un segundo intento de creación).
  createdProjectId?: string;
  createdTeamId?: string;
};

export type SemilleroMessage = {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  team_suggestion: TeamSuggestion | null;
  created_at: string;
};

export function autoTitle(idea: string) {
  const clean = idea.trim().replace(/\s+/g, " ");
  if (!clean) return "Nueva idea";
  return clean.length > 48 ? `${clean.slice(0, 48)}…` : clean;
}

export async function listChats(organizationId: string) {
  const { data, error } = await supabase
    .from("semillero_chats")
    .select("id, organization_id, user_id, title, created_at, updated_at")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });

  return { data: (data as SemilleroChat[] | null) ?? [], error };
}

export async function createChat(organizationId: string, userId: string, title: string) {
  const { data, error } = await supabase
    .from("semillero_chats")
    .insert({ organization_id: organizationId, user_id: userId, title })
    .select("id, organization_id, user_id, title, created_at, updated_at")
    .single();

  return { data: data as SemilleroChat | null, error };
}

export async function touchChat(chatId: string) {
  const { error } = await supabase
    .from("semillero_chats")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", chatId);

  return { error };
}

export async function deleteChat(chatId: string) {
  const { error } = await supabase.from("semillero_chats").delete().eq("id", chatId);
  return { error };
}

export async function renameChat(chatId: string, title: string) {
  const { error } = await supabase.from("semillero_chats").update({ title }).eq("id", chatId);
  return { error };
}

export async function getMessages(chatId: string) {
  const { data, error } = await supabase
    .from("semillero_messages")
    .select("id, chat_id, role, content, team_suggestion, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  return { data: (data as SemilleroMessage[] | null) ?? [], error };
}

export async function addMessage(
  chatId: string,
  role: "user" | "assistant",
  content: string,
  teamSuggestion: TeamSuggestion | null = null
) {
  const { data, error } = await supabase
    .from("semillero_messages")
    .insert({ chat_id: chatId, role, content, team_suggestion: teamSuggestion })
    .select("id, chat_id, role, content, team_suggestion, created_at")
    .single();

  return { data: data as SemilleroMessage | null, error };
}

export async function deleteMessage(messageId: string) {
  const { error } = await supabase.from("semillero_messages").delete().eq("id", messageId);
  return { error };
}

export async function updateMessageTeamSuggestion(messageId: string, teamSuggestion: TeamSuggestion) {
  const { error } = await supabase
    .from("semillero_messages")
    .update({ team_suggestion: teamSuggestion })
    .eq("id", messageId);
  return { error };
}

export async function askSemillero(
  organizationId: string,
  history: { role: "user" | "assistant"; content: string }[]
) {
  const { data, error } = await supabase.functions.invoke("semillero-chat", {
    body: { organizationId, messages: history },
  });

  if (error) return { data: null, error };
  return { data: data as { reply: string; teamSuggestion: TeamSuggestion | null }, error: null };
}
