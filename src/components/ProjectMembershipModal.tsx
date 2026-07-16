import React, { useEffect, useState } from "react";
import { Image, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Folder, X } from "lucide-react-native";
import { Project, STATUS_LABELS, getProjectMembershipSince } from "../lib/projects";

function formatSince(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

type Props = {
  visible: boolean;
  project: Project | null;
  userId: string;
  isDark: boolean;
  onClose: () => void;
};

// Se abre al tocar un proyecto en la sección "Proyectos" de ProfileScreen
// (Punto 1 del feedback) — muestra desde cuándo el usuario trabaja ahí,
// mismo lenguaje visual que BadgeDetailModal.
export default function ProjectMembershipModal({ visible, project, userId, isDark, onClose }: Props) {
  const [since, setSince] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !project) return;
    setLoading(true);
    setSince(null);
    getProjectMembershipSince(project.id, userId).then(({ data }) => {
      setSince(data);
      setLoading(false);
    });
  }, [visible, project?.id, userId]);

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

  if (!project) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
          <View style={styles.header}>
            <View style={[styles.icon, { backgroundColor: project.color + "20" }]}>
              {project.iconUrl ? (
                <Image source={{ uri: project.iconUrl }} style={styles.iconImage} />
              ) : (
                <Folder size={18} color={project.color} strokeWidth={2.2} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: textPrimary }]} numberOfLines={1}>
                {project.name}
              </Text>
              <Text style={[styles.desc, { color: textSecondary }]}>{STATUS_LABELS[project.status]}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={18} color={textSecondary} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <View style={[styles.metaRow, { backgroundColor: inputBg, borderColor: border }]}>
            <Text style={[styles.metaText, { color: textSecondary }]}>
              {loading
                ? "Buscando desde cuándo trabajas acá…"
                : since
                ? (
                  <>
                    Trabajas en este proyecto desde{" "}
                    <Text style={{ fontWeight: "700", color: textPrimary }}>{formatSince(since)}</Text>
                  </>
                )
                : "No pudimos determinar desde cuándo trabajas en este proyecto."}
            </Text>
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
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  iconImage: { width: 40, height: 40, resizeMode: "cover" },
  title: { fontSize: 15, fontWeight: "700" },
  desc: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  metaRow: { borderWidth: 1, borderRadius: 16, padding: 12, marginTop: 16 },
  metaText: { fontSize: 12.5, fontWeight: "600", lineHeight: 18 },
});
