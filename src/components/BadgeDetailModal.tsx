import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
export default function BadgeDetailModal({ visible, badge, isDark, onClose }: Props) {
  const cardBg        = isDark ? "#0F172A" : "#FFFFFF";
  const border        = isDark ? "rgba(51, 65, 85, 0.6)" : "rgba(226, 232, 240, 0.9)";
  const textPrimary   = isDark ? "#F8FAFC" : "#020617";
  const textSecondary = isDark ? "#94A3B8" : "#475569";
  const inputBg       = isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC";

  const definition = badge ? getBadgeDefinition(badge.badgeKey) : null;
  if (!badge || !definition) return null;

  const Icon = BADGE_ICONS[definition.icon] ?? BADGE_ICONS.Users;
  const iconColor = getContrastTextColor(definition.color);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.header}>
            <View style={[styles.icon, { backgroundColor: definition.color }]}>
              <Icon size={18} color={iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: textPrimary }]}>{definition.label}</Text>
              <Text style={[styles.desc, { color: textSecondary }]}>{definition.description}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={18} color={textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.metaRow, { backgroundColor: inputBg, borderColor: border }]}>
            <Text style={[styles.metaText, { color: textSecondary }]}>
              Otorgado por <Text style={{ fontWeight: "800", color: textPrimary }}>{badge.grantedByName}</Text>
            </Text>
            <Text style={[styles.metaText, { color: textSecondary }]}>{formatGrantedAt(badge.createdAt)}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(2, 6, 23, 0.6)", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 360, borderRadius: 20, borderWidth: 1, padding: 20 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "800" },
  desc: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  metaRow: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 16, gap: 4 },
  metaText: { fontSize: 12.5, fontWeight: "600" },
});
