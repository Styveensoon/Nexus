import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MessageCircle } from "lucide-react-native";
import { ClientMessage, listClientMessages } from "../../lib/clients";

// Teaser del tab Chat (docs/CLIENTE.md §6/§5) — Chat sigue siendo un tab
// completo e intacto, esto es solo un resumen con link. Self-contained.
type Props = {
  isDark: boolean;
  organizationId: string;
  clientUserId: string;
  onGoToChat: () => void;
};

export default function ChatPreviewWidget({ isDark, organizationId, clientUserId, onGoToChat }: Props) {
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const cardBg        = isDark ? "rgba(17, 24, 39, 0.6)" : "rgba(255, 255, 255, 0.6)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = "#2C7BD1";

  useEffect(() => {
    let active = true;
    listClientMessages(organizationId, clientUserId).then(({ data }) => {
      if (active) {
        setMessages(data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [organizationId, clientUserId]);

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

  const lastMessages = messages.slice(-3).reverse();

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
      <View style={styles.header}>
        <MessageCircle size={16} color={primaryColor} strokeWidth={2.2} />
        <Text style={[styles.title, { color: textPrimary }]}>Chat</Text>
      </View>

      {loading ? (
        <Text style={{ color: textSecondary, fontSize: 12.5 }}>Cargando…</Text>
      ) : lastMessages.length === 0 ? (
        <Text style={{ color: textSecondary, fontSize: 12.5 }}>Todavía no hay mensajes.</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {lastMessages.map((m) => (
            <View key={m.id}>
              <Text style={[styles.authorName, { color: textPrimary }]}>{m.authorName}</Text>
              <Text style={[styles.messageLine, { color: textSecondary }]} numberOfLines={1}>
                {m.content || (m.attachment ? "Envió un adjunto" : "")}
              </Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity onPress={onGoToChat} style={{ marginTop: 12 }}>
        <Text style={{ color: primaryColor, fontSize: 12.5, fontWeight: "700" }}>Ir al chat completo</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 24, padding: 18 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  title: { fontSize: 14.5, fontWeight: "700" },
  authorName: { fontSize: 12, fontWeight: "700" },
  messageLine: { fontSize: 12, marginTop: 1 },
});
