import React, { useCallback, useState } from "react";
import {
  Image,
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
import { useFocusEffect } from "@react-navigation/native";
import {
  Check,
  ChevronDown,
  Crown,
  Folder,
  Layers,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  Users,
  X,
} from "lucide-react-native";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import IconColorPicker from "../components/IconColorPicker";
import ProjectStatusPickerModal from "../components/ProjectStatusPickerModal";
import {
  createProject,
  deleteProject,
  listProjects,
  Project,
  PROJECT_AREA_OPTIONS,
  ProjectStatus,
  setProjectTeams,
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_ORDER,
  updateProject,
  updateProjectStatus,
} from "../lib/projects";
import { listTeams, Team } from "../lib/teams";

// Paleta de marca de Nexus (azure) — acento moderado, no cubre áreas grandes.
const AZURE_DEEP = "#2C7BD1";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export default function ProjectsScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const { user, organization, loading: authLoading } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = Platform.OS === "web";
  const isOwner = !!organization && organization.owner_id === user?.id;

  const bg            = isDark ? "#0B1220" : "#F1F5FA";
  const cardBg        = isDark ? "rgba(17, 24, 39, 0.58)" : "rgba(255, 255, 255, 0.6)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = organization?.color ?? AZURE_DEEP;
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";
  const dangerColor   = "#EF4444";

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

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statusPickerProject, setStatusPickerProject] = useState<Project | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState(primaryColor);
  const [newIconUrl, setNewIconUrl] = useState<string | null>(null);
  const [newGoals, setNewGoals] = useState<string[]>([]);
  const [newGoalInput, setNewGoalInput] = useState("");
  const [newAreas, setNewAreas] = useState<string[]>([]);
  const [newAreaInput, setNewAreaInput] = useState("");
  const [orgTeams, setOrgTeams] = useState<Team[]>([]);
  const [loadingOrgTeams, setLoadingOrgTeams] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

  const loadProjects = useCallback(async () => {
    if (!organization) return;
    setLoadingProjects(true);
    setErrorText(null);
    const { data, error } = await listProjects(organization.id);
    if (error) setErrorText("No se pudieron cargar los proyectos.");
    setProjects(data);
    setLoadingProjects(false);
  }, [organization]);

  // useFocusEffect (no useEffect) para que la lista se refresque cada vez que
  // se vuelve a esta pestaña, no solo la primera vez que se monta.
  useFocusEffect(
    useCallback(() => {
      loadProjects();
    }, [loadProjects])
  );

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

  const openCreateModal = async () => {
    setEditingProjectId(null);
    setNewName("");
    setNewDescription("");
    setNewColor(primaryColor);
    setNewIconUrl(null);
    setNewGoals([]);
    setNewGoalInput("");
    setNewAreas([]);
    setNewAreaInput("");
    setSelectedTeamIds([]);
    setCreateError(null);
    setShowCreateModal(true);

    if (organization) {
      setLoadingOrgTeams(true);
      const { data } = await listTeams(organization.id);
      setOrgTeams(data);
      setLoadingOrgTeams(false);
    }
  };

  const openEditModal = async (project: Project) => {
    setEditingProjectId(project.id);
    setNewName(project.name);
    setNewDescription(project.description ?? "");
    setNewColor(project.color);
    setNewIconUrl(project.iconUrl);
    setNewGoals(project.goals);
    setNewGoalInput("");
    setNewAreas(project.areas);
    setNewAreaInput("");
    setSelectedTeamIds(project.teams.map((t) => t.id));
    setCreateError(null);
    setShowCreateModal(true);

    if (organization) {
      setLoadingOrgTeams(true);
      const { data } = await listTeams(organization.id);
      setOrgTeams(data);
      setLoadingOrgTeams(false);
    }
  };

  const addGoal = () => {
    const value = newGoalInput.trim();
    if (!value) return;
    setNewGoals((prev) => [...prev, value]);
    setNewGoalInput("");
  };

  const removeGoal = (goal: string) => {
    setNewGoals((prev) => prev.filter((g) => g !== goal));
  };

  const addArea = () => {
    const value = newAreaInput.trim();
    if (!value || newAreas.some((a) => a.toLowerCase() === value.toLowerCase())) {
      setNewAreaInput("");
      return;
    }
    setNewAreas((prev) => [...prev, value]);
    setNewAreaInput("");
  };

  const removeArea = (area: string) => {
    setNewAreas((prev) => prev.filter((a) => a !== area));
  };

  const toggleAreaOption = (area: string) => {
    setNewAreas((prev) =>
      prev.some((a) => a.toLowerCase() === area.toLowerCase())
        ? prev.filter((a) => a.toLowerCase() !== area.toLowerCase())
        : [...prev, area]
    );
  };

  const toggleTeamSelection = (teamId: string) => {
    setSelectedTeamIds((prev) => (prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]));
  };

  const handleSubmit = async () => {
    if (!organization || !user || !newName.trim()) return;
    setCreating(true);
    setCreateError(null);

    if (editingProjectId) {
      const { error } = await updateProject(editingProjectId, {
        name: newName.trim(),
        description: newDescription.trim() || null,
        color: newColor,
        iconUrl: newIconUrl,
        goals: newGoals,
        areas: newAreas,
      });
      if (error) {
        setCreating(false);
        setCreateError("No se pudo guardar el proyecto.");
        return;
      }
      const { error: teamsError } = await setProjectTeams(editingProjectId, selectedTeamIds);
      setCreating(false);
      if (teamsError) {
        setCreateError("El proyecto se guardó, pero no se pudieron actualizar los equipos.");
        return;
      }
      setShowCreateModal(false);
      loadProjects();
      return;
    }

    const { error } = await createProject({
      organizationId: organization.id,
      createdBy: user.id,
      name: newName.trim(),
      description: newDescription.trim() || null,
      color: newColor,
      iconUrl: newIconUrl,
      goals: newGoals,
      areas: newAreas,
      teamIds: selectedTeamIds,
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

  const handleSetStatus = async (project: Project, status: ProjectStatus) => {
    if (!isOwner) return;
    setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, status } : p)));
    setStatusPickerProject(null);
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
    <View style={[styles.container, { backgroundColor: bg, overflow: "hidden" }]}>
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
                <Plus size={16} color="#FFF" strokeWidth={2.3} />
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
                <Search size={18} color={textSecondary} strokeWidth={2.2} />
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
                  <Folder size={32} color={textSecondary} strokeWidth={2} />
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
                              <Check size={14} color="#FFF" strokeWidth={2.3} />
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

                    const allMembersMap = new Map<string, (typeof project.members)[number]>();
                    [...project.members, ...project.teams.flatMap((t) => t.members)].forEach((m) => {
                      if (!allMembersMap.has(m.userId)) allMembersMap.set(m.userId, m);
                    });
                    const allMembers = Array.from(allMembersMap.values());
                    const leader = allMembers.find((m) => m.userId === project.leaderId);
                    const otherMembers = allMembers.filter((m) => m.userId !== project.leaderId);

                    return (
                      <View key={project.id} style={[styles.projectCard, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
                        <View style={styles.projectHeader}>
                          <View style={styles.projectHeaderLeft}>
                            <View style={[styles.projectIcon, { backgroundColor: project.color + "20" }]}>
                              {project.iconUrl ? (
                                <Image source={{ uri: project.iconUrl }} style={styles.projectIconImage} />
                              ) : (
                                <Folder size={20} color={project.color} strokeWidth={2.2} />
                              )}
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
                            <View style={{ flexDirection: "row", gap: 14 }}>
                              <TouchableOpacity hitSlop={8} onPress={() => openEditModal(project)}>
                                <Pencil size={16} color={textSecondary} strokeWidth={2.2} />
                              </TouchableOpacity>
                              <TouchableOpacity hitSlop={8} onPress={() => setConfirmDeleteId(project.id)}>
                                <Trash2 size={16} color={textSecondary} strokeWidth={2.2} />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>

                        <Text style={[styles.projectDescription, { color: textSecondary }]} numberOfLines={2}>
                          {project.description || "Sin descripción."}
                        </Text>

                        {(project.teams.length > 0 || project.areas.length > 0) && (
                          <View style={styles.tagsRow}>
                            {project.teams.map((t) => (
                              <View key={t.id} style={[styles.tagChip, { borderColor: border, backgroundColor: t.color + "15" }]}>
                                <Users size={10} color={t.color} />
                                <Text style={{ color: textPrimary, fontSize: 11, fontWeight: "700" }}>{t.name}</Text>
                              </View>
                            ))}
                            {project.areas.map((area) => (
                              <View key={area} style={[styles.tagChip, { borderColor: border, backgroundColor: inputBg }]}>
                                <Layers size={10} color={textSecondary} />
                                <Text style={{ color: textSecondary, fontSize: 11, fontWeight: "700" }}>{area}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {project.goals.length > 0 && (
                          <View style={styles.goalsRow}>
                            <Target size={12} color={textSecondary} />
                            <Text style={{ color: textSecondary, fontSize: 12, fontWeight: "600" }}>
                              {project.goals.length} {project.goals.length === 1 ? "meta" : "metas"} definidas
                            </Text>
                          </View>
                        )}

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
                            onPress={() => setStatusPickerProject(project)}
                            style={[styles.statusBadge, { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: STATUS_COLORS[project.status] + "20" }]}
                          >
                            <Text style={{ color: STATUS_COLORS[project.status], fontWeight: "700", fontSize: 12 }}>
                              {STATUS_LABELS[project.status]}
                            </Text>
                            {isOwner && <ChevronDown size={11} color={STATUS_COLORS[project.status]} />}
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

      {/* CREATE/EDIT MODAL */}
      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.overlayScroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.modalCard, { backgroundColor: isDark ? "rgba(15,23,42,0.72)" : "rgba(255,255,255,0.78)", borderColor: border }, ultraShadow, !isMobile && styles.modalCardWide]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>{editingProjectId ? "Editar proyecto" : "Nuevo proyecto"}</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)} hitSlop={8}>
                <X size={20} color={textSecondary} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            <View style={!isMobile && styles.formLayout}>
              <View style={!isMobile ? styles.formMain : undefined}>
                <Text style={[styles.modalLabel, { color: textSecondary, marginTop: 0 }]}>Nombre</Text>
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

                <IconColorPicker
                  isDark={isDark}
                  userId={user?.id ?? ""}
                  color={newColor}
                  onColorChange={setNewColor}
                  iconUrl={newIconUrl}
                  onIconChange={setNewIconUrl}
                  fallbackIcon={Folder}
                />
              </View>

              <View style={!isMobile ? styles.formSide : undefined}>
                <Text style={[styles.modalLabel, { color: textSecondary, marginTop: isMobile ? 20 : 0 }]}>Metas</Text>
                <View style={[styles.chipInputRow, { backgroundColor: inputBg, borderColor: border }]}>
                  <TextInput
                    value={newGoalInput}
                    onChangeText={setNewGoalInput}
                    onSubmitEditing={addGoal}
                    placeholder="Ej. Lanzar el MVP antes de fin de mes"
                    placeholderTextColor={textSecondary}
                    style={[styles.chipInput, { color: textPrimary }, isWeb && styles.noOutline]}
                  />
                  <TouchableOpacity onPress={addGoal} hitSlop={8}>
                    <Plus size={18} color={primaryColor} strokeWidth={2.3} />
                  </TouchableOpacity>
                </View>
                {newGoals.length > 0 && (
                  <View style={{ gap: 8, marginTop: 10 }}>
                    {newGoals.map((goal) => (
                      <View key={goal} style={[styles.listItemRow, { backgroundColor: inputBg, borderColor: border }]}>
                        <Target size={13} color={primaryColor} />
                        <Text style={{ color: textPrimary, fontSize: 13, flex: 1 }}>{goal}</Text>
                        <TouchableOpacity onPress={() => removeGoal(goal)} hitSlop={8}>
                          <X size={14} color={textSecondary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={[styles.modalLabel, { color: textSecondary, marginTop: 20 }]}>Áreas involucradas</Text>
                <View style={styles.chipsWrapRow}>
                  {PROJECT_AREA_OPTIONS.map((area) => {
                    const selected = newAreas.some((a) => a.toLowerCase() === area.toLowerCase());
                    return (
                      <TouchableOpacity
                        key={area}
                        activeOpacity={0.85}
                        onPress={() => toggleAreaOption(area)}
                        style={[
                          styles.removableChip,
                          { borderColor: selected ? primaryColor : border, backgroundColor: selected ? primaryColor + "20" : inputBg },
                        ]}
                      >
                        {selected && <Check size={12} color={primaryColor} />}
                        <Text style={{ color: selected ? primaryColor : textPrimary, fontSize: 12.5, fontWeight: "600" }}>{area}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={[styles.modalHint, { color: textSecondary }]}>¿Otra que no está en la lista? Agrégala acá:</Text>
                <View style={[styles.chipInputRow, { backgroundColor: inputBg, borderColor: border }]}>
                  <TextInput
                    value={newAreaInput}
                    onChangeText={setNewAreaInput}
                    onSubmitEditing={addArea}
                    placeholder="Ej. Diseño, Backend, Marketing"
                    placeholderTextColor={textSecondary}
                    style={[styles.chipInput, { color: textPrimary }, isWeb && styles.noOutline]}
                  />
                  <TouchableOpacity onPress={addArea} hitSlop={8}>
                    <Plus size={18} color={primaryColor} strokeWidth={2.3} />
                  </TouchableOpacity>
                </View>
                {/* Solo las áreas personalizadas (las del abanico ya muestran su propio
                    estado de selección arriba, sin necesidad de repetirlas acá). */}
                {newAreas.filter((a) => !PROJECT_AREA_OPTIONS.some((opt) => opt.toLowerCase() === a.toLowerCase())).length > 0 && (
                  <View style={styles.chipsWrapRow}>
                    {newAreas
                      .filter((a) => !PROJECT_AREA_OPTIONS.some((opt) => opt.toLowerCase() === a.toLowerCase()))
                      .map((area) => (
                        <View key={area} style={[styles.removableChip, { borderColor: border, backgroundColor: inputBg }]}>
                          <Text style={{ color: textPrimary, fontSize: 12.5, fontWeight: "600" }}>{area}</Text>
                          <TouchableOpacity onPress={() => removeArea(area)} hitSlop={8}>
                            <X size={12} color={textSecondary} />
                          </TouchableOpacity>
                        </View>
                      ))}
                  </View>
                )}

                <Text style={[styles.modalLabel, { color: textSecondary, marginTop: 20 }]}>Equipos (opcional)</Text>
                {loadingOrgTeams ? (
                  <Text style={{ color: textSecondary, fontSize: 13 }}>Cargando equipos…</Text>
                ) : orgTeams.length === 0 ? (
                  <Text style={{ color: textSecondary, fontSize: 13 }}>
                    Todavía no has creado ningún equipo. Puedes crear uno desde la pestaña Equipos.
                  </Text>
                ) : (
                  <View style={styles.chipsWrapRow}>
                    {orgTeams.map((team) => {
                      const selected = selectedTeamIds.includes(team.id);
                      return (
                        <TouchableOpacity
                          key={team.id}
                          activeOpacity={0.85}
                          onPress={() => toggleTeamSelection(team.id)}
                          style={[
                            styles.teamSelectChip,
                            { borderColor: selected ? team.color : border, backgroundColor: selected ? team.color + "20" : inputBg },
                          ]}
                        >
                          <View style={[styles.colorSwatch, { width: 10, height: 10, borderRadius: 5, backgroundColor: team.color }]} />
                          <Text style={{ color: textPrimary, fontSize: 12.5, fontWeight: "700" }}>{team.name}</Text>
                          {selected && <Check size={13} color={team.color} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>

            {createError && <Text style={[styles.errorText, { color: dangerColor, marginTop: 16 }]}>{createError}</Text>}

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!newName.trim() || creating}
              style={[styles.createBtn, { backgroundColor: primaryColor, opacity: !newName.trim() || creating ? 0.5 : 1 }]}
              onPress={handleSubmit}
            >
              <Sparkles size={16} color="#FFF" strokeWidth={2.3} />
              <Text style={styles.createBtnText}>
                {creating ? (editingProjectId ? "Guardando…" : "Creando…") : editingProjectId ? "Guardar cambios" : "Crear proyecto"}
              </Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>
      </Modal>

      <ProjectStatusPickerModal
        visible={!!statusPickerProject}
        isDark={isDark}
        currentStatus={statusPickerProject?.status ?? null}
        onClose={() => setStatusPickerProject(null)}
        onSelect={(status) => {
          if (statusPickerProject) handleSetStatus(statusPickerProject, status);
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
  subtitle: { fontSize: 13, fontWeight: "600" },
  title: { fontSize: 30, fontWeight: "700", letterSpacing: -0.5, marginTop: 2 },

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
  statCard: { flexGrow: 1, minWidth: 130, borderRadius: 20, borderWidth: 1, padding: 16 },
  statDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 10 },
  statValue: { fontSize: 22, fontWeight: "700" },
  statLabel: { fontSize: 12, marginTop: 2 },

  filterScroll: { marginTop: 20 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, marginRight: 10 },

  errorText: { marginTop: 16, fontSize: 13, fontWeight: "600" },

  projectCard: { borderRadius: 26, borderWidth: 1, padding: 20 },
  projectHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  projectHeaderLeft: { flexDirection: "row", gap: 12, flex: 1 },
  projectIcon: { width: 42, height: 42, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  projectTitle: { fontSize: 16, fontWeight: "700" },
  projectDate: { fontSize: 11.5, marginTop: 3 },
  projectDescription: { fontSize: 13, lineHeight: 19, marginTop: 14 },
  projectIconImage: { width: 42, height: 42, resizeMode: "cover" },

  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  tagChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },

  goalsRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },

  leaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  leaderName: { fontSize: 13, fontWeight: "700", flexShrink: 1 },
  leaderPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  leaderPillText: { fontSize: 10, fontWeight: "700" },

  projectFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },
  membersRow: { flexDirection: "row", alignItems: "center" },
  avatarMini: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarMiniText: { color: "#FFF", fontSize: 11, fontWeight: "700" },

  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },

  confirmDeleteText: { fontSize: 14, fontWeight: "600" },
  confirmDeleteActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  confirmBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  confirmBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },

  emptyCard: { borderRadius: 24, borderWidth: 1, padding: 32, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  emptySubtitle: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  emptyLink: { fontSize: 13, fontWeight: "700", textAlign: "center", marginTop: 2 },

  overlay: { flex: 1, backgroundColor: "rgba(2, 6, 23, 0.6)", alignItems: "center", justifyContent: "center", padding: 20 },
  overlayScroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", width: "100%" },
  modalCard: { width: "100%", maxWidth: 460, borderRadius: 32, borderWidth: 1, padding: 24 },
  modalCardWide: { maxWidth: 1080, padding: 40 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },

  // Mismo patrón de dos columnas que TasksScreen.tsx en desktop: contenido
  // principal (nombre/descripción/ícono) a la izquierda, panel de metadata
  // (metas/áreas/equipos) a la derecha — ver docs/PATRONES.md.
  formLayout: { flexDirection: "row", gap: 28, alignItems: "flex-start" },
  formMain: { flex: 1.5, minWidth: 0 },
  formSide: { width: 300 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalLabel: { fontSize: 12, fontWeight: "700", marginBottom: 8, marginTop: 14 },
  modalHint: { fontSize: 11.5, marginTop: 10, marginBottom: 8 },
  modalInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14 },
  modalTextarea: { minHeight: 80, textAlignVertical: "top" },
  colorSwatch: { width: 22, height: 22, borderRadius: 11 },

  chipInputRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4 },
  chipInput: { flex: 1, paddingVertical: 12, fontSize: 13 },
  listItemRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  chipsWrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  removableChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  teamSelectChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },

  createBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999, paddingVertical: 14, marginTop: 24 },
  createBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});
