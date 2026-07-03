import React, { useCallback, useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Activity, ArrowLeft, Clock, Folder, Search, Users as UsersIcon, UserRound } from "lucide-react-native";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import ActivityRow from "../components/ActivityRow";
import { listActivity, ActivityEntry } from "../lib/activity";
import { listTeams, Team } from "../lib/teams";
import { listProjects, Project } from "../lib/projects";
import { listOrganizationMembers, OrganizationMemberProfile } from "../lib/organizations";

const AZURE_DEEP = "#2C7BD1";

type TabKey = "recent" | "teams" | "projects" | "users";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "recent", label: "Reciente", icon: Clock },
  { key: "teams", label: "Equipos", icon: UsersIcon },
  { key: "projects", label: "Proyectos", icon: Folder },
  { key: "users", label: "Usuarios", icon: UserRound },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export default function ActivityScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const { organization, loading: authLoading } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

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

  const [activeTab, setActiveTab] = useState<TabKey>("recent");
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<OrganizationMemberProfile[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [teamSearch, setTeamSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Roster de equipos/proyectos/usuarios para los selectores — se carga una
  // vez por visita a la pantalla, igual que en TeamScreen/ProjectsScreen.
  useFocusEffect(
    useCallback(() => {
      if (!organization) return;
      listTeams(organization.id).then(({ data }) => setTeams(data));
      listProjects(organization.id).then(({ data }) => setProjects(data));
      listOrganizationMembers(organization.id).then(({ data }) => setMembers(data));
    }, [organization])
  );

  useEffect(() => {
    if (!organization) return;

    if (activeTab === "recent") {
      setLoadingEntries(true);
      setErrorText(null);
      listActivity({ organizationId: organization.id, limit: 50 }).then(({ data, error }) => {
        if (error) setErrorText("No se pudo cargar la actividad.");
        setEntries(data);
        setLoadingEntries(false);
      });
      return;
    }

    if (activeTab === "teams" && selectedTeamId) {
      setLoadingEntries(true);
      setErrorText(null);
      listActivity({ organizationId: organization.id, teamId: selectedTeamId, limit: 50 }).then(({ data, error }) => {
        if (error) setErrorText("No se pudo cargar la actividad.");
        setEntries(data);
        setLoadingEntries(false);
      });
      return;
    }

    if (activeTab === "projects" && selectedProjectId) {
      setLoadingEntries(true);
      setErrorText(null);
      listActivity({ organizationId: organization.id, projectId: selectedProjectId, limit: 50 }).then(({ data, error }) => {
        if (error) setErrorText("No se pudo cargar la actividad.");
        setEntries(data);
        setLoadingEntries(false);
      });
      return;
    }

    if (activeTab === "users" && selectedUserId) {
      setLoadingEntries(true);
      setErrorText(null);
      listActivity({ organizationId: organization.id, userId: selectedUserId, limit: 50 }).then(({ data, error }) => {
        if (error) setErrorText("No se pudo cargar la actividad.");
        setEntries(data);
        setLoadingEntries(false);
      });
      return;
    }

    setEntries([]);
    setLoadingEntries(false);
  }, [activeTab, selectedTeamId, selectedProjectId, selectedUserId, organization]);

  // Preselecciona la primera opción del apartado activo para no dejar la
  // pantalla vacía esperando un tap — como efecto (no solo al cambiar de
  // pestaña) porque el roster de equipos/proyectos/usuarios puede llegar
  // después de que ya se haya entrado a esa pestaña.
  useEffect(() => {
    if (activeTab === "teams" && !selectedTeamId && teams[0]) setSelectedTeamId(teams[0].id);
  }, [activeTab, teams, selectedTeamId]);

  useEffect(() => {
    if (activeTab === "projects" && !selectedProjectId && projects[0]) setSelectedProjectId(projects[0].id);
  }, [activeTab, projects, selectedProjectId]);

  useEffect(() => {
    if (activeTab === "users" && !selectedUserId && members[0]) setSelectedUserId(members[0].userId);
  }, [activeTab, members, selectedUserId]);

  const filteredTeams = teams.filter((t) => t.name.toLowerCase().includes(teamSearch.trim().toLowerCase()));
  const filteredProjects = projects.filter((p) => p.name.toLowerCase().includes(projectSearch.trim().toLowerCase()));
  const filteredMembers = members.filter((m) => m.name.toLowerCase().includes(userSearch.trim().toLowerCase()));

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
        <View style={{ width: "100%", maxWidth: 1000, alignSelf: "center" }}>
          <View style={styles.header}>
            <TouchableOpacity activeOpacity={0.8} style={[styles.backBtn, { backgroundColor: cardBg, borderColor: border }]} onPress={() => navigation.goBack()}>
              <ArrowLeft size={18} color={textSecondary} strokeWidth={2.3} />
            </TouchableOpacity>
            <View>
              <Text style={[styles.subtitle, { color: textSecondary }]}>{organization?.name ?? "Workspace"}</Text>
              <Text style={[styles.title, { color: textPrimary }]}>Actividad</Text>
            </View>
          </View>

          {!organization ? (
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border, marginTop: 24, borderRadius: 28 }, ultraShadow]}>
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>Tu cuenta no tiene un workspace todavía</Text>
            </View>
          ) : (
            <>
              <View style={styles.tabRow}>
                {TABS.map(({ key, label, icon: Icon }) => {
                  const active = activeTab === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      activeOpacity={0.85}
                      onPress={() => setActiveTab(key)}
                      style={[styles.tabChip, { backgroundColor: active ? primaryColor : cardBg, borderColor: active ? primaryColor : border }]}
                    >
                      <Icon size={14} color={active ? "#FFF" : textSecondary} />
                      <Text style={{ color: active ? "#FFF" : textPrimary, fontWeight: "700", fontSize: 12.5 }}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {activeTab === "teams" && (
                <>
                  {teams.length > 3 && (
                    <View style={[styles.searchWrapper, { backgroundColor: inputBg, borderColor: border }]}>
                      <Search size={14} color={textSecondary} strokeWidth={2.2} />
                      <TextInput
                        value={teamSearch}
                        onChangeText={setTeamSearch}
                        placeholder="Buscar equipo…"
                        placeholderTextColor={textSecondary}
                        style={[styles.searchInput, { color: textPrimary }, Platform.OS === "web" && styles.noOutline]}
                      />
                    </View>
                  )}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                  {teams.length === 0 ? (
                    <Text style={{ color: textSecondary, fontSize: 13 }}>Todavía no hay equipos en tu organización.</Text>
                  ) : filteredTeams.length === 0 ? (
                    <Text style={{ color: textSecondary, fontSize: 13 }}>Ningún equipo coincide con esa búsqueda.</Text>
                  ) : (
                    filteredTeams.map((team) => {
                      const selected = team.id === selectedTeamId;
                      return (
                        <TouchableOpacity
                          key={team.id}
                          activeOpacity={0.85}
                          onPress={() => setSelectedTeamId(team.id)}
                          style={[styles.pickerChip, { backgroundColor: selected ? team.color : inputBg, borderColor: selected ? team.color : border }]}
                        >
                          <UsersIcon size={12} color={selected ? "#FFF" : team.color} />
                          <Text style={{ color: selected ? "#FFF" : textPrimary, fontWeight: "700", fontSize: 12.5 }} numberOfLines={1}>
                            {team.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                  </ScrollView>
                </>
              )}

              {activeTab === "projects" && (
                <>
                  {projects.length > 3 && (
                    <View style={[styles.searchWrapper, { backgroundColor: inputBg, borderColor: border }]}>
                      <Search size={14} color={textSecondary} strokeWidth={2.2} />
                      <TextInput
                        value={projectSearch}
                        onChangeText={setProjectSearch}
                        placeholder="Buscar proyecto…"
                        placeholderTextColor={textSecondary}
                        style={[styles.searchInput, { color: textPrimary }, Platform.OS === "web" && styles.noOutline]}
                      />
                    </View>
                  )}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                  {projects.length === 0 ? (
                    <Text style={{ color: textSecondary, fontSize: 13 }}>Todavía no hay proyectos en tu organización.</Text>
                  ) : filteredProjects.length === 0 ? (
                    <Text style={{ color: textSecondary, fontSize: 13 }}>Ningún proyecto coincide con esa búsqueda.</Text>
                  ) : (
                    filteredProjects.map((project) => {
                      const selected = project.id === selectedProjectId;
                      return (
                        <TouchableOpacity
                          key={project.id}
                          activeOpacity={0.85}
                          onPress={() => setSelectedProjectId(project.id)}
                          style={[styles.pickerChip, { backgroundColor: selected ? project.color : inputBg, borderColor: selected ? project.color : border }]}
                        >
                          <Folder size={12} color={selected ? "#FFF" : project.color} />
                          <Text style={{ color: selected ? "#FFF" : textPrimary, fontWeight: "700", fontSize: 12.5 }} numberOfLines={1}>
                            {project.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                  </ScrollView>
                </>
              )}

              {activeTab === "users" && (
                <>
                  {members.length > 3 && (
                    <View style={[styles.searchWrapper, { backgroundColor: inputBg, borderColor: border }]}>
                      <Search size={14} color={textSecondary} strokeWidth={2.2} />
                      <TextInput
                        value={userSearch}
                        onChangeText={setUserSearch}
                        placeholder="Buscar colaborador…"
                        placeholderTextColor={textSecondary}
                        style={[styles.searchInput, { color: textPrimary }, Platform.OS === "web" && styles.noOutline]}
                      />
                    </View>
                  )}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                  {members.length === 0 ? (
                    <Text style={{ color: textSecondary, fontSize: 13 }}>Todavía no hay colaboradores en tu organización.</Text>
                  ) : filteredMembers.length === 0 ? (
                    <Text style={{ color: textSecondary, fontSize: 13 }}>Nadie coincide con esa búsqueda.</Text>
                  ) : (
                    filteredMembers.map((member) => {
                      const selected = member.userId === selectedUserId;
                      return (
                        <TouchableOpacity
                          key={member.userId}
                          activeOpacity={0.85}
                          onPress={() => setSelectedUserId(member.userId)}
                          style={[styles.pickerChip, { backgroundColor: selected ? primaryColor : inputBg, borderColor: selected ? primaryColor : border }]}
                        >
                          <View style={[styles.avatarMini, { backgroundColor: member.avatarColor }]}>
                            <Text style={styles.avatarMiniText}>{initials(member.name)}</Text>
                          </View>
                          <Text style={{ color: selected ? "#FFF" : textPrimary, fontWeight: "700", fontSize: 12.5 }} numberOfLines={1}>
                            {member.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                  </ScrollView>
                </>
              )}

              {errorText && <Text style={[styles.errorText, { color: dangerColor }]}>{errorText}</Text>}

              {loadingEntries ? (
                <Text style={{ color: textSecondary, marginTop: 24 }}>Cargando…</Text>
              ) : entries.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border, marginTop: 20 }, ultraShadow]}>
                  <Activity size={32} color={textSecondary} strokeWidth={2.2} />
                  <Text style={[styles.emptyTitle, { color: textPrimary }]}>Sin actividad todavía</Text>
                  <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
                    {activeTab === "recent"
                      ? "Aquí verás lo que pase en tu workspace en tiempo real."
                      : "Elige un elemento arriba, o todavía no hay nada que mostrar."}
                  </Text>
                </View>
              ) : (
                <View style={{ marginTop: 20, gap: 10 }}>
                  {entries.map((entry) => (
                    <ActivityRow
                      key={entry.id}
                      entry={entry}
                      isDark={isDark}
                      primaryColor={primaryColor}
                      border={border}
                      textPrimary={textPrimary}
                      textSecondary={textSecondary}
                      cardBg={cardBg}
                    />
                  ))}
                </View>
              )}
            </>
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  subtitle: { fontSize: 13, fontWeight: "600" },
  title: { fontSize: 30, fontWeight: "700", letterSpacing: -0.5, marginTop: 2 },

  tabRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 24 },
  tabChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },

  searchWrapper: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, marginTop: 16 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 13 },
  noOutline: { outlineStyle: "none" } as any,

  pickerScroll: { marginTop: 10 },
  pickerChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginRight: 10, maxWidth: 200 },
  avatarMini: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  avatarMiniText: { color: "#FFF", fontSize: 9, fontWeight: "700" },

  errorText: { marginTop: 16, fontSize: 13, fontWeight: "600" },

  emptyCard: { borderRadius: 28, borderWidth: 1, padding: 32, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "600", textAlign: "center" },
  emptySubtitle: { fontSize: 13, textAlign: "center", lineHeight: 20 },
});
