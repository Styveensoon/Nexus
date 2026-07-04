import React from "react";
import { Image, Linking, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Calendar, FileText, Link2, X } from "lucide-react-native";
import { ActivityEntry, describeActivity } from "../lib/activity";
import { getBadgeDefinitionByLabel } from "../lib/badges";

function formatFullDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

function formatAttachmentDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

type Props = {
  visible: boolean;
  entry: ActivityEntry | null;
  isDark: boolean;
  primaryColor: string;
  onClose: () => void;
};

// Detalle completo al hacer click en una fila de actividad (Punto 4 del
// feedback) — antes solo se veía "quién hizo qué" + hora; acá se muestra el
// contenido real cuando lo hay (ej. el texto de un comentario), no solo la
// descripción genérica. Cubre los 12 tipos de ActivityAction, no solo
// comentarios.
export default function ActivityDetailModal({ visible, entry, isDark, primaryColor, onClose }: Props) {
  const cardBg        = isDark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.92)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";

  if (!entry) return null;

  function renderBody() {
    if (!entry) return null;

    switch (entry.action) {
      case "task_comment_created": {
        const hasText = !!entry.metadata.commentContent;
        const attachmentType = entry.metadata.attachmentType as string | null | undefined;
        const attachmentUrl = entry.metadata.attachmentUrl as string | null | undefined;
        const attachmentName = entry.metadata.attachmentName as string | null | undefined;
        const hasAttachment = !!attachmentType && !!attachmentUrl;
        // Distingue "no quedó nada guardado" (comentario de antes de esta
        // función) de "el comentario realmente no tenía texto" — antes se
        // asumía siempre lo segundo, lo cual era engañoso para comentarios
        // viejos que sí tenían texto pero no metadata.
        const hasAnyDetail = "commentContent" in entry.metadata;

        return (
          <View style={{ gap: 10 }}>
            {hasText && (
              <View style={[styles.quoteBox, { backgroundColor: inputBg, borderLeftColor: primaryColor }]}>
                <Text style={{ color: textPrimary, fontSize: 13.5, lineHeight: 20 }}>{entry.metadata.commentContent}</Text>
              </View>
            )}

            {hasAttachment && attachmentType === "image" && (
              <TouchableOpacity activeOpacity={0.85} onPress={() => Linking.openURL(attachmentUrl!)}>
                <Image source={{ uri: attachmentUrl! }} style={styles.attachmentImage} />
              </TouchableOpacity>
            )}
            {hasAttachment && attachmentType === "link" && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => Linking.openURL(attachmentUrl!)}
                style={[styles.attachmentChip, { backgroundColor: inputBg, borderColor: border }]}
              >
                <Link2 size={14} color={primaryColor} />
                <Text style={{ color: primaryColor, fontSize: 12.5, fontWeight: "600", flexShrink: 1, textDecorationLine: "underline" }} numberOfLines={1}>
                  {attachmentUrl}
                </Text>
              </TouchableOpacity>
            )}
            {hasAttachment && attachmentType === "file" && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => Linking.openURL(attachmentUrl!)}
                style={[styles.attachmentChip, { backgroundColor: inputBg, borderColor: border }]}
              >
                <FileText size={14} color={primaryColor} />
                <Text style={{ color: textPrimary, fontSize: 12.5, fontWeight: "600", flexShrink: 1 }} numberOfLines={1}>
                  {attachmentName ?? "Archivo adjunto"}
                </Text>
              </TouchableOpacity>
            )}
            {hasAttachment && attachmentType === "date" && (
              <View style={[styles.attachmentChip, { backgroundColor: inputBg, borderColor: border }]}>
                <Calendar size={14} color={primaryColor} />
                <Text style={{ color: textPrimary, fontSize: 12.5, fontWeight: "600", textTransform: "capitalize" }}>
                  {formatAttachmentDate(attachmentUrl!)}
                </Text>
              </View>
            )}

            {!hasText && !hasAttachment && (
              <Text style={{ color: textSecondary, fontSize: 13 }}>
                {hasAnyDetail
                  ? "Este comentario no tenía texto ni adjunto."
                  : "Este comentario es de antes de que Nexus guardara el detalle completo — revisa el chat de la tarea para verlo."}
              </Text>
            )}
          </View>
        );
      }

      case "task_status_changed":
      case "project_status_changed":
        return entry.metadata.fromLabel ? (
          <View style={styles.statusChangeRow}>
            <View style={[styles.statusPill, { backgroundColor: inputBg, borderColor: border }]}>
              <Text style={{ color: textSecondary, fontSize: 12, fontWeight: "700" }}>{entry.metadata.fromLabel}</Text>
            </View>
            <Text style={{ color: textSecondary, fontSize: 13 }}>→</Text>
            <View style={[styles.statusPill, { backgroundColor: primaryColor + "20", borderColor: primaryColor }]}>
              <Text style={{ color: primaryColor, fontSize: 12, fontWeight: "700" }}>{entry.metadata.toLabel}</Text>
            </View>
          </View>
        ) : (
          <Text style={{ color: textSecondary, fontSize: 13 }}>Nuevo estado: {entry.metadata.toLabel ?? entry.metadata.toStatus}</Text>
        );

      case "badge_granted":
      case "badge_revoked": {
        const definition = getBadgeDefinitionByLabel(entry.entityName);
        return (
          <View style={{ gap: 6 }}>
            <Text style={{ color: textPrimary, fontSize: 13.5 }}>
              {entry.action === "badge_granted" ? "Otorgado a" : "Quitado de"}{" "}
              <Text style={{ fontWeight: "700" }}>{entry.targetName ?? "alguien"}</Text>
            </Text>
            {definition && <Text style={{ color: textSecondary, fontSize: 13, lineHeight: 19 }}>{definition.description}</Text>}
          </View>
        );
      }

      case "project_deleted":
      case "team_deleted":
      case "task_deleted":
        return (
          <Text style={{ color: textSecondary, fontSize: 13 }}>
            "{entry.entityName}" ya no existe — este registro queda como historial de que existió.
          </Text>
        );

      case "member_joined":
        return (
          <Text style={{ color: textSecondary, fontSize: 13 }}>
            {entry.actorName} se unió usando el código de invitación de la organización.
          </Text>
        );

      default:
        return (
          <Text style={{ color: textSecondary, fontSize: 13 }}>
            {entry.actorName} {describeActivity(entry)}.
          </Text>
        );
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: textPrimary, fontSize: 14, lineHeight: 20 }}>
                <Text style={{ fontWeight: "700" }}>{entry.actorName}</Text> {describeActivity(entry)}
              </Text>
              <Text style={{ color: textSecondary, fontSize: 12, marginTop: 4 }}>{formatFullDateTime(entry.createdAt)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={18} color={textSecondary} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <View style={[styles.divider, { backgroundColor: border }]} />

          {renderBody()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(2, 6, 23, 0.5)", alignItems: "center", justifyContent: "center", padding: 20,
    ...Platform.select({ web: { backdropFilter: "blur(4px)" } as any, default: {} }),
  },
  card: { width: "100%", maxWidth: 420, borderRadius: 24, borderWidth: 1, padding: 20 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  divider: { height: 1, marginVertical: 16 },
  quoteBox: { borderLeftWidth: 3, borderRadius: 10, padding: 14 },
  attachmentImage: { width: "100%", height: 160, borderRadius: 12, resizeMode: "cover" },
  attachmentChip: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  statusChangeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
});
