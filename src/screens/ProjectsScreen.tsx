import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import {
  Check,
  ChevronRight,
  Crown,
  Folder,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react-native";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import ColorPickerModal from "../components/ColorPickerModal";
import {
  createProject,
  deleteProject,
  listProjects,
  Project,
  ProjectStatus,
  STATUS_LABELS,
  STATUS_ORDER,
  updateProjectStatus,
} from "../lib/projects";

const STATUS_COLORS: Record<ProjectStatus, string> = {
  planning: "#F59E0B",
  active: "#10B981",
  on_hold: "#94A3B8",
  completed: "#2563EB",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function nextStatus(status: ProjectStatus): ProjectStatus {
  const idx = STATUS_ORDER.indexOf(status);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

export default function ProjectsScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const { user, organization, loading: authLoading } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = Platform.OS === "web";
  const isOwner = !!organization && organization.owner_id === user?.id;

  const bg            = isDark ? "#020617" : "#FAFAFA";
  const cardBg        = isDark ? "rgba(15, 23, 42, 0.8)" : "rgba(255, 255, 255, 0.9)";
  const border        = isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(226, 232, 240, 0.8)";
  const textPrimary   = isDark ? "#F8FAFC" : "#020617";
  const textSecondary = isDark ? "#94A3B8" : "#475569";
  const primaryColor  = organization?.color ?? "#2563EB";
  const inputBg       = isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC";
  const dangerColor   = "#EF4444";

  const ultraShadow = Platform.select({
    web: {
      boxShadow: isDark
        ? "0 25px 50px -12px rgba(0,0,0,1), 0 0 0 1px rgba(255,255,255,0.05) inset"
        : "0 30px 60px -15px rgba(0,0,0,0.08), 0 10px 30px -5px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02) inset",
      backdropFilter: "blur(12px)",
    } as any,
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.4 : 0.06,
      shadowRadius: 16,
      elevation: 6,
    },
  });

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState(primaryColor);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!organization) return;
    setLoadingProjects(true);
    setErrorText(null);
    const { data, error } = await listProjects(organization.id);
    if (error) setErrorText("No se pudieron cargar los proyectos.");
    setProjects(data);
    setLoadingProjects(false);
  }, [organization]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const filteredProjects = projects.filter((p) => {
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query || p.name.toLowerCase().includes(query) || (p.description ?? "").toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });

  const counts = {
    total: projects.length,
    active: projects.filter((p) => p.status === "active").length,
    planning: projects.filter((p) => p.status === "planning").length,
    completed: projects.filter((p) => p.status === "completed").length,
  };

  const openCreateModal = () => {
    setNewName("");
    setNewDescription("");
    setNewColor(primaryColor);
    setCreateError(null);
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!organization || !user || !newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    const { error } = await createProject({
      organizationId: organization.id,
      createdBy: user.id,
      name: newName.trim(),
      description: newDescription.trim() || null,
      color: newColor,
    });
    setCreating(false);
    if (error) {
      setCreateError("No se pudo crear el proyecto.");
      return;
    }
    setShowCreateModal(false);
    loadProjects();
  };

  const handleDelete = async (projectId: string) => {
    setConfirmDeleteId(null);
    const { error } = await deleteProject(projectId);
    if (!error) setProjects((prev) => prev.filter((p) => p.id !== projectId));
  };

  const handleCycleStatus = async (project: Project) => {
    if (!isOwner) return;
    const status = nextStatus(project.status);
    setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, status } : p)));
    await updateProjectStatus(project.id, status);
  };

  if (authLoading) {
    return (
      <View style={[styles.container, { backgroundColor: bg, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: textSecondary }}>Cargando…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: isMobile ? 16 : 32 }}>
        <View style={{ width: "100%", maxWidth: 1280, alignSelf: "center" }}>
          {/* HEADER */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.subtitle, { color: textSecondary }]}>
                {organization?.name ?? "Workspace"}
              </Text>
              <Text style={[styles.title, { color: textPrimary }]}>Proyectos</Text>
            </View>

            {isOwner && (
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.newProjectBtn, { backgroundColor: primaryColor }]}
                onPress={openCreateModal}
              >
                <Plus size={16} color="#FFF" />
                <Text style={styles.newProjectBtnText}>Nuevo proyecto</Text>
              </TouchableOpacity>
            )}
          </View>

          {!organization ? (
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border, marginTop: 24 }, ultraShadow]}>
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>Tu cuenta no tiene un workspace todavía</Text>
              <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
                Cierra sesión y vuelve a entrar para retomar la creación o unión a una organización.
              </Text>
            </View>
          ) : (
            <>
              {/* SEARCH */}
              <View style={[styles.searchWrapper, { backgroundColor: inputBg, borderColor: border, marginTop: 20 }]}>
                <Search size={18} color={textSecondary} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar proyecto…"
                  placeholderTextColor={textSecondary}
                  style={[styles.searchInput, { color: textPrimary }, isWeb && styles.noOutline]}
                />
              </View>

              {/* STATS */}
              <View style={[styles.statsRow, { flexDirection: isMobile ? "row" : "row", flexWrap: "wrap" }]}>
                <StatCard title="Proyectos" value={counts.total} color={primaryColor} cardBg={cardBg} border={border} textPrimary={textPrimary} textSecondary={textSecondary} />
                <StatCard title="Activos" value={counts.active} color={STATUS_COLORS.active} cardBg={cardBg} border={border} textPrimary={textPrimary} textSecondary={textSecondary} />
                <StatCard title="En planeación" value={counts.planning} color={STATUS_COLORS.planning} cardBg={cardBg} border={border} textPrimary={textPrimary} textSecondary={textSecondary} />
                <StatCard title="Completados" value={counts.completed} color={STATUS_COLORS.completed} cardBg={cardBg} border={border} textPrimary={textPrimary} textSecondary={textSecondary} />
              </View>

              {/* FILTERS */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                {(["all", ...STATUS_ORDER] as const).map((status) => {
                  const selected = statusFilter === status;
                  const label = status === "all" ? "Todos" : STATUS_LABELS[status];
                  return (
                    <TouchableOpacity
                      key={status}
                      onPress={() => setStatusFilter(status)}
                      style={[
                        styles.filterChip,
                        { backgroundColor: selected ? primaryColor : cardBg, borderColor: border, borderWidth: selected ? 0 : 1 },
                      ]}
                    >
                      <Text style={{ color: selected ? "#FFF" : textPrimary, fontWeight: "700", fontSize: 13 }}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {errorText && <Text style={[styles.errorText, { color: dangerColor }]}>{errorText}</Text>}

              {/* PROJECT LIST */}
              {loadingProjects ? (
                <Text style={{ color: textSecondary, marginTop: 24 }}>Cargando proyectos…</Text>
              ) : filteredProjects.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border, marginTop: 20 }, ultraShadow]}>
                  <Folder size={32} color={textSecondary} />
                  <Text style={[styles.emptyTitle, { color: textPrimary }]}>
                    {projects.length === 0 ? "No tienes ningún proyecto todavía" : "Ningún proyecto coincide con esos filtros"}
                  </Text>
                  {projects.length === 0 && isOwner && (
                    <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate("Semillero")}>
                      <Text style={[styles.emptyLink, { color: primaryColor }]}>¿Tienes alguna idea? Concrétala en El Semillero.</Text>
                    </TouchableOpacity>
                  )}
                  {projects.length === 0 && !isOwner && (
                    <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
                      El owner de tu organización todavía no ha creado ninguno.
                    </Text>
                  )}
                </View>
              ) : (
                <View style={{ marginTop: 20, gap: 14 }}>
                  {filteredProjects.map((project) => {
                    if (confirmDeleteId === project.id) {
                      return (
                        <View key={project.id} style={[styles.projectCard, { backgroundColor: cardBg, borderColor: dangerColor, borderWidth: 1 }, ultraShadow]}>
                          <Text style={[styles.confirmDeleteText, { color: textPrimary }]}>
                            ¿Borrar "{project.name}"? No se puede deshacer.
                          </Text>
                          <View style={styles.confirmDeleteActions}>
                            <TouchableOpacity
                              activeOpacity={0.85}
                              style={[styles.confirmBtn, { backgroundColor: dangerColor }]}
                              onPress={() => handleDelete(project.id)}
                            >
                              <Check size={14} color="#FFF" />
                              <Text style={styles.confirmBtnText}>Borrar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              activeOpacity={0.85}
                              style={[styles.confirmBtn, { backgroundColor: inputBg, borderWidth: 1, borderColor: border }]}
                              onPress={() => setConfirmDeleteId(null)}
                            >
                              <X size={14} color={textPrimary} />
                              <Text style={[styles.confirmBtnText, { color: textPrimary }]}>Cancelar</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    }

                    const leader = project.members.find((m) => m.userId === project.leaderId);
                    const otherMembers = project.members.filter((m) => m.userId !== project.leaderId);

                    return (
                      <View key={project.id} style={[styles.projectCard, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
                        <View style={styles.projectHeader}>
                          <View style={styles.projectHeaderLeft}>
                            <View style={[styles.projectIcon, { backgroundColor: project.color + "20" }]}>
                              <Folder size={20} color={project.color} />
                            </View>
                            <View style={{ flexShrink: 1 }}>
                              <Text style={[styles.projectTitle, { color: textPrimary }]} numberOfLines={1}>
                                {project.name}
                              </Text>
                              <Text style={[styles.projectDate, { color: textSecondary }]}>
                                Creado el {formatDate(project.createdAt)}
                              </Text>
                            </View>
                          </View>

                          {isOwner && (
                            <TouchableOpacity hitSlop={8} onPress={() => setConfirmDeleteId(project.id)}>
                              <Trash2 size={16} color={textSecondary} />
                            </TouchableOpacity>
                          )}
                        </View>

                        <Text style={[styles.projectDescription, { color: textSecondary }]} numberOfLines={2}>
                          {project.description || "Sin descripción."}
                        </Text>

                        {leader && (
                          <View style={styles.leaderRow}>
                            <View style={[styles.avatarMini, { backgroundColor: leader.avatarColor }]}>
                              <Text style={styles.avatarMiniText}>{initials(leader.name)}</Text>
                            </View>
                            <Text style={[styles.leaderName, { color: textPrimary }]} numberOfLines={1}>
                              {leader.name}
                            </Text>
                            <View style={[styles.leaderPill, { backgroundColor: isDark ? "rgba(37,99,235,0.2)" : "#EFF6FF" }]}>
                              <Crown size={10} color={primaryColor} />
                              <Text style={[styles.leaderPillText, { color: primaryColor }]}>Líder</Text>
                            </View>
                          </View>
                        )}

                        <View style={styles.projectFooter}>
                          <View style={styles.membersRow}>
                            {otherMembers.slice(0, 4).map((m, idx) => (
                              <View
                                key={m.userId}
                                style={[
                                  styles.avatarMini,
                                  { backgroundColor: m.avatarColor, marginLeft: idx === 0 ? 0 : -8, borderWidth: 2, borderColor: cardBg },
                                ]}
                              >
                                <Text style={styles.avatarMiniText}>{initials(m.name)}</Text>
                              </View>
                            ))}
                            {otherMembers.length > 4 && (
                              <Text style={{ marginLeft: 8, color: textSecondary, fontSize: 12 }}>
                                +{otherMembers.length - 4}
                              </Text>
                            )}
                            {otherMembers.length === 0 && !leader && (
                              <Text style={{ color: textSecondary, fontSize: 12 }}>Sin miembros asignados</Text>
                            )}
                          </View>

                          <TouchableOpacity
                            activeOpacity={isOwner ? 0.7 : 1}
                            disabled={!isOwner}
                            onPress={() => handleCycleStatus(project)}
                            style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[project.status] + "20" }]}
                          >
                            <Text style={{ color: STATUS_COLORS[project.status], fontWeight: "700", fontSize: 12 }}>
                              {STATUS_LABELS[project.status]}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}

          <View style={{ height: 60 }} />
        </View>
      </ScrollView>

      {/* CREATE MODAL */}
      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: isDark ? "#0F172A" : "#FFFFFF", borderColor: border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>Nuevo proyecto</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)} hitSlop={8}>
                <X size={20} color={textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalLabel, { color: textSecondary }]}>Nombre</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Ej. Rediseño del checkout"
              placeholderTextColor={textSecondary}
              style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }, isWeb && styles.noOutline]}
            />

            <Text style={[styles.modalLabel, { color: textSecondary }]}>Descripción (opcional)</Text>
            <TextInput
              value={newDescription}
              onChangeText={setNewDescription}
              placeholder="¿De qué se trata?"
              placeholderTextColor={textSecondary}
              multiline
              style={[styles.modalInput, styles.modalTextarea, { backgroundColor: inputBg, borderColor: border, color: textPrimary }, isWeb && styles.noOutline]}
            />

            <Text style={[styles.modalLabel, { color: textSecondary }]}>Color</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.colorSwatchRow, { backgroundColor: inputBg, borderColor: border }]}
              onPress={() => setShowColorPicker(true)}
            >
              <View style={[styles.colorSwatch, { backgroundColor: newColor }]} />
              <Text style={{ color: textPrimary, fontWeight: "600" }}>{newColor}</Text>
              <ChevronRight size={16} color={textSecondary} />
            </TouchableOpacity>

            {createError && <Text style={[styles.errorText, { color: dangerColor }]}>{createError}</Text>}

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!newName.trim() || creating}
              style={[styles.createBtn, { backgroundColor: primaryColor, opacity: !newName.trim() || creating ? 0.5 : 1 }]}
              onPress={handleCreate}
            >
              <Sparkles size={16} color="#FFF" />
              <Text style={styles.createBtnText}>{creating ? "Creando…" : "Crear proyecto"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ColorPickerModal
        visible={showColorPicker}
        initialColor={newColor}
        isDark={isDark}
        onClose={() => setShowColorPicker(false)}
        onConfirm={(hex) => {
          setNewColor(hex);
          setShowColorPicker(false);
        }}
      />
    </View>
  );
}

