import React from "react";
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Check, X } from "lucide-react-native";
import { ProjectStatus, STATUS_COLORS, STATUS_LABELS, STATUS_ORDER } from "../lib/projects";

// Mismo patrón que TaskStatusPickerModal.tsx — selección directa de un status
// en vez de ciclar uno por uno, ahora que ProjectStatus también tiene 8
// valores posibles (antes 4, ver docs/ESTADO.md).
type Props = {
  visible: boolean;
  isDark: boolean;
  currentStatus: ProjectStatus | null;
  onClose: () => void;
  onSelect: (status: ProjectStatus) => void;
};

export default function ProjectStatusPickerModal({ visible, isDark, currentStatus, onClose, onSelect }: Props) {
  const cardBg        = isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.85)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";

  const ultraShadow = {
    ...Platform.select({
      web: {
        boxShadow: isDark
          ? "0 30px 60px -25px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.08) inset"
          : "0 30px 60px -22px rgba(44,123,209,0.18), 0 1px 0 rgba(255,255,255,0.9) inset",
        backdropFilter: "blur(32px) saturate(200%)",
      } as any,
      default: {
        shadowColor: isDark ? "#000" : "#2C7BD1",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: isDark ? 0.35 : 0.1,
        shadowRadius: 22,
        elevation: 6,
      },
    }),
    borderTopColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.9)",
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: textPrimary }]}>Cambiar status</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color={textSecondary} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <View style={{ gap: 4 }}>
            {STATUS_ORDER.map((status) => {
              const color = STATUS_COLORS[status];
              const selected = currentStatus === status;
              return (
                <TouchableOpacity
                  key={status}
                  activeOpacity={0.8}
                  onPress={() => onSelect(status)}
                  style={[styles.row, { backgroundColor: selected ? color + "18" : "transparent" }]}
                >
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <Text style={[styles.rowLabel, { color: selected ? color : textPrimary, fontWeight: selected ? "700" : "600" }]}>
                    {STATUS_LABELS[status]}
                  </Text>
                  {selected && <Check size={16} color={color} strokeWidth={2.3} />}
                </TouchableOpacity>
              );
            })}
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
  card: { width: "100%", maxWidth: 320, borderRadius: 28, borderWidth: 1, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title: { fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowLabel: { fontSize: 14, flex: 1 },
});
