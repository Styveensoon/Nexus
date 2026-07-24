import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Folder,
  Menu,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import {
  addMessage,
  AriaChat,
  AriaContextType,
  AriaMessage,
  askAria,
  autoTitle,
  createChat,
  deleteChat,
  deleteMessage,
  getMessages,
  listChats,
  renameChat,
  touchChat,
} from "../lib/aria";
import { listProjects, Project } from "../lib/projects";

// Aria — el Semillero reciclado como asistente general (docs/ARQUITECTURA.md),
// accesible a cualquier miembro (no solo owner). Calco de SemilleroScreen.tsx
// (mismo layout de sidebar + chat + composer, mismo criterio de vidrio/blur)
// pero sin team_suggestion — Aria no arma equipos, ayuda a entender lo que ya
// existe. Modo de contexto ("free"/"project"/"task") se elige ANTES de
// mandar el primer mensaje de una conversación nueva; una vez creado el
// chat, el contexto queda fijo para esa conversación (coherente con cómo
// funciona un hilo real).
const AZURE_DEEP = "#2C7BD1";

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(iso).toLocaleDateString();
}

const CONTEXT_ICONS: Record<AriaContextType, any> = { free: MessageCircle, project: Folder, task: CheckCircle2 };

export default function AriaScreen({ navigation, route }: any) {
  const { isDark } = useTheme();
  const { user, organization } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = Platform.OS === "web";

  // Contexto prefijado desde un atajo (ProjectDetailScreen/TasksScreen) —
  // si viene, la conversación nueva arranca directo en ese modo, sin mostrar
  // el selector.
  const presetContextType: AriaContextType | undefined = route?.params?.contextType;
  const presetContextId: string | undefined = route?.params?.contextId;
  const presetContextLabel: string | undefined = route?.params?.contextLabel;

  const bg            = isDark ? "#0B1220" : "#F1F5FA";
  const panelBg       = isDark ? "rgba(15, 23, 42, 0.6)" : "rgba(255, 255, 255, 0.7)";
  const cardBg        = isDark ? "rgba(17, 24, 39, 0.58)" : "rgba(255, 255, 255, 0.6)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = AZURE_DEEP;
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";
  const bubbleAssistantBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.65)";
  const dangerColor   = "#EF4444";

  const rootStyle: any = isWeb ? { position: "fixed", top: 0, left: 0, right: 0, bottom: 0 } : { flex: 1 };

  const ultraShadow = {
    ...Platform.select({
      web: {
        boxShadow: isDark
          ? "0 30px 60px -25px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.08) inset"
          : "0 30px 60px -22px rgba(44,123,209,0.18), 0 1px 0 rgba(255,255,255,0.9) inset",
        backdropFilter: "blur(32px) saturate(200%)",
      } as any,
      default: {},
    }),
    borderTopColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.9)",
  };

  const bubbleGlass = Platform.select({ web: { backdropFilter: "blur(20px) saturate(180%)" } as any, default: {} });

  const [chats, setChats] = useState<AriaChat[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AriaMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteChatId, setConfirmDeleteChatId] = useState<string | null>(null);

  // Selección de contexto para una conversación NUEVA (solo aplica mientras
  // activeChatId es null) — "free" por defecto, o lo que venga prefijado.
  const [draftContextType, setDraftContextType] = useState<AriaContextType>(presetContextType ?? "free");
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [orgProjects, setOrgProjects] = useState<Project[]>([]);
  const [draftProject, setDraftProject] = useState<{ id: string; name: string } | null>(
    presetContextType === "project" && presetContextId && presetContextLabel ? { id: presetContextId, name: presetContextLabel } : null
  );

  const scrollRef = useRef<ScrollView>(null);

  const loadChats = useCallback(async () => {
    if (!organization || !user) return;
    setLoadingChats(true);
    const { data } = await listChats(organization.id, user.id);
    setChats(data);
    setLoadingChats(false);
  }, [organization, user]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    if (organization) listProjects(organization.id).then(({ data }) => setOrgProjects(data));
  }, [organization]);

  const openChat = useCallback(async (chat: AriaChat) => {
    setActiveChatId(chat.id);
    setErrorText(null);
    setSidebarOpen(false);
    setLoadingMessages(true);
    const { data } = await getMessages(chat.id);
    setMessages(data);
    setLoadingMessages(false);
  }, []);

  const startNewChat = useCallback(() => {
    setActiveChatId(null);
    setMessages([]);
    setErrorText(null);
    setSidebarOpen(false);
    setDraftContextType(presetContextType ?? "free");
    setDraftProject(presetContextType === "project" && presetContextId && presetContextLabel ? { id: presetContextId, name: presetContextLabel } : null);
  }, [presetContextType, presetContextId, presetContextLabel]);

  const confirmDeleteChat = useCallback(
    async (chatId: string) => {
      setConfirmDeleteChatId(null);
      await deleteChat(chatId);
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (activeChatId === chatId) startNewChat();
    },
    [activeChatId, startNewChat]
  );

  const startRename = useCallback((chat: AriaChat) => {
    setRenamingChatId(chat.id);
    setRenameValue(chat.title);
  }, []);

  const commitRename = useCallback(
    async (chatId: string) => {
      const title = renameValue.trim() || "Nueva conversación";
      setRenamingChatId(null);
      await renameChat(chatId, title);
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title } : c)));
    },
    [renameValue]
  );

  const activeContextType: AriaContextType = activeChatId
    ? chats.find((c) => c.id === activeChatId)?.context_type ?? "free"
    : draftContextType;

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !organization || !user) return;
    if (draftContextType === "project" && !activeChatId && !draftProject) return;

    setErrorText(null);
    setInput("");
    setSending(true);

    const optimisticUser: AriaMessage = {
      id: `local-${Date.now()}`,
      chat_id: activeChatId ?? "",
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    const historyBase = messages;
    setMessages((prev) => [...prev, optimisticUser]);

    let chatId = activeChatId;
    const mode: AriaContextType = chatId ? activeContextType : draftContextType;
    const contextId = chatId ? chats.find((c) => c.id === chatId)?.context_id ?? null : mode === "project" ? draftProject?.id ?? null : mode === "task" ? presetContextId ?? null : null;

    try {
      if (!chatId) {
        const { data: newChat, error } = await createChat(organization.id, user.id, autoTitle(text), mode, contextId);
        if (error || !newChat) throw error ?? new Error("No se pudo crear la conversación");
        chatId = newChat.id;
        setActiveChatId(chatId);
        setChats((prev) => [newChat, ...prev]);
      }

      await addMessage(chatId, "user", text);

      const history = [...historyBase, optimisticUser].map((m) => ({ role: m.role, content: m.content }));
      const { data, error } = await askAria(organization.id, mode, contextId, history);
      if (error || !data) throw error ?? new Error("No se pudo contactar a Aria");

      const { data: savedAssistant } = await addMessage(chatId, "assistant", data.reply);
      const assistantMessage: AriaMessage = savedAssistant ?? {
        id: `local-${Date.now()}-a`,
        chat_id: chatId,
        role: "assistant",
        content: data.reply,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      await touchChat(chatId);
      setChats((prev) => {
        const bumped = prev.map((c) => (c.id === chatId ? { ...c, updated_at: new Date().toISOString() } : c));
        return [...bumped].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      });
    } catch (err: any) {
      setErrorText(err?.message || "No se pudo conectar con Aria. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setSending(false);
    }
  }, [input, sending, organization, user, activeChatId, messages, draftContextType, draftProject, activeContextType, chats, presetContextId]);

  const handleRegenerate = useCallback(async () => {
    const last = messages[messages.length - 1];
    if (sending || !activeChatId || !organization || !last || last.role !== "assistant") return;

    setSending(true);
    setErrorText(null);
    const historyWithoutLast = messages.slice(0, -1);
    const chat = chats.find((c) => c.id === activeChatId);

    try {
      const history = historyWithoutLast.map((m) => ({ role: m.role, content: m.content }));
      const { data, error } = await askAria(organization.id, chat?.context_type ?? "free", chat?.context_id ?? null, history);
      if (error || !data) throw error ?? new Error("No se pudo contactar a Aria");

      await deleteMessage(last.id);
      const { data: savedAssistant } = await addMessage(activeChatId, "assistant", data.reply);
      const assistantMessage: AriaMessage = savedAssistant ?? {
        id: `local-${Date.now()}-a`,
        chat_id: activeChatId,
        role: "assistant",
        content: data.reply,
        created_at: new Date().toISOString(),
      };
      setMessages([...historyWithoutLast, assistantMessage]);
      await touchChat(activeChatId);
    } catch (err: any) {
      setErrorText(err?.message || "No se pudo regenerar la respuesta. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  }, [messages, sending, activeChatId, organization, chats]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, sending]);

  if (!organization) return null;

  const sidebar = (
    <View style={[styles.sidebar, { backgroundColor: panelBg, borderColor: border }]}>
      <View style={styles.sidebarHeader}>
        <Text style={[styles.sidebarTitle, { color: textPrimary }]}>Tus conversaciones</Text>
        {isMobile && (
          <TouchableOpacity onPress={() => setSidebarOpen(false)}>
            <X size={20} color={textSecondary} strokeWidth={2.2} />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity activeOpacity={0.85} style={[styles.newChatBtn, { backgroundColor: primaryColor }]} onPress={startNewChat}>
        <Plus size={16} color="#FFF" strokeWidth={2.2} />
        <Text style={styles.newChatBtnText}>Nueva conversación</Text>
      </TouchableOpacity>

      <View style={[{ flex: 1, minHeight: 0, marginTop: 8 }, isWeb && ({ overflow: "hidden" } as any)]}>
        <ScrollView style={{ flex: 1, minHeight: 0 }} showsVerticalScrollIndicator={false}>
          {loadingChats ? (
            <ActivityIndicator color={primaryColor} style={{ marginTop: 20 }} />
          ) : chats.length === 0 ? (
            <Text style={[styles.emptyChatsText, { color: textSecondary }]}>Todavía no tienes ninguna conversación.</Text>
          ) : (
            chats.map((chat) => {
              const active = chat.id === activeChatId;
              const Icon = CONTEXT_ICONS[chat.context_type];

              if (renamingChatId === chat.id) {
                return (
                  <View key={chat.id} style={[styles.chatItem, { borderColor: primaryColor }]}>
                    <TextInput
                      value={renameValue}
                      onChangeText={setRenameValue}
                      autoFocus
                      style={[styles.renameInput, { color: textPrimary }, isWeb && styles.inputNoOutline]}
                      onSubmitEditing={() => commitRename(chat.id)}
                    />
                    <TouchableOpacity hitSlop={8} onPress={() => commitRename(chat.id)}>
                      <Check size={16} color={primaryColor} strokeWidth={2.2} />
                    </TouchableOpacity>
                    <TouchableOpacity hitSlop={8} onPress={() => setRenamingChatId(null)}>
                      <X size={16} color={textSecondary} strokeWidth={2.2} />
                    </TouchableOpacity>
                  </View>
                );
              }

              if (confirmDeleteChatId === chat.id) {
                return (
                  <View key={chat.id} style={[styles.chatItem, { borderColor: dangerColor }]}>
                    <Text style={[styles.confirmDeleteText, { color: textPrimary }]} numberOfLines={2}>
                      ¿Borrar esta conversación? No se puede deshacer.
                    </Text>
                    <TouchableOpacity hitSlop={8} onPress={() => confirmDeleteChat(chat.id)}>
                      <Check size={16} color={dangerColor} strokeWidth={2.2} />
                    </TouchableOpacity>
                    <TouchableOpacity hitSlop={8} onPress={() => setConfirmDeleteChatId(null)}>
                      <X size={16} color={textSecondary} strokeWidth={2.2} />
                    </TouchableOpacity>
                  </View>
                );
              }

              return (
                <TouchableOpacity
                  key={chat.id}
                  activeOpacity={0.8}
                  style={[
                    styles.chatItem,
                    { borderColor: border },
                    active && { backgroundColor: isDark ? "rgba(126,200,245,0.14)" : "rgba(44,123,209,0.08)" },
                  ]}
                  onPress={() => openChat(chat)}
                >
                  <Icon size={14} color={textSecondary} strokeWidth={2.2} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.chatItemTitle, { color: textPrimary }]} numberOfLines={1}>
                      {chat.title}
                    </Text>
                    <Text style={[styles.chatItemDate, { color: textSecondary }]}>{relativeTime(chat.updated_at)}</Text>
                  </View>
                  <TouchableOpacity hitSlop={8} onPress={() => startRename(chat)}>
                    <Pencil size={13} color={textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity hitSlop={8} onPress={() => setConfirmDeleteChatId(chat.id)}>
                    <Trash2 size={14} color={textSecondary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>
    </View>
  );

  const showContextSelector = !activeChatId && !presetContextType;

  return (
    <View style={[styles.container, { backgroundColor: bg, overflow: "hidden" }, rootStyle]}>
      {!isMobile && sidebar}
      {isMobile && sidebarOpen && (
        <View style={styles.mobileSidebarOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSidebarOpen(false)} />
          {sidebar}
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1, minHeight: 0 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.topBar, { borderColor: border, backgroundColor: panelBg }]}>
          <View style={styles.topBarLeft}>
            {isMobile ? (
              <TouchableOpacity onPress={() => setSidebarOpen(true)} style={styles.iconBtn}>
                <Menu size={18} color={textSecondary} strokeWidth={2.2} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                <ArrowLeft size={18} color={textSecondary} strokeWidth={2.2} />
              </TouchableOpacity>
            )}
            <View style={[styles.logoIcon, { backgroundColor: primaryColor }]}>
              <Sparkles size={16} color="#FFF" strokeWidth={2.2} />
            </View>
            <Text style={[styles.logoText, { color: textPrimary }]}>Aria</Text>
          </View>
        </View>

        {!activeChatId && presetContextLabel && (
          <View style={[styles.presetBanner, { backgroundColor: inputBg, borderColor: border }]}>
            {React.createElement(CONTEXT_ICONS[presetContextType ?? "free"], { size: 13, color: primaryColor, strokeWidth: 2.3 })}
            <Text style={{ color: textSecondary, fontSize: 12.5 }} numberOfLines={1}>
              Hablando sobre: <Text style={{ color: textPrimary, fontWeight: "700" }}>{presetContextLabel}</Text>
            </Text>
          </View>
        )}

        {showContextSelector && (
          <View style={[styles.contextSelectorWrap, { backgroundColor: inputBg, borderColor: border }]}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.contextChip,
                { borderColor: border },
                draftContextType === "free" && { backgroundColor: primaryColor + "20", borderColor: primaryColor },
              ]}
              onPress={() => {
                setDraftContextType("free");
                setShowProjectPicker(false);
              }}
            >
              <MessageCircle size={13} color={draftContextType === "free" ? primaryColor : textSecondary} strokeWidth={2.3} />
              <Text style={{ color: draftContextType === "free" ? primaryColor : textPrimary, fontSize: 12.5, fontWeight: "700" }}>
                Chat general
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.contextChip,
                { borderColor: border },
                draftContextType === "project" && { backgroundColor: primaryColor + "20", borderColor: primaryColor },
              ]}
              onPress={() => {
                setDraftContextType("project");
                setShowProjectPicker(true);
              }}
            >
              <Folder size={13} color={draftContextType === "project" ? primaryColor : textSecondary} strokeWidth={2.3} />
              <Text style={{ color: draftContextType === "project" ? primaryColor : textPrimary, fontSize: 12.5, fontWeight: "700" }}>
                {draftProject ? draftProject.name : "Sobre un proyecto"}
              </Text>
            </TouchableOpacity>

            {showProjectPicker && draftContextType === "project" && (
              <View style={[styles.projectPickerList, { borderColor: border }]}>
                {orgProjects.length === 0 ? (
                  <Text style={{ color: textSecondary, fontSize: 12.5, padding: 10 }}>No hay proyectos en tu organización.</Text>
                ) : (
                  orgProjects.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      activeOpacity={0.8}
                      style={styles.projectPickerRow}
                      onPress={() => {
                        setDraftProject({ id: p.id, name: p.name });
                        setShowProjectPicker(false);
                      }}
                    >
                      <View style={[styles.projectDot, { backgroundColor: p.color }]} />
                      <Text style={{ color: textPrimary, fontSize: 13, fontWeight: "600" }}>{p.name}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>
        )}

        <View style={[{ flex: 1, minHeight: 0 }, isWeb && ({ overflow: "hidden" } as any)]}>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={{ padding: isMobile ? 16 : 32, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ width: "100%", maxWidth: 720, alignSelf: "center" }}>
              {loadingMessages ? (
                <ActivityIndicator color={primaryColor} style={{ marginTop: 40 }} />
              ) : messages.length === 0 ? (
                <View style={styles.heroEmpty}>
                  <Text style={[styles.heroTitle, { color: textPrimary }]}>Hola, soy Aria</Text>
                  <Text style={[styles.heroSubtitle, { color: textSecondary }]}>
                    Preguntame lo que necesites sobre tu organización, un proyecto o una tarea — te respondo con datos reales,
                    nunca invento algo que no sepa.
                  </Text>
                </View>
              ) : (
                messages.map((msg) => (
                  <View key={msg.id} style={styles.bubbleRow}>
                    <View
                      style={[
                        styles.bubble,
                        bubbleGlass,
                        { alignSelf: msg.role === "user" ? "flex-end" : "flex-start" },
                        msg.role === "user"
                          ? { backgroundColor: primaryColor, borderBottomRightRadius: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" }
                          : { backgroundColor: bubbleAssistantBg, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: border },
                      ]}
                    >
                      <Text style={[styles.bubbleText, { color: msg.role === "user" ? "#FFF" : textPrimary }]}>{msg.content}</Text>
                    </View>
                  </View>
                ))
              )}

              {!sending && !loadingMessages && messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
                <TouchableOpacity activeOpacity={0.7} style={styles.regenerateBtn} onPress={handleRegenerate}>
                  <RefreshCw size={13} color={textSecondary} />
                  <Text style={[styles.regenerateBtnText, { color: textSecondary }]}>Regenerar respuesta</Text>
                </TouchableOpacity>
              )}

              {sending && (
                <View style={styles.bubbleRow}>
                  <View style={[styles.bubble, bubbleGlass, { backgroundColor: bubbleAssistantBg, borderWidth: 1, borderColor: border, flexDirection: "row", gap: 8 }]}>
                    <ActivityIndicator size="small" color={textSecondary} />
                    <Text style={[styles.bubbleText, { color: textSecondary }]}>Pensando…</Text>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </View>

        <View style={[styles.composerWrapper, { borderColor: border, backgroundColor: panelBg }]}>
          <View style={{ width: "100%", maxWidth: 720, alignSelf: "center" }}>
            {errorText && (
              <View style={[styles.errorBanner, { borderColor: dangerColor }]}>
                <Text style={[styles.errorText, { color: dangerColor }]}>{errorText}</Text>
              </View>
            )}
            <View style={[styles.composerRow, { backgroundColor: inputBg, borderColor: border }]}>
              <TextInput
                placeholder="Preguntale algo a Aria…"
                placeholderTextColor={textSecondary}
                value={input}
                onChangeText={setInput}
                multiline
                style={[styles.composerInput, { color: textPrimary }, isWeb && styles.inputNoOutline]}
                onSubmitEditing={handleSend}
                editable={!sending}
              />
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={!input.trim() || sending || (showContextSelector && draftContextType === "project" && !draftProject)}
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor: primaryColor,
                    opacity: !input.trim() || sending || (showContextSelector && draftContextType === "project" && !draftProject) ? 0.5 : 1,
                  },
                ]}
                onPress={handleSend}
              >
                <Send size={16} color="#FFF" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, flexDirection: "row" },

  sidebar: { width: 280, borderRightWidth: 1, padding: 16 },
  sidebarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sidebarTitle: { fontSize: 16, fontWeight: "700" },
  newChatBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, paddingVertical: 12 },
  newChatBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  emptyChatsText: { fontSize: 12.5, lineHeight: 18, textAlign: "center", marginTop: 24, paddingHorizontal: 8 },
  chatItem: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 8 },
  chatItemTitle: { fontSize: 13, fontWeight: "700" },
  chatItemDate: { fontSize: 11, marginTop: 2 },
  renameInput: { flex: 1, fontSize: 13, fontWeight: "700", paddingVertical: 2 },
  confirmDeleteText: { flex: 1, fontSize: 12, fontWeight: "700", lineHeight: 16 },

  mobileSidebarOverlay: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 20, backgroundColor: "rgba(0,0,0,0.4)", flexDirection: "row" },

  topBar: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, paddingHorizontal: 16, height: 60 },
  topBarLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  logoIcon: { width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: 15, fontWeight: "700", letterSpacing: -0.3 },

  presetBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },

  contextSelectorWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, borderBottomWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  contextChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  projectPickerList: { width: "100%", borderWidth: 1, borderRadius: 14, marginTop: 8, maxHeight: 200, overflow: "hidden" },
  projectPickerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  projectDot: { width: 8, height: 8, borderRadius: 4 },

  heroEmpty: { alignItems: "center", justifyContent: "center", flex: 1, paddingTop: 60 },
  heroTitle: { fontSize: 26, fontWeight: "700", letterSpacing: -0.8, marginBottom: 10, textAlign: "center" },
  heroSubtitle: { fontSize: 14.5, lineHeight: 21, textAlign: "center", maxWidth: 480 },

  bubbleRow: { marginBottom: 16 },
  bubble: { maxWidth: "85%", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, alignSelf: "flex-start" },
  bubbleText: { fontSize: 14.5, lineHeight: 21 },

  regenerateBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginBottom: 16, paddingVertical: 4 },
  regenerateBtnText: { fontSize: 12.5, fontWeight: "700" },

  composerWrapper: { borderTopWidth: 1, padding: 16 },
  errorBanner: { borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 10 },
  errorText: { fontSize: 12.5, lineHeight: 18, fontWeight: "600" },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  composerInput: { flex: 1, fontSize: 14.5, maxHeight: 120, paddingVertical: 8 },
  inputNoOutline: { outlineStyle: "none" } as any,
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
