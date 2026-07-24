import React, { useEffect, useState } from "react";
import { Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Check, FolderKanban, Search, Users as UsersIcon, X } from "lucide-react-native";
import { listProjects, Project } from "../lib/projects";
import { listTeams, Team } from "../lib/teams";

// Fuente de datos (proyectos y equipos) para los widgets Dashboard/Tu
// Proyecto y para generar un Documento (docs/CLIENTE.md, "Plan de
// implementación — Home con widgets", decisión: proyectos Y equipos). Un
// equipo aporta datos vía tasks.assigned_team_id, un proyecto vía
// tasks.project_id — la agregación real vive del lado servidor
// (buildProjectTeamMetrics), acá solo se elige la fuente. Self-contained
// (fetch propio), mismo patrón que ProfileEditorForm.
type Props = {
  visible: boolean;
  isDark: boolean;
  organizationId: string;
  initialProjectIds: string[];
  initialTeamIds: string[];
  onClose: () => void;
  onApply: (projectIds: string[], teamIds: string[]) => void;
};

export default function ClientSourcePickerModal({
  visible,
  isDark,
  organizationId,
  initialProjectIds,
  initialTeamIds,
  onClose,
  onApply,
}: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(initialProjectIds);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(initialTeamIds);

  const cardBg        = isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.85)";
  const inputBg       = isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.6)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = "#2C7BD1";
  const isWeb = Platform.OS === "web";

  useEffect(() => {
    if (!visible) return;
    setSelectedProjectIds(initialProjectIds);
    setSelectedTeamIds(initialTeamIds);
    setSearch("");
    setLoading(true);
    Promise.all([listProjects(organizationId), listTeams(organizationId)]).then(([projectsRes, teamsRes]) => {
      setProjects(projectsRes.data);
      setTeams(teamsRes.data);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, organizationId]);

  const filteredProjects = projects.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));
  const filteredTeams = teams.filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase()));

  const toggleProject = (id: string) => {
    setSelectedProjectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleTeam = (id: string) => {
    setSelectedTeamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

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
            <Text style={[styles.title, { color: textPrimary }]}>Elegir fuente de datos</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color={textSecondary} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchRow, { backgroundColor: inputBg, borderColor: border }]}>
            <Search size={15} color={textSecondary} strokeWidth={2.2} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar proyecto o equipo…"
              placeholderTextColor={textSecondary}
              style={[styles.searchInput, { color: textPrimary }, isWeb && ({ outlineStyle: "none" } as any)]}
            />
          </View>

          {loading ? (
            <Text style={{ color: textSecondary, fontSize: 13, paddingVertical: 12 }}>Cargando…</Text>
          ) : (
            <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ gap: 14 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
              <View style={{ gap: 6 }}>
                <Text style={[styles.sectionLabel, { color: textSecondary }]}>PROYECTOS</Text>
                {filteredProjects.length === 0 ? (
                  <Text style={{ color: textSecondary, fontSize: 12.5 }}>Sin proyectos que coincidan.</Text>
                ) : (
                  filteredProjects.map((p) => {
                    const selected = selectedProjectIds.includes(p.id);
                    return (
                      <TouchableOpacity key={p.id} activeOpacity={0.8} onPress={() => toggleProject(p.id)} style={styles.row}>
                        <View style={[styles.iconWrap, { backgroundColor: p.color + "20" }]}>
                          <FolderKanban size={15} color={p.color} strokeWidth={2.2} />
                        </View>
                        <Text style={[styles.rowLabel, { color: textPrimary }]} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <View style={[styles.checkbox, { borderColor: selected ? primaryColor : border, backgroundColor: selected ? primaryColor : "transparent" }]}>
                          {selected && <Check size={12} color="#FFF" strokeWidth={3} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>

              <View style={{ gap: 6 }}>
                <Text style={[styles.sectionLabel, { color: textSecondary }]}>EQUIPOS</Text>
                {filteredTeams.length === 0 ? (
                  <Text style={{ color: textSecondary, fontSize: 12.5 }}>Sin equipos que coincidan.</Text>
                ) : (
                  filteredTeams.map((t) => {
                    const selected = selectedTeamIds.includes(t.id);
                    return (
                      <TouchableOpacity key={t.id} activeOpacity={0.8} onPress={() => toggleTeam(t.id)} style={styles.row}>
                        <View style={[styles.iconWrap, { backgroundColor: t.color + "20" }]}>
                          <UsersIcon size={15} color={t.color} strokeWidth={2.2} />
                        </View>
                        <Text style={[styles.rowLabel, { color: textPrimary }]} numberOfLines={1}>
                          {t.name}
                        </Text>
                        <View style={[styles.checkbox, { borderColor: selected ? primaryColor : border, backgroundColor: selected ? primaryColor : "transparent" }]}>
                          {selected && <Check size={12} color="#FFF" strokeWidth={3} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </ScrollView>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.applyBtn, { backgroundColor: primaryColor }]}
            onPress={() => onApply(selectedProjectIds, selectedTeamIds)}
          >
            <Text style={styles.applyBtnText}>Aplicar</Text>
          </TouchableOpacity>
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
  card: { width: "100%", maxWidth: 440, borderRadius: 28, borderWidth: 1, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title: { fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 13.5 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, paddingVertical: 8 },
  iconWrap: { width: 30, height: 30, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 13.5, fontWeight: "600", flex: 1 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  applyBtn: { borderRadius: 999, paddingVertical: 13, alignItems: "center", marginTop: 16 },
  applyBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13.5 },
});