function StatCard({
  title,
  value,
  color,
  cardBg,
  border,
  textPrimary,
  textSecondary,
}: {
  title: string;
  value: number;
  color: string;
  cardBg: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={[styles.statDot, { backgroundColor: color }]} />
      <Text style={[styles.statValue, { color: textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: textSecondary }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  subtitle: { fontSize: 13, fontWeight: "700" },
  title: { fontSize: 30, fontWeight: "900", letterSpacing: -0.5, marginTop: 2 },

  newProjectBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12,
  },
  newProjectBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },

  searchWrapper: {
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16,
  },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 15 },
  noOutline: { outlineStyle: "none" } as any,

  statsRow: { gap: 12, marginTop: 20 },
  statCard: { flexGrow: 1, minWidth: 130, borderRadius: 18, borderWidth: 1, padding: 16 },
  statDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 10 },
  statValue: { fontSize: 22, fontWeight: "900" },
  statLabel: { fontSize: 12, marginTop: 2 },

  filterScroll: { marginTop: 20 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, marginRight: 10 },

  errorText: { marginTop: 16, fontSize: 13, fontWeight: "600" },

  projectCard: { borderRadius: 22, borderWidth: 1, padding: 20 },
  projectHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  projectHeaderLeft: { flexDirection: "row", gap: 12, flex: 1 },
  projectIcon: { width: 42, height: 42, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  projectTitle: { fontSize: 16, fontWeight: "800" },
  projectDate: { fontSize: 11.5, marginTop: 3 },
  projectDescription: { fontSize: 13, lineHeight: 19, marginTop: 14 },

  leaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  leaderName: { fontSize: 13, fontWeight: "700", flexShrink: 1 },
  leaderPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  leaderPillText: { fontSize: 10, fontWeight: "800" },

  projectFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },
  membersRow: { flexDirection: "row", alignItems: "center" },
  avatarMini: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarMiniText: { color: "#FFF", fontSize: 11, fontWeight: "800" },

  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },

  confirmDeleteText: { fontSize: 14, fontWeight: "600" },
  confirmDeleteActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  confirmBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  confirmBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },

  emptyCard: { borderRadius: 20, borderWidth: 1, padding: 32, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  emptySubtitle: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  emptyLink: { fontSize: 13, fontWeight: "700", textAlign: "center", marginTop: 2 },

  overlay: { flex: 1, backgroundColor: "rgba(2, 6, 23, 0.6)", alignItems: "center", justifyContent: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 420, borderRadius: 24, borderWidth: 1, padding: 24 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  modalLabel: { fontSize: 12, fontWeight: "700", marginBottom: 8, marginTop: 14 },
  modalInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14 },
  modalTextarea: { minHeight: 80, textAlignVertical: "top" },
  colorSwatchRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  colorSwatch: { width: 22, height: 22, borderRadius: 11 },
  createBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999, paddingVertical: 14, marginTop: 24 },
  createBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});
