import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Check, X } from "lucide-react-native";
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS, TASK_STATUS_ORDER, TaskStatus } from "../lib/tasks";

// Reemplaza el viejo "tocar el badge cicla al siguiente status" — con 8
// estados posibles, cicular uno por uno era lento. Acá se elige directo,
// mismo patrón de overlay que TimezoneModal/LanguageModal/DatePickerModal.
type Props = {
  visible: boolean;
  isDark: boolean;
  currentStatus: TaskStatus | null;
  onClose: () => void;
  onSelect: (status: TaskStatus) => void;
};

export default function TaskStatusPickerModal({ visible, isDark, currentStatus, onClose, onSelect }: Props) {
  const cardBg        = isDark ? "#0F172A" : "#FFFFFF";
  const border        = isDark ? "rgba(51, 65, 85, 0.6)" : "rgba(226, 232, 240, 0.9)";
  const textPrimary   = isDark ? "#F8FAFC" : "#020617";
  const textSecondary = isDark ? "#94A3B8" : "#475569";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: textPrimary }]}>Cambiar status</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color={textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={{ gap: 4 }}>
            {TASK_STATUS_ORDER.map((status) => {
              const color = TASK_STATUS_COLORS[status];
              const selected = currentStatus === status;
              return (
                <TouchableOpacity
                  key={status}
                  activeOpacity={0.8}
                  onPress={() => onSelect(status)}
                  style={[styles.row, { backgroundColor: selected ? color + "18" : "transparent" }]}
                >
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <Text style={[styles.rowLabel, { color: selected ? color : textPrimary, fontWeight: selected ? "800" : "600" }]}>
                    {TASK_STATUS_LABELS[status]}
                  </Text>
                  {selected && <Check size={16} color={color} />}
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
  overlay: { flex: 1, backgroundColor: "rgba(2, 6, 23, 0.6)", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 320, borderRadius: 24, borderWidth: 1, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowLabel: { fontSize: 14, flex: 1 },
});
