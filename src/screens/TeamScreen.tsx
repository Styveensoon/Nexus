import React, { useCallback, useState } from "react";
import {
  Image,
  Keyboard,
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
import { Check, ChevronRight, Crown, Pencil, Plus, Search, Trash2, Users, X } from "lucide-react-native";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import IconColorPicker from "../components/IconColorPicker";
import MemberProfileModal from "../components/MemberProfileModal";
import { listOrganizationMembers, OrganizationMemberProfile } from "../lib/organizations";
import {
  createTeam,
  deleteTeam,
  listTeams,
  setTeamMembers,
  updateTeam,
  Team,
  TEAM_ROLE_OPTIONS,
  CUSTOM_TEAM_ROLE_VALUE,
  TEAM_LEADER_ROLE_LABEL,
} from "../lib/teams";

// Paleta de marca de Nexus (azure del logo) — acento moderado, no cubre áreas grandes.
const AZURE_DEEP = "#2C7BD1";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

type MemberDraft = {
  userId: string;
  name: string;
  avatarColor: string;
  roleOption: string | null;
  customRole: string;
};

export default function TeamScreen() {
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

  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState(primaryColor);
  const [newIconUrl, setNewIconUrl] = useState<string | null>(null);
  const [roster, setRoster] = useState<OrganizationMemberProfile[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [memberDrafts, setMemberDrafts] = useState<MemberDraft[]>([]);
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [rosterSearch, setRosterSearch] = useState("");
  const [profileModalTarget, setProfileModalTarget] = useState<{ userId: string; inTeam: boolean } | null>(null);

  const loadTeams = useCallback(async () => {
    if (!organization) return;
    setLoadingTeams(true);
    setErrorText(null);
    const { data, error } = await listTeams(organization.id);
    if (error) setErrorText("No se pudieron cargar los equipos.");
    setTeams(data);
    setLoadingTeams(false);
  }, [organization]);

  // useFocusEffect (no useEffect) para que la lista se refresque cada vez que
  // se vuelve a esta pestaña, no solo la primera vez que se monta.
  useFocusEffect(
    useCallback(() => {
      loadTeams();
    }, [loadTeams])
  );

  const filteredTeams = teams.filter((t) => {
    const query = search.trim().toLowerCase();
    return !query || t.name.toLowerCase().includes(query) || (t.description ?? "").toLowerCase().includes(query);
  });

  const openCreateModal = async () => {
    setEditingTeamId(null);
    setNewName("");
    setNewDescription("");
    setNewColor(primaryColor);
    setNewIconUrl(null);
    setMemberDrafts([]);
    setLeaderId(null);
    setRosterSearch("");
    setProfileModalTarget(null);
    setCreateError(null);
    setShowCreateModal(true);

    if (organization) {
      setLoadingRoster(true);
      const { data } = await listOrganizationMembers(organization.id);
      setRoster(data);
      setLoadingRoster(false);
    }
  };

  const openEditModal = async (team: Team) => {
    setEditingTeamId(team.id);
    setNewName(team.name);
    setNewDescription(team.description ?? "");
    setNewColor(team.color);
    setNewIconUrl(team.iconUrl);
    setLeaderId(team.leaderId);
    setMemberDrafts(
      team.members.map((m) => {
        const isTeamLeader = m.userId === team.leaderId;
        const role = m.roleInTeam ?? "";
        const isPresetRole = !isTeamLeader && !!role && (TEAM_ROLE_OPTIONS as string[]).includes(role);
        return {
          userId: m.userId,
          name: m.name,
          avatarColor: m.avatarColor,
          roleOption: isTeamLeader ? null : isPresetRole ? role : role ? CUSTOM_TEAM_ROLE_VALUE : null,
          customRole: !isTeamLeader && role && !isPresetRole ? role : "",
        };
      })
    );
    setRosterSearch("");
    setProfileModalTarget(null);
    setCreateError(null);
    setShowCreateModal(true);

    if (organization) {
      setLoadingRoster(true);
      const { data } = await listOrganizationMembers(organization.id);
      setRoster(data);
      setLoadingRoster(false);
    }
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingTeamId(null);
  };

  const addMemberDraft = (member: OrganizationMemberProfile) => {
    setMemberDrafts((prev) => [...prev, { userId: member.userId, name: member.name, avatarColor: member.avatarColor, roleOption: null, customRole: "" }]);
  };

  const removeMemberDraft = (userId: string) => {
    if (leaderId === userId) setLeaderId(null);
    setMemberDrafts((prev) => prev.filter((d) => d.userId !== userId));
  };

  const setDraftRole = (userId: string, roleOption: string) => {
    setMemberDrafts((prev) => prev.map((d) => (d.userId === userId ? { ...d, roleOption } : d)));
  };

  const setDraftCustomRole = (userId: string, customRole: string) => {
    setMemberDrafts((prev) => prev.map((d) => (d.userId === userId ? { ...d, customRole } : d)));
  };

  const toggleLeader = (userId: string) => {
    setLeaderId((prev) => (prev === userId ? null : userId));
  };

  const handleSubmit = async () => {
    if (!organization || !user || !newName.trim()) return;
    setCreating(true);
    setCreateError(null);

    const members = memberDrafts.map((d) => ({
      userId: d.userId,
      roleInTeam:
        d.userId === leaderId
          ? TEAM_LEADER_ROLE_LABEL
          : d.roleOption === CUSTOM_TEAM_ROLE_VALUE
          ? d.customRole.trim() || null
          : d.roleOption,
    }));

    if (editingTeamId) {
      const { error: updateError } = await updateTeam(editingTeamId, {
        name: newName.trim(),
        description: newDescription.trim() || null,
        color: newColor,
        iconUrl: newIconUrl,
        leaderId,
      });
      const { error: membersError } = updateError ? { error: updateError } : await setTeamMembers(editingTeamId, members);
      setCreating(false);
      if (updateError || membersError) {
        setCreateError("No se pudieron guardar los cambios.");
        return;
      }
    } else {
      const { error } = await createTeam({
        organizationId: organization.id,
        createdBy: user.id,
        name: newName.trim(),
        description: newDescription.trim() || null,
        color: newColor,
        iconUrl: newIconUrl,
        leaderId,
        members,
      });
      setCreating(false);
      if (error) {
        setCreateError("No se pudo crear el equipo.");
        return;
      }
    }

    closeModal();
    loadTeams();
  };

  const handleDelete = async (teamId: string) => {
    setConfirmDeleteId(null);
    const { error } = await deleteTeam(teamId);
    if (!error) setTeams((prev) => prev.filter((t) => t.id !== teamId));
  };

  const availableRoster = roster.filter((m) => !memberDrafts.some((d) => d.userId === m.userId));
  const filteredAvailableRoster = availableRoster.filter((m) =>
    m.name.toLowerCase().includes(rosterSearch.trim().toLowerCase())
  );

  const profileModalMember = profileModalTarget
    ? profileModalTarget.inTeam
      ? memberDrafts.find((d) => d.userId === profileModalTarget.userId)
      : roster.find((m) => m.userId === profileModalTarget.userId)
    : null;

  const handleAddFromProfile = () => {
    if (!profileModalTarget || profileModalTarget.inTeam) return;
    const member = roster.find((m) => m.userId === profileModalTarget.userId);
    if (member) addMemberDraft(member);
    setProfileModalTarget(null);
  };

  const handleRemoveFromProfile = () => {
    if (!profileModalTarget || !profileModalTarget.inTeam) return;
    removeMemberDraft(profileModalTarget.userId);
    setProfileModalTarget(null);
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
          <View style={styles.header}>
            <View>
              <Text style={[styles.subtitle, { color: textSecondary }]}>{organization?.name ?? "Workspace"}</Text>
              <Text style={[styles.title, { color: textPrimary }]}>Equipos</Text>
            </View>

            {isOwner && (
              <TouchableOpacity activeOpacity={0.85} style={[styles.newBtn, { backgroundColor: primaryColor }]} onPress={openCreateModal}>
                <Plus size={16} color="#FFF" />
                <Text style={styles.newBtnText}>Nuevo equipo</Text>
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
              <View style={[styles.searchWrapper, { backgroundColor: inputBg, borderColor: border, marginTop: 20 }]}>
                <Search size={18} color={textSecondary} strokeWidth={2.3} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar equipo…"
                  placeholderTextColor={textSecondary}
                  style={[styles.searchInput, { color: textPrimary }, isWeb && styles.noOutline]}
                />
              </View>

              {errorText && <Text style={[styles.errorText, { color: dangerColor }]}>{errorText}</Text>}

              {loadingTeams ? (
                <Text style={{ color: textSecondary, marginTop: 24 }}>Cargando equipos…</Text>
              ) : filteredTeams.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border, marginTop: 20 }, ultraShadow]}>
                  <Users size={32} color={textSecondary} strokeWidth={2.2} />
                  <Text style={[styles.emptyTitle, { color: textPrimary }]}>
                    {teams.length === 0 ? "No tienes ningún equipo todavía" : "Ningún equipo coincide con esa búsqueda"}
                  </Text>
                  {teams.length === 0 && !isOwner && (
                    <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
                      El owner de tu organización todavía no ha creado ninguno.
                    </Text>
                  )}
                </View>
              ) : (
                <View style={{ marginTop: 20, gap: 14 }}>
                  {filteredTeams.map((team) => {
                    if (confirmDeleteId === team.id) {
                      return (
                        <View key={team.id} style={[styles.teamCard, { backgroundColor: cardBg, borderColor: dangerColor, borderWidth: 1 }, ultraShadow]}>
                          <Text style={[styles.confirmDeleteText, { color: textPrimary }]}>
                            ¿Borrar el equipo "{team.name}"? No se puede deshacer.
                          </Text>
                          <View style={styles.confirmDeleteActions}>
                            <TouchableOpacity activeOpacity={0.85} style={[styles.confirmBtn, { backgroundColor: dangerColor }]} onPress={() => handleDelete(team.id)}>
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

                    const leader = team.members.find((m) => m.userId === team.leaderId);
                    const otherMembers = team.members.filter((m) => m.userId !== team.leaderId);

                    return (
                      <View key={team.id} style={[styles.teamCard, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
                        <View style={styles.teamHeader}>
                          <View style={styles.teamHeaderLeft}>
                            <View style={[styles.teamIcon, { backgroundColor: team.color + "20" }]}>
                              {team.iconUrl ? (
                                <Image source={{ uri: team.iconUrl }} style={styles.teamIconImage} />
                              ) : (
                                <Users size={20} color={team.color} strokeWidth={2.3} />
                              )}
                            </View>
                            <View style={{ flexShrink: 1 }}>
                              <Text style={[styles.teamTitle, { color: textPrimary }]} numberOfLines={1}>
                                {team.name}
                              </Text>
                              <Text style={[styles.teamDate, { color: textSecondary }]}>Creado el {formatDate(team.createdAt)}</Text>
                            </View>
                          </View>

                          {isOwner && (
                            <View style={{ flexDirection: "row", gap: 14 }}>
                              <TouchableOpacity hitSlop={8} onPress={() => openEditModal(team)}>
                                <Pencil size={16} color={textSecondary} strokeWidth={2.2} />
                              </TouchableOpacity>
                              <TouchableOpacity hitSlop={8} onPress={() => setConfirmDeleteId(team.id)}>
                                <Trash2 size={16} color={textSecondary} strokeWidth={2.2} />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>

                        <Text style={[styles.teamDescription, { color: textSecondary }]} numberOfLines={2}>
                          {team.description || "Sin descripción."}
                        </Text>

                        {leader && (
                          <View style={styles.leaderRow}>
                            <View style={[styles.avatarMini, { backgroundColor: leader.avatarColor }]}>
                              <Text style={styles.avatarMiniText}>{initials(leader.name)}</Text>
                            </View>
                            <Text style={[styles.leaderName, { color: textPrimary }]} numberOfLines={1}>
                              {leader.name}
                            </Text>
                            <View style={[styles.leaderPill, { backgroundColor: isDark ? "rgba(126,200,245,0.14)" : "rgba(44,123,209,0.08)" }]}>
                              <Crown size={10} color={primaryColor} />
                              <Text style={[styles.leaderPillText, { color: primaryColor }]}>Encargado/a</Text>
                            </View>
                          </View>
                        )}

                        <View style={styles.teamFooter}>
                          <View style={styles.membersRow}>
                            {otherMembers.slice(0, 5).map((m, idx) => (
                              <View
                                key={m.userId}
                                style={[styles.avatarMini, { backgroundColor: m.avatarColor, marginLeft: idx === 0 ? 0 : -8, borderWidth: 2, borderColor: cardBg }]}
                              >
                                <Text style={styles.avatarMiniText}>{initials(m.name)}</Text>
                              </View>
                            ))}
                            {otherMembers.length > 5 && (
                              <Text style={{ marginLeft: 8, color: textSecondary, fontSize: 12 }}>+{otherMembers.length - 5}</Text>
                            )}
                            {otherMembers.length === 0 && !leader && (
                              <Text style={{ color: textSecondary, fontSize: 12 }}>Sin integrantes asignados</Text>
                            )}
                          </View>
                          <Text style={{ color: textSecondary, fontSize: 12, fontWeight: "700" }}>
                            {team.members.length} {team.members.length === 1 ? "integrante" : "integrantes"}
                          </Text>
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

      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.overlayScroll} showsVerticalScrollIndicator={false}>
            <View style={[styles.modalCard, { backgroundColor: isDark ? "rgba(15,23,42,0.72)" : "rgba(255,255,255,0.78)", borderColor: border }, ultraShadow, !isMobile && styles.modalCardWide]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: textPrimary }]}>{editingTeamId ? "Editar equipo" : "Nuevo equipo"}</Text>
                <TouchableOpacity onPress={closeModal} hitSlop={8}>
                  <X size={20} color={textSecondary} strokeWidth={2.3} />
                </TouchableOpacity>
              </View>

              <View style={!isMobile && styles.formLayout}>
                {/* Integrantes es la sección más pesada del formulario (buscador +
                    roster scrollable + tarjetas de rol por integrante), así que va
                    en la columna principal más ancha; Nombre/Descripción/Ícono son
                    más compactos y van en el panel lateral — al revés que en
                    Tasks/Projects, donde lo "principal" era el texto. Ver
                    docs/PATRONES.md. */}
                <View style={!isMobile ? styles.formMain : undefined}>
                  <Text style={[styles.modalLabel, { color: textSecondary, marginTop: 0 }]}>Integrantes</Text>
                  {loadingRoster ? (
                    <Text style={{ color: textSecondary }}>Cargando roster…</Text>
                  ) : availableRoster.length === 0 && memberDrafts.length === 0 ? (
                    <Text style={{ color: textSecondary, fontSize: 13 }}>Todavía no hay nadie más en tu organización.</Text>
                  ) : (
                    <>
                      {availableRoster.length > 0 && (
                        <View style={[styles.searchWrapper, { backgroundColor: inputBg, borderColor: border, marginBottom: 10 }]}>
                          <Search size={16} color={textSecondary} strokeWidth={2.2} />
                          <TextInput
                            value={rosterSearch}
                            onChangeText={setRosterSearch}
                            placeholder="Buscar integrante…"
                            placeholderTextColor={textSecondary}
                            style={[styles.searchInput, { color: textPrimary, paddingVertical: 10 }, isWeb && styles.noOutline]}
                          />
                        </View>
                      )}

                      <View style={[styles.rosterPanel, { borderColor: border, backgroundColor: inputBg }]}>
                        <ScrollView
                          nestedScrollEnabled
                          showsVerticalScrollIndicator={false}
                          style={styles.rosterScroll}
                          contentContainerStyle={styles.rosterScrollContent}
                        >
                          {filteredAvailableRoster.map((m) => (
                            <TouchableOpacity
                              key={m.userId}
                              activeOpacity={0.85}
                              onPress={() => setProfileModalTarget({ userId: m.userId, inTeam: false })}
                              style={[styles.rosterCard, { borderColor: border, backgroundColor: cardBg }]}
                            >
                              <View style={[styles.avatarMini, { backgroundColor: m.avatarColor }]}>
                                <Text style={styles.avatarMiniText}>{initials(m.name)}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: textPrimary, fontWeight: "700", fontSize: 13 }} numberOfLines={1}>
                                  {m.name}
                                </Text>
                                {!!(m.customRole || m.role) && (
                                  <Text style={{ color: textSecondary, fontSize: 11.5 }} numberOfLines={1}>
                                    {m.customRole || m.role}
                                  </Text>
                                )}
                              </View>
                              <ChevronRight size={16} color={textSecondary} strokeWidth={2.2} />
                            </TouchableOpacity>
                          ))}
                          {availableRoster.length > 0 && filteredAvailableRoster.length === 0 && (
                            <Text style={{ color: textSecondary, fontSize: 13, textAlign: "center", padding: 12 }}>
                              Nadie coincide con esa búsqueda.
                            </Text>
                          )}
                        </ScrollView>
                      </View>
                    </>
                  )}

                  {memberDrafts.length > 0 && (
                    <View style={[!isMobile && styles.memberDraftsGrid, { marginTop: 16 }]}>
                      {memberDrafts.map((draft) => {
                        const isLeader = draft.userId === leaderId;
                        return (
                          <View key={draft.userId} style={[styles.memberDraftCard, { backgroundColor: inputBg, borderColor: border }, !isMobile && styles.memberDraftCardWide]}>
                            <View style={styles.memberDraftHeader}>
                              <TouchableOpacity
                                activeOpacity={0.8}
                                style={styles.memberDraftIdentity}
                                onPress={() => setProfileModalTarget({ userId: draft.userId, inTeam: true })}
                              >
                                <View style={[styles.avatarMini, { backgroundColor: draft.avatarColor }]}>
                                  <Text style={styles.avatarMiniText}>{initials(draft.name)}</Text>
                                </View>
                                <Text style={{ color: textPrimary, fontWeight: "700", fontSize: 13, flex: 1 }} numberOfLines={1}>
                                  {draft.name}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity hitSlop={8} onPress={() => toggleLeader(draft.userId)}>
                                <Crown size={17} color={isLeader ? primaryColor : textSecondary} strokeWidth={2.2} />
                              </TouchableOpacity>
                              <TouchableOpacity hitSlop={8} onPress={() => removeMemberDraft(draft.userId)}>
                                <X size={15} color={textSecondary} />
                              </TouchableOpacity>
                            </View>

                            {isLeader ? (
                              <Text style={[styles.leaderDraftLabel, { color: primaryColor }]}>Encargado/a del equipo</Text>
                            ) : (
                              <>
                                <View style={styles.roleChipsRow}>
                                  {TEAM_ROLE_OPTIONS.map((opt) => (
                                    <TouchableOpacity
                                      key={opt}
                                      activeOpacity={0.85}
                                      onPress={() => setDraftRole(draft.userId, opt)}
                                      style={[
                                        styles.roleChip,
                                        { borderColor: draft.roleOption === opt ? primaryColor : border, backgroundColor: draft.roleOption === opt ? primaryColor : "transparent" },
                                      ]}
                                    >
                                      <Text style={{ fontSize: 11.5, fontWeight: "700", color: draft.roleOption === opt ? "#FFF" : textPrimary }}>{opt}</Text>
                                    </TouchableOpacity>
                                  ))}
                                  <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={() => setDraftRole(draft.userId, CUSTOM_TEAM_ROLE_VALUE)}
                                    style={[
                                      styles.roleChip,
                                      { borderColor: draft.roleOption === CUSTOM_TEAM_ROLE_VALUE ? primaryColor : border, backgroundColor: draft.roleOption === CUSTOM_TEAM_ROLE_VALUE ? primaryColor : "transparent" },
                                    ]}
                                  >
                                    <Text style={{ fontSize: 11.5, fontWeight: "700", color: draft.roleOption === CUSTOM_TEAM_ROLE_VALUE ? "#FFF" : textPrimary }}>Otro</Text>
                                  </TouchableOpacity>
                                </View>
                                {draft.roleOption === CUSTOM_TEAM_ROLE_VALUE && (
                                  <View style={[styles.customRoleInputRow, { backgroundColor: cardBg, borderColor: border }]}>
                                    <TextInput
                                      value={draft.customRole}
                                      onChangeText={(v) => setDraftCustomRole(draft.userId, v)}
                                      onSubmitEditing={() => Keyboard.dismiss()}
                                      placeholder="Escribe el rol"
                                      placeholderTextColor={textSecondary}
                                      style={[styles.customRoleInput, { color: textPrimary }, isWeb && styles.noOutline]}
                                    />
                                    <TouchableOpacity onPress={() => Keyboard.dismiss()} hitSlop={8}>
                                      <Check size={14} color={primaryColor} strokeWidth={2.3} />
                                    </TouchableOpacity>
                                  </View>
                                )}
                              </>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                <View style={!isMobile ? styles.formSide : undefined}>
                  <Text style={[styles.modalLabel, { color: textSecondary, marginTop: isMobile ? 20 : 0 }]}>Nombre</Text>
                  <TextInput
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="Ej. Equipo de Producto"
                    placeholderTextColor={textSecondary}
                    style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }, isWeb && styles.noOutline]}
                  />

                  <Text style={[styles.modalLabel, { color: textSecondary }]}>Descripción (opcional)</Text>
                  <TextInput
                    value={newDescription}
                    onChangeText={setNewDescription}
                    placeholder="¿De qué se encarga este equipo?"
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
                    fallbackIcon={Users}
                  />
                </View>
              </View>

              {createError && <Text style={[styles.errorText, { color: dangerColor, marginTop: 16 }]}>{createError}</Text>}

              <TouchableOpacity
                activeOpacity={0.85}
                disabled={!newName.trim() || creating}
                style={[styles.createBtn, { backgroundColor: primaryColor, opacity: !newName.trim() || creating ? 0.5 : 1 }]}
                onPress={handleSubmit}
              >
                <Users size={16} color="#FFF" strokeWidth={2.2} />
                <Text style={styles.createBtnText}>
                  {creating ? (editingTeamId ? "Guardando…" : "Creando…") : editingTeamId ? "Guardar cambios" : "Crear equipo"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <MemberProfileModal
        visible={!!profileModalTarget}
        userId={profileModalTarget?.userId ?? null}
        organizationId={organization?.id ?? null}
        fallbackName={profileModalMember?.name}
        isDark={isDark}
        onClose={() => setProfileModalTarget(null)}
        actionLabel={profileModalTarget?.inTeam ? "Quitar del equipo" : "Agregar al equipo"}
        onAction={profileModalTarget?.inTeam ? handleRemoveFromProfile : handleAddFromProfile}
        actionDanger={profileModalTarget?.inTeam}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  subtitle: { fontSize: 13, fontWeight: "700" },
  title: { fontSize: 30, fontWeight: "700", letterSpacing: -0.5, marginTop: 2 },

  newBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12 },
  newBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },

  searchWrapper: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 18, paddingHorizontal: 16 },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 15 },
  noOutline: { outlineStyle: "none" } as any,

  errorText: { marginTop: 16, fontSize: 13, fontWeight: "600" },

  teamCard: { borderRadius: 26, borderWidth: 1, padding: 20 },
  teamHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  teamHeaderLeft: { flexDirection: "row", gap: 12, flex: 1 },
  teamIcon: { width: 42, height: 42, borderRadius: 16, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  teamIconImage: { width: 42, height: 42, resizeMode: "cover" },
  teamTitle: { fontSize: 16, fontWeight: "700" },
  teamDate: { fontSize: 11.5, marginTop: 3 },
  teamDescription: { fontSize: 13, lineHeight: 19, marginTop: 14 },

  leaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  leaderName: { fontSize: 13, fontWeight: "700", flexShrink: 1 },
  leaderPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  leaderPillText: { fontSize: 10, fontWeight: "700" },

  teamFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },
  membersRow: { flexDirection: "row", alignItems: "center" },
  avatarMini: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarMiniText: { color: "#FFF", fontSize: 11, fontWeight: "700" },

  confirmDeleteText: { fontSize: 14, fontWeight: "600" },
  confirmDeleteActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  confirmBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  confirmBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },

  emptyCard: { borderRadius: 24, borderWidth: 1, padding: 32, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  emptySubtitle: { fontSize: 13, textAlign: "center", lineHeight: 20 },

  overlay: { flex: 1, backgroundColor: "rgba(2, 6, 23, 0.6)", alignItems: "center", justifyContent: "center", padding: 20 },
  overlayScroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", width: "100%" },
  modalCard: { width: "100%", maxWidth: 480, borderRadius: 32, borderWidth: 1, padding: 24 },
  modalCardWide: { maxWidth: 1080, padding: 40 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalLabel: { fontSize: 12, fontWeight: "700", marginBottom: 8, marginTop: 14 },
  modalInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14 },
  modalTextarea: { minHeight: 70, textAlignVertical: "top" },

  // Mismo patrón de dos columnas que Tasks/Projects en desktop, pero acá
  // Integrantes (la sección más pesada) va en la columna principal y
  // Nombre/Descripción/Ícono (más compactos) en el panel lateral — ver nota
  // en el JSX y docs/PATRONES.md.
  formLayout: { flexDirection: "row", gap: 28, alignItems: "flex-start" },
  formMain: { flex: 1.5, minWidth: 0 },
  formSide: { width: 300 },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },

  memberDraftsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  memberDraftCardWide: { flexBasis: "48%", flexGrow: 1 },
  memberDraftCard: { borderWidth: 1, borderRadius: 18, padding: 12 },
  memberDraftHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  memberDraftIdentity: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  rosterCard: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  rosterPanel: { borderWidth: 1, borderRadius: 20, padding: 8, maxHeight: 320 },
  rosterScroll: { maxHeight: 304 },
  rosterScrollContent: { gap: 8, paddingBottom: 2 },
  leaderDraftLabel: { fontSize: 12, fontWeight: "700", marginTop: 8 },
  roleChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  roleChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  customRoleInputRow: {
    flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginTop: 8,
  },
  customRoleInput: { flex: 1, fontSize: 12.5 },

  createBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999, paddingVertical: 14, marginTop: 24 },
  createBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});
