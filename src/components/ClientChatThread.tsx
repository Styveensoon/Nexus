import React, { useEffect, useState } from "react";
import { Image, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import {
  Calendar,
  FileText,
  Heart,
  HelpCircle,
  Link2,
  Reply,
  Send,
  SmilePlus,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react-native";
import ChatAttachmentButtons from "./ChatAttachmentButtons";
import DatePickerModal from "./DatePickerModal";
import {
  CLIENT_REACTION_TYPES,
  ClientMessage,
  ClientMessageAttachment,
  ClientReactionType,
  deleteClientMessage,
  listClientMessages,
  reactToClientMessage,
  sendClientMessage,
  uploadClientAttachment,
} from "../lib/clients";

// Chat persistente cliente<->equipo (docs/CLIENTE.md §5) — calco casi 1:1 del
// chat de comentarios de tasks (TasksScreen.tsx: burbujas WhatsApp,
// reacciones, respuesta citada, 4 tipos de adjunto), pero self-contained
// (fetch propio, mismo criterio que ProfileEditorForm.tsx) porque se reusa
// tanto del lado cliente (ClientChatScreen) como del lado staff
// (ClientDetailScreen) con distinto currentUserId.
const AZURE_DEEP = "#2C7BD1";
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

const REACTION_ICONS: Record<ClientReactionType, any> = {
  like: ThumbsUp,
  heart: Heart,
  dislike: ThumbsDown,
  question: HelpCircle,
};

const REACTION_COLORS: Record<ClientReactionType, string> = {
  like: AZURE_DEEP,
  heart: "#EF4444",
  dislike: "#F97316",
  question: "#94A3B8",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatAttachmentDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function attachmentLabel(attachment: ClientMessageAttachment) {
  if (attachment.type === "date") return formatAttachmentDate(attachment.url);
  if (attachment.type === "link") return attachment.url;
  return attachment.name ?? "Adjunto";
}

function renderLinkifiedText(text: string, linkColor: string) {
  return text.split(URL_REGEX).map((part, idx) =>
    /^https?:\/\//.test(part) ? (
      <Text key={idx} style={{ color: linkColor, fontWeight: "700", textDecorationLine: "underline" }} onPress={() => Linking.openURL(part)}>
        {part}
      </Text>
    ) : (
      <Text key={idx}>{part}</Text>
    )
  );
}

type Props = {
  organizationId: string;
  clientUserId: string;
  currentUserId: string;
  isDark: boolean;
  maxHeight?: number;
};

export default function ClientChatThread({ organizationId, clientUserId, currentUserId, isDark, maxHeight = 420 }: Props) {
  const isWeb = Platform.OS === "web";

  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ClientMessage | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<ClientMessageAttachment | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkInputValue, setLinkInputValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);

  const bg            = isDark ? "#0B1220" : "#F1F5FA";
  const cardBg        = isDark ? "rgba(17, 24, 39, 0.68)" : "rgba(255, 255, 255, 0.72)";
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = AZURE_DEEP;
  const dangerColor   = "#EF4444";

  const refresh = async () => {
    const { data } = await listClientMessages(organizationId, clientUserId);
    setMessages(data);
  };

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, clientUserId]);

  const handlePickDate = (isoDate: string) => {
    setPendingAttachment({ url: isoDate, type: "date", name: null });
    setShowDatePicker(false);
  };

  const confirmLinkInput = () => {
    const value = linkInputValue.trim();
    setShowLinkInput(false);
    if (!value) return;
    const url = /^https?:\/\//.test(value) ? value : `https://${value}`;
    setPendingAttachment({ url, type: "link", name: null });
    setLinkInputValue("");
  };

  const handleAttachmentReady = async (
    data: ArrayBuffer | File,
    contentType: string,
    ext: string,
    name: string,
    kind: "image" | "file"
  ) => {
    setError(null);
    setUploadingAttachment(true);
    const { url, error: uploadError } = await uploadClientAttachment(currentUserId, data, contentType, ext);
    setUploadingAttachment(false);
    if (uploadError || !url) {
      setError("No pudimos subir el adjunto, intenta de nuevo.");
      return;
    }
    setPendingAttachment({ url, type: kind, name });
  };

  const handleSend = async () => {
    if (!input.trim() && !pendingAttachment) return;
    setPosting(true);
    const { error: sendError } = await sendClientMessage({
      organizationId,
      clientUserId,
      senderId: currentUserId,
      content: input.trim(),
      replyToId: replyingTo?.id ?? null,
      attachmentUrl: pendingAttachment?.url ?? null,
      attachmentType: pendingAttachment?.type ?? null,
      attachmentName: pendingAttachment?.name ?? null,
    });
    setPosting(false);
    if (sendError) {
      setError("No se pudo enviar el mensaje.");
      return;
    }
    setError(null);
    setInput("");
    setReplyingTo(null);
    setPendingAttachment(null);
    await refresh();
  };

  const handleDelete = async (messageId: string) => {
    setConfirmDeleteId(null);
    const { error: deleteError } = await deleteClientMessage(messageId);
    if (deleteError) {
      setError("No se pudo borrar el mensaje.");
      return;
    }
    await refresh();
  };

  const handleReact = async (messageId: string, reaction: ClientReactionType) => {
    setReactionPickerFor(null);
    const { error: reactError } = await reactToClientMessage(messageId, currentUserId, reaction);
    if (reactError) {
      setError("No se pudo reaccionar.");
      return;
    }
    await refresh();
  };

  return (
    <View>
      <View style={[styles.chatContainer, { backgroundColor: inputBg, borderColor: border }]}>
        <ScrollView
          style={{ maxHeight }}
          contentContainerStyle={styles.chatScrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {loading ? (
            <Text style={{ color: textSecondary, fontSize: 12.5 }}>Cargando mensajes…</Text>
          ) : messages.length === 0 ? (
            <Text style={{ color: textSecondary, fontSize: 12.5 }}>Todavía no hay mensajes. Escribe el primero.</Text>
          ) : (
            messages.map((m) => {
              const isMine = m.senderId === currentUserId;
              const reactionEntries = CLIENT_REACTION_TYPES.filter((rt) => m.reactions.counts[rt] > 0);
              return (
                <View key={m.id} style={[styles.commentRow, isMine && styles.commentRowMine]}>
                  {!isMine && (
                    <View style={[styles.avatarMini, { backgroundColor: m.authorAvatarColor }]}>
                      <Text style={styles.avatarMiniText}>{initials(m.authorName)}</Text>
                    </View>
                  )}
                  <View style={{ flexShrink: 1 }}>
                    <View
                      style={[
                        styles.commentBubble,
                        isMine ? styles.commentBubbleMine : styles.commentBubbleTheirs,
                        { backgroundColor: isMine ? primaryColor + "18" : cardBg, borderColor: isMine ? primaryColor + "40" : border },
                      ]}
                    >
                      <View style={{ flexDirection: "row", gap: 8, alignItems: "baseline" }}>
                        {!isMine && <Text style={{ color: textPrimary, fontSize: 12.5, fontWeight: "700" }}>{m.authorName}</Text>}
                        <Text style={{ color: textSecondary, fontSize: 11 }}>{formatTime(m.createdAt)}</Text>
                      </View>

                      {m.replyTo && (
                        <View style={[styles.replyQuote, { borderLeftColor: primaryColor, backgroundColor: bg }]}>
                          <Text style={{ color: primaryColor, fontSize: 11, fontWeight: "700" }}>{m.replyTo.authorName}</Text>
                          <Text style={{ color: textSecondary, fontSize: 11.5 }} numberOfLines={1}>
                            {m.replyTo.content || "Archivo adjunto"}
                          </Text>
                        </View>
                      )}

                      {!!m.content && (
                        <Text style={{ color: textSecondary, fontSize: 13, lineHeight: 18, marginTop: 4 }}>
                          {renderLinkifiedText(m.content, primaryColor)}
                        </Text>
                      )}

                      {m.attachment &&
                        (m.attachment.type === "image" ? (
                          <TouchableOpacity activeOpacity={0.85} onPress={() => Linking.openURL(m.attachment!.url)} style={{ marginTop: 8 }}>
                            <Image source={{ uri: m.attachment.url }} style={styles.attachmentImage} />
                          </TouchableOpacity>
                        ) : m.attachment.type === "link" ? (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => Linking.openURL(m.attachment!.url)}
                            style={[styles.attachmentFileChip, { backgroundColor: bg, borderColor: border }]}
                          >
                            <Link2 size={14} color={primaryColor} />
                            <Text
                              style={{ color: primaryColor, fontSize: 12, fontWeight: "600", flexShrink: 1, textDecorationLine: "underline" }}
                              numberOfLines={1}
                            >
                              {m.attachment.url}
                            </Text>
                          </TouchableOpacity>
                        ) : m.attachment.type === "date" ? (
                          <View style={[styles.attachmentFileChip, { backgroundColor: bg, borderColor: border }]}>
                            <Calendar size={14} color={primaryColor} />
                            <Text style={{ color: textPrimary, fontSize: 12, fontWeight: "600", flexShrink: 1, textTransform: "capitalize" }} numberOfLines={1}>
                              {formatAttachmentDate(m.attachment.url)}
                            </Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => Linking.openURL(m.attachment!.url)}
                            style={[styles.attachmentFileChip, { backgroundColor: bg, borderColor: border }]}
                          >
                            <FileText size={14} color={primaryColor} />
                            <Text style={{ color: textPrimary, fontSize: 12, fontWeight: "600", flexShrink: 1 }} numberOfLines={1}>
                              {m.attachment.name ?? "Archivo adjunto"}
                            </Text>
                          </TouchableOpacity>
                        ))}
                    </View>

                    {reactionEntries.length > 0 && (
                      <View style={[styles.reactionSummaryRow, isMine && styles.reactionSummaryRowMine]}>
                        {reactionEntries.map((rt) => {
                          const Icon = REACTION_ICONS[rt];
                          const mine = m.reactions.myReaction === rt;
                          return (
                            <TouchableOpacity
                              key={rt}
                              activeOpacity={0.7}
                              onPress={() => handleReact(m.id, rt)}
                              style={[styles.reactionChip, { backgroundColor: mine ? REACTION_COLORS[rt] + "22" : inputBg, borderColor: mine ? REACTION_COLORS[rt] : border }]}
                            >
                              <Icon size={11} color={REACTION_COLORS[rt]} fill={mine ? REACTION_COLORS[rt] : "none"} />
                              <Text style={{ color: REACTION_COLORS[rt], fontSize: 10.5, fontWeight: "700" }}>{m.reactions.counts[rt]}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {reactionPickerFor === m.id && (
                      <View style={[styles.reactionPicker, { backgroundColor: cardBg, borderColor: border }, isMine && styles.reactionPickerMine]}>
                        {CLIENT_REACTION_TYPES.map((rt) => {
                          const Icon = REACTION_ICONS[rt];
                          const active = m.reactions.myReaction === rt;
                          return (
                            <TouchableOpacity
                              key={rt}
                              hitSlop={6}
                              activeOpacity={0.7}
                              onPress={() => handleReact(m.id, rt)}
                              style={[styles.reactionPickerBtn, active && { backgroundColor: REACTION_COLORS[rt] + "25" }]}
                            >
                              <Icon size={16} color={REACTION_COLORS[rt]} fill={active ? REACTION_COLORS[rt] : "none"} />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {confirmDeleteId === m.id ? (
                      <View style={[styles.commentActionsRow, isMine && styles.commentActionsRowMine]}>
                        <Text style={{ color: textSecondary, fontSize: 11 }}>¿Borrar mensaje?</Text>
                        <TouchableOpacity activeOpacity={0.7} onPress={() => handleDelete(m.id)}>
                          <Text style={{ color: dangerColor, fontSize: 11, fontWeight: "700" }}>Sí, borrar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity activeOpacity={0.7} onPress={() => setConfirmDeleteId(null)}>
                          <Text style={{ color: textSecondary, fontSize: 11, fontWeight: "700" }}>Cancelar</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={[styles.commentActionsRow, isMine && styles.commentActionsRowMine]}>
                        <TouchableOpacity activeOpacity={0.7} onPress={() => setReplyingTo(m)} style={styles.replyLink}>
                          <Reply size={11} color={textSecondary} />
                          <Text style={{ color: textSecondary, fontSize: 11, fontWeight: "700" }}>Responder</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => setReactionPickerFor(reactionPickerFor === m.id ? null : m.id)}
                          style={styles.replyLink}
                        >
                          <SmilePlus size={11} color={textSecondary} />
                          <Text style={{ color: textSecondary, fontSize: 11, fontWeight: "700" }}>Reaccionar</Text>
                        </TouchableOpacity>
                        {isMine && (
                          <TouchableOpacity activeOpacity={0.7} onPress={() => setConfirmDeleteId(m.id)} style={styles.replyLink}>
                            <Trash2 size={11} color={textSecondary} />
                            <Text style={{ color: textSecondary, fontSize: 11, fontWeight: "700" }}>Borrar</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>

      {replyingTo && (
        <View style={[styles.inlineBar, { backgroundColor: inputBg, borderColor: border }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: primaryColor, fontSize: 11, fontWeight: "700" }}>Respondiendo a {replyingTo.authorName}</Text>
            <Text style={{ color: textSecondary, fontSize: 11.5 }} numberOfLines={1}>
              {replyingTo.content || "Archivo adjunto"}
            </Text>
          </View>
          <TouchableOpacity hitSlop={8} onPress={() => setReplyingTo(null)}>
            <X size={14} color={textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {pendingAttachment && (
        <View style={[styles.inlineBar, { backgroundColor: inputBg, borderColor: border }]}>
          {pendingAttachment.type === "image" ? (
            <Image source={{ uri: pendingAttachment.url }} style={styles.attachmentPreviewThumb} />
          ) : pendingAttachment.type === "link" ? (
            <Link2 size={16} color={primaryColor} />
          ) : pendingAttachment.type === "date" ? (
            <Calendar size={16} color={primaryColor} />
          ) : (
            <FileText size={16} color={primaryColor} />
          )}
          <Text
            style={{ color: textPrimary, fontSize: 12, fontWeight: "600", flex: 1, textTransform: pendingAttachment.type === "date" ? "capitalize" : "none" }}
            numberOfLines={1}
          >
            {attachmentLabel(pendingAttachment)}
          </Text>
          <TouchableOpacity hitSlop={8} onPress={() => setPendingAttachment(null)}>
            <X size={14} color={textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {showLinkInput && (
        <View style={[styles.inlineBar, { backgroundColor: inputBg, borderColor: border }]}>
          <Link2 size={16} color={primaryColor} />
          <TextInput
            value={linkInputValue}
            onChangeText={setLinkInputValue}
            onSubmitEditing={confirmLinkInput}
            onBlur={confirmLinkInput}
            autoFocus
            placeholder="Pega un enlace…"
            placeholderTextColor={textSecondary}
            style={[{ flex: 1, fontSize: 13, color: textPrimary }, isWeb && styles.noOutline]}
          />
          <TouchableOpacity
            hitSlop={8}
            onPress={() => {
              setShowLinkInput(false);
              setLinkInputValue("");
            }}
          >
            <X size={14} color={textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.chipInputRow, { backgroundColor: inputBg, borderColor: border }]}>
        <ChatAttachmentButtons color={primaryColor} disabled={uploadingAttachment} onAttachmentReady={handleAttachmentReady} onError={setError} />
        <TouchableOpacity hitSlop={8} onPress={() => setShowDatePicker(true)} style={styles.composerIconBtn}>
          <Calendar size={18} color={primaryColor} />
        </TouchableOpacity>
        <TouchableOpacity hitSlop={8} onPress={() => setShowLinkInput(true)} style={styles.composerIconBtn}>
          <Link2 size={18} color={primaryColor} />
        </TouchableOpacity>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          placeholder={uploadingAttachment ? "Subiendo adjunto…" : "Escribe un mensaje…"}
          placeholderTextColor={textSecondary}
          style={[styles.chipInput, { color: textPrimary }, isWeb && styles.noOutline]}
        />
        <TouchableOpacity onPress={handleSend} hitSlop={8} disabled={posting || uploadingAttachment || (!input.trim() && !pendingAttachment)}>
          <Send size={16} color={input.trim() || pendingAttachment ? primaryColor : textSecondary} />
        </TouchableOpacity>
      </View>
      {error && <Text style={{ color: dangerColor, fontSize: 12.5, fontWeight: "600", marginTop: 8 }}>{error}</Text>}

      <DatePickerModal
        visible={showDatePicker}
        initialDate={pendingAttachment?.type === "date" ? pendingAttachment.url : null}
        isDark={isDark}
        onClose={() => setShowDatePicker(false)}
        onConfirm={handlePickDate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chatContainer: { borderWidth: 1, borderRadius: 20, marginBottom: 12, overflow: "hidden" },
  chatScrollContent: { padding: 14, gap: 16 },

  avatarMini: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  avatarMiniText: { color: "#FFF", fontSize: 10.5, fontWeight: "700" },

  commentRow: { flexDirection: "row", gap: 10, maxWidth: "82%", alignSelf: "flex-start" },
  commentRowMine: { alignSelf: "flex-end" },
  commentBubble: { borderWidth: 1, borderRadius: 16, padding: 12 },
  commentBubbleTheirs: { borderTopLeftRadius: 4 },
  commentBubbleMine: { borderTopRightRadius: 4 },
  commentActionsRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 6 },
  commentActionsRowMine: { justifyContent: "flex-end" },

  reactionSummaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  reactionSummaryRowMine: { justifyContent: "flex-end" },
  reactionChip: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  reactionPicker: { flexDirection: "row", gap: 4, borderWidth: 1, borderRadius: 999, padding: 4, marginTop: 6, alignSelf: "flex-start" },
  reactionPickerMine: { alignSelf: "flex-end" },
  reactionPickerBtn: { padding: 6, borderRadius: 999 },

  replyQuote: { borderLeftWidth: 2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 6 },
  replyLink: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },

  attachmentImage: { width: 200, height: 150, borderRadius: 14, resizeMode: "cover" },
  attachmentFileChip: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginTop: 8, alignSelf: "flex-start", maxWidth: 260 },
  attachmentPreviewThumb: { width: 32, height: 32, borderRadius: 8 },

  inlineBar: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },

  chipInputRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 4 },
  chipInput: { flex: 1, paddingVertical: 12, fontSize: 13 },
  composerIconBtn: { padding: 2 },

  noOutline: { outlineStyle: "none" } as any,
});
