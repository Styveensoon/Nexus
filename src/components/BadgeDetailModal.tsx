import React from "react";
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { X } from "lucide-react-native";
import { ProfileBadge, getBadgeDefinition } from "../lib/badges";
import { getContrastTextColor } from "../lib/profiles";
import { BADGE_ICONS } from "./BadgePill";

function formatGrantedAt(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

type Props = {
  visible: boolean;
  badge: ProfileBadge | null;
  isDark: boolean;
  onClose: () => void;
};

// "Quién lo otorgó y cuándo" — se abre al tocar cualquier BadgePill ya
// otorgado (ProfileScreen, MemberProfileModal, BadgeAwardModal), mismo
// componente en los 3 lugares para no duplicar esta tarjeta tres veces.
// El ícono/color del header sigue siendo el propio del badge (catálogo);
// el azure acá solo aparece en el chrome genérico (borde, cuadro de meta).
export default function BadgeDetailModal({ visible, badge, isDark, onClose }: Props) {
  const cardBg        = isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.85)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";

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

  const definition = badge ? getBadgeDefinition(badge.badgeKey) : null;
  if (!badge || !definition) return null;

  const Icon = BADGE_ICONS[definition.icon] ?? BADGE_ICONS.Users;
  const iconColor = getContrastTextColor(definition.color);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
          <View style={styles.header}>
            <View style={[styles.icon, { backgroundColor: definition.color }]}>
              <Icon size={18} color={iconColor} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: textPrimary }]}>{definition.label}</Text>
              <Text style={[styles.desc, { color: textSecondary }]}>{definition.description}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={18} color={textSecondary} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <View style={[styles.metaRow, { backgroundColor: inputBg, borderColor: border }]}>
            <Text style={[styles.metaText, { color: textSecondary }]}>
              Otorgado por <Text style={{ fontWeight: "700", color: textPrimary }}>{badge.grantedByName}</Text>
            </Text>
            <Text style={[styles.metaText, { color: textSecondary }]}>{formatGrantedAt(badge.createdAt)}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    ...Platform.select({ web: { backdropFilter: "blur(4px)" } as any, default: {} }),
  },
  card: { width: "100%", maxWidth: 360, borderRadius: 24, borderWidth: 1, padding: 20 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "700" },
  desc: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  metaRow: { borderWidth: 1, borderRadius: 16, padding: 12, marginTop: 16, gap: 4 },
  metaText: { fontSize: 12.5, fontWeight: "600" },
});
