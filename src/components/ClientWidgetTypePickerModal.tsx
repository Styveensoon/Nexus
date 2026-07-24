import React from "react";
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ClipboardList, FileCheck2, FolderKanban, MessageCircle, Sparkles, X } from "lucide-react-native";
import { CLIENT_WIDGET_TYPES, ClientHomeSectionType } from "../lib/clientHome";

// Elegir el tipo de widget nuevo a agregar al home de un cliente — mismo
// patrón de overlay que TaskStatusPickerModal, pero cada fila lleva además
// una descripción corta (el tipo de widget no es un valor autoexplicativo
// como un status).
const ICONS: Record<string, any> = {
  Sparkles,
  FolderKanban,
  ClipboardList,
  MessageCircle,
  FileCheck2,
};

type Props = {
  visible: boolean;
  isDark: boolean;
  onClose: () => void;
  onSelect: (type: ClientHomeSectionType) => void;
};

export default function ClientWidgetTypePickerModal({ visible, isDark, onClose, onSelect }: Props) {
  const cardBg        = isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.85)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = "#2C7BD1";
  const iconBg        = isDark ? "rgba(255,255,255,0.06)" : "rgba(44,123,209,0.08)";

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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: textPrimary }]}>Agregar widget</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color={textSecondary} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <View style={{ gap: 8 }}>
            {CLIENT_WIDGET_TYPES.map((w) => {
              const Icon = ICONS[w.icon] ?? Sparkles;
              return (
                <TouchableOpacity
                  key={w.type}
                  activeOpacity={0.8}
                  onPress={() => onSelect(w.type)}
                  style={styles.row}
                >
                  <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
                    <Icon size={18} color={primaryColor} strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: textPrimary }]}>{w.label}</Text>
                    <Text style={[styles.rowDescription, { color: textSecondary }]}>{w.description}</Text>
                  </View>
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
  card: { width: "100%", maxWidth: 420, borderRadius: 28, borderWidth: 1, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title: { fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 16, padding: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 14, fontWeight: "700" },
  rowDescription: { fontSize: 12, marginTop: 2, lineHeight: 17 },
});
