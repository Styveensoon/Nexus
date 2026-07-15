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
  Crown,
  ListChecks,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import {
  addMessage,
  askSemillero,
  autoTitle,
  createChat,
  deleteChat,
  deleteMessage,
  getMessages,
  listChats,
  renameChat,
  SemilleroChat,
  SemilleroMessage,
  TeamSuggestion,
  touchChat,
  updateMessageTeamSuggestion,
} from "../lib/semillero";
import { createProjectFromSuggestion } from "../lib/projects";
import { createTeamFromSuggestion } from "../lib/teams";
import { listOrganizationMembers } from "../lib/organizations";

// Paleta de marca de Nexus (azure) — acento moderado, no cubre áreas grandes.
const AZURE_DEEP = "#2C7BD1";

// La sugerencia de la IA se guardó hace tiempo y puede referirse a gente que
// ya no está en la organización (p. ej. usuarios de seed_users.sql borrados
// después de generar la sugerencia). Insertar directo produce un error de
// foreign key críptico — validamos antes para dar un mensaje claro.
async function findMissingSuggestionMembers(organizationId: string, suggestion: TeamSuggestion) {
  const { data: roster } = await listOrganizationMembers(organizationId);
  const validIds = new Set(roster.map((m) => m.userId));
  const missingNames = new Set<string>();
  if (!validIds.has(suggestion.leader.userId)) missingNames.add(suggestion.leader.name);
  suggestion.team.forEach((m) => {
    if (!validIds.has(m.userId)) missingNames.add(m.name);
  });
  return Array.from(missingNames);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

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

export default function SemilleroScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const { user, organization } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = Platform.OS === "web";
  const isOwner = !!organization && organization.owner_id === user?.id;

  const bg            = isDark ? "#0B1220" : "#F1F5FA";
  const panelBg       = isDark ? "rgba(15, 23, 42, 0.6)" : "rgba(255, 255, 255, 0.7)";
  const cardBg        = isDark ? "rgba(17, 24, 39, 0.58)" : "rgba(255, 255, 255, 0.6)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = organization?.color ?? AZURE_DEEP;
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";
  const bubbleAssistantBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.65)";
  const dangerColor   = "#EF4444";

  // En web, el wrapper de pantalla de @react-navigation/stack tiene
  // min-height:100% pero NO flex:1 — o sea que crece con el contenido en vez
  // de quedar acotado al viewport. "height: 100vh" no alcanza porque hereda
  // ese contexto ya desbordado. position:fixed lo ancla directo al viewport
  // del navegador sin depender de que los ancestros se comporten bien.
  const rootStyle: any = isWeb
    ? { position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }
    : { flex: 1 };

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

  // Vidrio liviano para las burbujas del chat — mismo criterio de blur que
  // ultraShadow pero sin sombra grande (las burbujas se apilan muy seguido).
  const bubbleGlass = Platform.select({
    web: { backdropFilter: "blur(20px) saturate(180%)" } as any,
    default: {},
  });

  const [chats, setChats] = useState<SemilleroChat[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SemilleroMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteChatId, setConfirmDeleteChatId] = useState<string | null>(null);
  const [creatingProjectFor, setCreatingProjectFor] = useState<string | null>(null);
  const [projectErrorInfo, setProjectErrorInfo] = useState<{ msgId: string; message: string } | null>(null);
  const [creatingTeamFor, setCreatingTeamFor] = useState<string | null>(null);
  const [teamErrorInfo, setTeamErrorInfo] = useState<{ msgId: string; message: string } | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const loadChats = useCallback(async () => {
    if (!organization) return;
    setLoadingChats(true);
    const { data } = await listChats(organization.id);
    setChats(data);
    setLoadingChats(false);
  }, [organization]);

  useEffect(() => {
    if (isOwner) loadChats();
  }, [isOwner, loadChats]);

  const openChat = useCallback(async (chat: SemilleroChat) => {
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
  }, []);

  const confirmDeleteChat = useCallback(
    async (chatId: string) => {
      setConfirmDeleteChatId(null);
      await deleteChat(chatId);
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (activeChatId === chatId) startNewChat();
    },
    [activeChatId, startNewChat]
  );

  const startRename = useCallback((chat: SemilleroChat) => {
    setRenamingChatId(chat.id);
    setRenameValue(chat.title);
  }, []);

  const commitRename = useCallback(
    async (chatId: string) => {
      const title = renameValue.trim() || "Nueva idea";
      setRenamingChatId(null);
      await renameChat(chatId, title);
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title } : c)));
    },
    [renameValue]
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !organization || !user) return;

    setErrorText(null);
    setInput("");
    setSending(true);

    const optimisticUser: SemilleroMessage = {
      id: `local-${Date.now()}`,
      chat_id: activeChatId ?? "",
      role: "user",
      content: text,
      team_suggestion: null,
      created_at: new Date().toISOString(),
    };
    const historyBase = messages;
    setMessages((prev) => [...prev, optimisticUser]);

    let chatId = activeChatId;

    try {
      if (!chatId) {
        const { data: newChat, error } = await createChat(organization.id, user.id, autoTitle(text));
        if (error || !newChat) throw error ?? new Error("No se pudo crear el chat");
        chatId = newChat.id;
        setActiveChatId(chatId);
        setChats((prev) => [newChat, ...prev]);
      }

      await addMessage(chatId, "user", text);

      const history = [...historyBase, optimisticUser].map((m) => ({ role: m.role, content: m.content }));
      const { data, error } = await askSemillero(organization.id, history);
      if (error || !data) throw error ?? new Error("No se pudo contactar a la IA");

      const { data: savedAssistant } = await addMessage(chatId, "assistant", data.reply, data.teamSuggestion);
      const assistantMessage: SemilleroMessage = savedAssistant ?? {
        id: `local-${Date.now()}-a`,
        chat_id: chatId,
        role: "assistant",
        content: data.reply,
        team_suggestion: data.teamSuggestion,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      await touchChat(chatId);
      setChats((prev) => {
        const bumped = prev.map((c) => (c.id === chatId ? { ...c, updated_at: new Date().toISOString() } : c));
        return [...bumped].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      });
    } catch (err: any) {
      setErrorText(
        err?.message || "No se pudo conectar con la IA del Semillero. Revisa tu conexión e intenta de nuevo."
      );
    } finally {
      setSending(false);
    }
  }, [input, sending, organization, user, activeChatId, messages]);

  const handleRegenerate = useCallback(async () => {
    const last = messages[messages.length - 1];
    if (sending || !activeChatId || !organization || !last || last.role !== "assistant") return;

    setSending(true);
    setErrorText(null);
    const historyWithoutLast = messages.slice(0, -1);

    try {
      const history = historyWithoutLast.map((m) => ({ role: m.role, content: m.content }));
      const { data, error } = await askSemillero(organization.id, history);
      if (error || !data) throw error ?? new Error("No se pudo contactar a la IA");

      await deleteMessage(last.id);
      const { data: savedAssistant } = await addMessage(activeChatId, "assistant", data.reply, data.teamSuggestion);
      const assistantMessage: SemilleroMessage = savedAssistant ?? {
        id: `local-${Date.now()}-a`,
        chat_id: activeChatId,
        role: "assistant",
        content: data.reply,
        team_suggestion: data.teamSuggestion,
        created_at: new Date().toISOString(),
      };
      setMessages([...historyWithoutLast, assistantMessage]);
      await touchChat(activeChatId);
    } catch (err: any) {
      setErrorText(err?.message || "No se pudo regenerar la respuesta. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  }, [messages, sending, activeChatId, organization]);

  const handleCreateProject = useCallback(
    async (msg: SemilleroMessage) => {
      if (!organization || !user || !msg.team_suggestion || creatingProjectFor) return;

      if (msg.team_suggestion.createdProjectId) {
        navigation.navigate("Main", { screen: "Projects" });
        return;
      }

      setCreatingProjectFor(msg.id);
      setProjectErrorInfo(null);

      const missingNames = await findMissingSuggestionMembers(organization.id, msg.team_suggestion);
      if (missingNames.length) {
        setCreatingProjectFor(null);
        setProjectErrorInfo({
          msgId: msg.id,
          message: `${missingNames.join(", ")} ya no ${missingNames.length === 1 ? "pertenece" : "pertenecen"} a tu organización. Pide una nueva sugerencia.`,
        });
        return;
      }

      const { data: project, error } = await createProjectFromSuggestion(
        organization.id,
        user.id,
        organization.color,
        msg.team_suggestion
      );
      setCreatingProjectFor(null);

      if (error || !project) {
        setProjectErrorInfo({ msgId: msg.id, message: error?.message || "Error desconocido." });
        return;
      }

      const updatedSuggestion = { ...msg.team_suggestion, createdProjectId: project.id };
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, team_suggestion: updatedSuggestion } : m)));
      await updateMessageTeamSuggestion(msg.id, updatedSuggestion);
      navigation.navigate("Main", { screen: "Projects" });
    },
    [organization, user, creatingProjectFor, navigation]
  );

  const handleCreateTeam = useCallback(
    async (msg: SemilleroMessage) => {
      if (!organization || !user || !msg.team_suggestion || creatingTeamFor) return;

      if (msg.team_suggestion.createdTeamId) {
        navigation.navigate("Main", { screen: "Team" });
        return;
      }

      setCreatingTeamFor(msg.id);
      setTeamErrorInfo(null);

      const missingNames = await findMissingSuggestionMembers(organization.id, msg.team_suggestion);
      if (missingNames.length) {
        setCreatingTeamFor(null);
        setTeamErrorInfo({
          msgId: msg.id,
          message: `${missingNames.join(", ")} ya no ${missingNames.length === 1 ? "pertenece" : "pertenecen"} a tu organización. Pide una nueva sugerencia.`,
        });
        return;
      }

      const { data: team, error } = await createTeamFromSuggestion(
        organization.id,
        user.id,
        organization.color,
        msg.team_suggestion
      );
      setCreatingTeamFor(null);

      if (error || !team) {
        setTeamErrorInfo({ msgId: msg.id, message: error?.message || "Error desconocido." });
        return;
      }

      const updatedSuggestion = { ...msg.team_suggestion, createdTeamId: team.id };
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, team_suggestion: updatedSuggestion } : m)));
      await updateMessageTeamSuggestion(msg.id, updatedSuggestion);
      navigation.navigate("Main", { screen: "Team" });
    },
    [organization, user, creatingTeamFor, navigation]
  );

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, sending]);

  if (!organization || !isOwner) {
    return (
      <View style={[styles.gatedContainer, { backgroundColor: bg, overflow: "hidden" }, rootStyle]}>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <ArrowLeft size={16} color={textSecondary} strokeWidth={2.2} />
          <Text style={[styles.backLinkText, { color: textSecondary }]}>Volver</Text>
        </TouchableOpacity>
        <View style={[styles.gatedCard, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
          <Sparkles size={28} color={primaryColor} strokeWidth={2.2} />
          <Text style={[styles.gatedTitle, { color: textPrimary }]}>El Semillero es cosa del admin</Text>
          <Text style={[styles.gatedSubtitle, { color: textSecondary }]}>
            Por ahora solo el dueño de la organización puede convertir ideas en equipos.
          </Text>
        </View>
      </View>
    );
  }

  const sidebar = (
    <View style={[styles.sidebar, { backgroundColor: panelBg, borderColor: border }]}>
      <View style={styles.sidebarHeader}>
        <Text style={[styles.sidebarTitle, { color: textPrimary }]}>Tus ideas</Text>
        {isMobile && (
          <TouchableOpacity onPress={() => setSidebarOpen(false)}>
            <X size={20} color={textSecondary} strokeWidth={2.2} />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.newChatBtn, { backgroundColor: primaryColor }]}
        onPress={startNewChat}
      >
        <Plus size={16} color="#FFF" strokeWidth={2.2} />
        <Text style={styles.newChatBtnText}>Nueva idea</Text>
      </TouchableOpacity>

      <View style={[{ flex: 1, minHeight: 0, marginTop: 8 }, isWeb && ({ overflow: "hidden" } as any)]}>
        <ScrollView style={{ flex: 1, minHeight: 0 }} showsVerticalScrollIndicator={false}>
          {loadingChats ? (
            <ActivityIndicator color={primaryColor} style={{ marginTop: 20 }} />
          ) : chats.length === 0 ? (
            <Text style={[styles.emptyChatsText, { color: textSecondary }]}>
              Todavía no tienes ninguna idea guardada.
            </Text>
          ) : (
            chats.map((chat) => {
              const active = chat.id === activeChatId;

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
                      ¿Borrar esta idea? No se puede deshacer.
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
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.chatItemTitle, { color: textPrimary }]} numberOfLines={1}>
                      {chat.title}
                    </Text>
                    <Text style={[styles.chatItemDate, { color: textSecondary }]}>
                      {relativeTime(chat.updated_at)}
                    </Text>
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
            <Text style={[styles.logoText, { color: textPrimary }]}>El Semillero</Text>
          </View>
        </View>

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
                <Text style={[styles.heroTitle, { color: textPrimary }]}>Convierte tu idea en un equipo</Text>
                <Text style={[styles.heroSubtitle, { color: textSecondary }]}>
                  Describe tu proyecto. La IA te hará preguntas para entenderlo y, cuando tenga contexto
                  suficiente, sugerirá un equipo y los primeros pasos usando perfiles reales de tu organización.
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
                    <Text style={[styles.bubbleText, { color: msg.role === "user" ? "#FFF" : textPrimary }]}>
                      {msg.content}
                    </Text>
                  </View>
                  {msg.team_suggestion && (
                    <View style={[styles.teamCard, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
                      <View style={styles.teamCardHeader}>
                        <Sparkles size={16} color={primaryColor} strokeWidth={2.2} />
                        <Text style={[styles.teamCardTitle, { color: textPrimary }]}>
                          Equipo sugerido · {msg.team_suggestion.projectName}
                        </Text>
                      </View>

                      <View style={[styles.memberRow, { borderColor: border }]}>
                        <View style={[styles.avatar, { backgroundColor: primaryColor }]}>
                          <Text style={styles.avatarText}>{initials(msg.team_suggestion.leader.name)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.memberNameRow}>
                            <Text style={[styles.memberName, { color: textPrimary }]}>
                              {msg.team_suggestion.leader.name}
                            </Text>
                            <View style={[styles.leaderPill, { backgroundColor: isDark ? "rgba(126,200,245,0.18)" : "rgba(44,123,209,0.1)" }]}>
                              <Crown size={10} color={primaryColor} />
                              <Text style={[styles.leaderPillText, { color: primaryColor }]}>Líder</Text>
                            </View>
                          </View>
                          <Text style={[styles.memberReason, { color: textSecondary }]}>
                            {msg.team_suggestion.leader.reason}
                          </Text>
                        </View>
                      </View>

                      {msg.team_suggestion.team.map((member) => (
                        <View key={member.userId} style={[styles.memberRow, { borderColor: border }]}>
                          <View style={[styles.avatar, { backgroundColor: inputBg, borderWidth: 1, borderColor: border }]}>
                            <Text style={[styles.avatarText, { color: textPrimary }]}>{initials(member.name)}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.memberNameRow}>
                              <Text style={[styles.memberName, { color: textPrimary }]}>{member.name}</Text>
                              <Text style={[styles.memberRole, { color: textSecondary }]}>{member.roleInTeam}</Text>
                            </View>
                            <Text style={[styles.memberReason, { color: textSecondary }]}>{member.reason}</Text>
                          </View>
                        </View>
                      ))}

                      <View style={styles.stepsHeader}>
                        <ListChecks size={14} color={textSecondary} strokeWidth={2.2} />
                        <Text style={[styles.stepsTitle, { color: textSecondary }]}>Primeros pasos</Text>
                      </View>
                      {msg.team_suggestion.firstSteps.map((step, idx) => (
                        <View key={idx} style={styles.stepRow}>
                          <Text style={[styles.stepNumber, { color: primaryColor }]}>{idx + 1}.</Text>
                          <Text style={[styles.stepText, { color: textPrimary }]}>{step}</Text>
                        </View>
                      ))}

                      <View style={styles.suggestionActionsRow}>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          disabled={creatingProjectFor === msg.id}
                          style={[
                            styles.createProjectBtn,
                            { backgroundColor: primaryColor, opacity: creatingProjectFor === msg.id ? 0.6 : 1 },
                          ]}
                          onPress={() => handleCreateProject(msg)}
                        >
                          <Users size={16} color="#FFF" strokeWidth={2.2} />
                          <Text style={styles.createProjectBtnText}>
                            {msg.team_suggestion.createdProjectId
                              ? "Ver proyecto"
                              : creatingProjectFor === msg.id
                              ? "Creando…"
                              : "Crear proyecto"}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.85}
                          disabled={creatingTeamFor === msg.id}
                          style={[
                            styles.createProjectBtn,
                            { backgroundColor: inputBg, borderWidth: 1, borderColor: border, opacity: creatingTeamFor === msg.id ? 0.6 : 1 },
                          ]}
                          onPress={() => handleCreateTeam(msg)}
                        >
                          <Users size={16} color={textPrimary} strokeWidth={2.2} />
                          <Text style={[styles.createProjectBtnText, { color: textPrimary }]}>
                            {msg.team_suggestion.createdTeamId
                              ? "Ver equipo"
                              : creatingTeamFor === msg.id
                              ? "Creando…"
                              : "Crear equipo"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {projectErrorInfo?.msgId === msg.id && (
                        <Text style={[styles.projectErrorText, { color: dangerColor }]}>
                          No se pudo crear el proyecto: {projectErrorInfo.message}
                        </Text>
                      )}
                      {teamErrorInfo?.msgId === msg.id && (
                        <Text style={[styles.projectErrorText, { color: dangerColor }]}>
                          No se pudo crear el equipo: {teamErrorInfo.message}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              ))
            )}

            {!sending && !loadingMessages && messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.regenerateBtn}
                onPress={handleRegenerate}
              >
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
                placeholder="Describe tu idea…"
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
                disabled={!input.trim() || sending}
                style={[styles.sendBtn, { backgroundColor: primaryColor, opacity: !input.trim() || sending ? 0.5 : 1 }]}
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

  gatedContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  backLink: { position: "absolute", top: 32, left: 40, flexDirection: "row", alignItems: "center", gap: 8 },
  backLinkText: { fontSize: 14, fontWeight: "600" },
  gatedCard: { borderRadius: 28, borderWidth: 1, padding: 32, alignItems: "center", gap: 10, maxWidth: 420 },
  gatedTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  gatedSubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },

  sidebar: { width: 280, borderRightWidth: 1, padding: 16 },
  sidebarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sidebarTitle: { fontSize: 16, fontWeight: "700" },
  newChatBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 16, paddingVertical: 12,
  },
  newChatBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  emptyChatsText: { fontSize: 12.5, lineHeight: 18, textAlign: "center", marginTop: 24, paddingHorizontal: 8 },
  chatItem: {
    flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 16, borderWidth: 1,
    padding: 12, marginBottom: 8,
  },
  chatItemTitle: { fontSize: 13, fontWeight: "700" },
  chatItemDate: { fontSize: 11, marginTop: 2 },
  renameInput: { flex: 1, fontSize: 13, fontWeight: "700", paddingVertical: 2 },
  confirmDeleteText: { flex: 1, fontSize: 12, fontWeight: "700", lineHeight: 16 },

  mobileSidebarOverlay: {
    position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 20,
    backgroundColor: "rgba(0,0,0,0.4)", flexDirection: "row",
  },

  topBar: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, paddingHorizontal: 16, height: 60 },
  topBarLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  logoIcon: { width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: 15, fontWeight: "700", letterSpacing: -0.3 },

  heroEmpty: { alignItems: "center", justifyContent: "center", flex: 1, paddingTop: 60 },
  heroTitle: { fontSize: 26, fontWeight: "700", letterSpacing: -0.8, marginBottom: 10, textAlign: "center" },
  heroSubtitle: { fontSize: 14.5, lineHeight: 21, textAlign: "center", maxWidth: 480 },

  bubbleRow: { marginBottom: 16 },
  bubble: { maxWidth: "85%", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, alignSelf: "flex-start" },
  bubbleText: { fontSize: 14.5, lineHeight: 21 },

  regenerateBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginBottom: 16, paddingVertical: 4 },
  regenerateBtnText: { fontSize: 12.5, fontWeight: "700" },

  teamCard: { borderRadius: 26, borderWidth: 1, padding: 18, marginTop: 10 },
  teamCardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  teamCardTitle: { fontSize: 14, fontWeight: "700" },
  memberRow: { flexDirection: "row", gap: 12, paddingVertical: 10, borderTopWidth: 1, borderColor: "transparent" },
  avatar: { width: 36, height: 36, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  memberNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  memberName: { fontSize: 13.5, fontWeight: "700" },
  memberRole: { fontSize: 12, fontWeight: "600" },
  memberReason: { fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  leaderPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  leaderPillText: { fontSize: 10, fontWeight: "700" },

  stepsHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, marginBottom: 6 },
  stepsTitle: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  stepRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  stepNumber: { fontSize: 13, fontWeight: "700" },
  stepText: { flex: 1, fontSize: 13, lineHeight: 19 },

  suggestionActionsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  createProjectBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 999, paddingVertical: 14,
  },
  createProjectBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  projectErrorText: { fontSize: 12.5, fontWeight: "600", marginTop: 8, textAlign: "center" },

  composerWrapper: { borderTopWidth: 1, padding: 16 },
  errorBanner: { borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 10 },
  errorText: { fontSize: 12.5, lineHeight: 18, fontWeight: "600" },
  composerRow: {
    flexDirection: "row", alignItems: "flex-end", gap: 10, borderWidth: 1, borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  composerInput: { flex: 1, fontSize: 14.5, maxHeight: 120, paddingVertical: 8 },
  inputNoOutline: { outlineStyle: "none" } as any,
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
