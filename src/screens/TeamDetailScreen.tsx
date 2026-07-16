import React, { useCallback, useState } from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowLeft, Crown, Folder, Users } from "lucide-react-native";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import MemberProfileModal from "../components/MemberProfileModal";
import { getTeamsByIds, Team } from "../lib/teams";
import { listProjects, Project, STATUS_COLORS, STATUS_LABELS } from "../lib/projects";

const AZURE_DEEP = "#2C7BD1";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

// Pantalla de detalle de un equipo puntual (docs/ESTADO.md la marcaba como
// "Pendiente" — hasta ahora Equipos solo tenía tarjetas/lista, sin vista
// propia). getTeamsByIds ya trae el equipo hidratado con sus integrantes; los
// proyectos donde participa se resuelven reusando listProjects (igual que
// listMyProjects/listMyTeams), no hay una query dedicada para esto todavía.
export default function TeamDetailScreen({ navigation, route }: any) {
  const { isDark } = useTheme();
  const { organization } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const teamId: string | undefined = route?.params?.teamId;

  const bg            = isDark ? "#0B1220" : "#F1F5FA";
  const cardBg        = isDark ? "rgba(17, 24, 39, 0.58)" : "rgba(255, 255, 255, 0.6)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = AZURE_DEEP;
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

  const [team, setTeam] = useState<Team | null>(null);
  const [teamProjects, setTeamProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    const { data: teamRows } = await getTeamsByIds([teamId]);
    setTeam(teamRows[0] ?? null);
    if (organization) {
      const { data: allProjects } = await listProjects(organization.id);
      setTeamProjects(allProjects.filter((p) => p.teams.some((t) => t.id === teamId)));
    }
    setLoading(false);
  }, [organization, teamId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const teamMembers = team?.members ?? [];
  const teamLeaderId = team?.leaderId ?? null;
  const leader = teamMembers.find((m) => m.userId === teamLeaderId);
  const otherMembers = teamMembers.filter((m) => m.userId !== teamLeaderId);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bg, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: textSecondary }}>Cargando…</Text>
      </View>
    );
  }

  if (!team) {
    return (
      <View style={[styles.container, { backgroundColor: bg, alignItems: "center", justifyContent: "center", padding: 24 }]}>
        <Text style={[styles.emptyTitle, { color: textPrimary }]}>No se encontró este equipo.</Text>
        <TouchableOpacity style={{ marginTop: 12 }} onPress={() => navigation.goBack()}>
          <Text style={{ color: primaryColor, fontWeight: "700" }}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: isMobile ? 16 : 32 }}>
        <View style={{ width: "100%", maxWidth: 900, alignSelf: "center" }}>
          <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()} hitSlop={8}>
            <ArrowLeft size={16} color={textSecondary} strokeWidth={2.2} />
            <Text style={[styles.backLinkText, { color: textSecondary }]}>Volver a Equipos</Text>
          </TouchableOpacity>

          <View style={[styles.headerCard, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
            <View style={styles.headerRow}>
              <View style={[styles.teamIcon, { backgroundColor: team.color + "20" }]}>
                {team.iconUrl ? (
                  <Image source={{ uri: team.iconUrl }} style={styles.teamIconImage} />
                ) : (
                  <Users size={26} color={team.color} strokeWidth={2.2} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: textPrimary }]}>{team.name}</Text>
                <Text style={{ color: textSecondary, fontSize: 12.5, fontWeight: "600" }}>
                  {team.members.length} {team.members.length === 1 ? "integrante" : "integrantes"}
                </Text>
              </View>
            </View>

            <Text style={[styles.description, { color: textSecondary }]}>
              {team.description || "Sin descripción."}
            </Text>
          </View>

          <SectionCard icon={<Users size={16} color={primaryColor} strokeWidth={2.2} />} title="Integrantes" cardBg={cardBg} border={border} textPrimary={textPrimary} ultraShadow={ultraShadow}>
            {leader && (
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.memberRow, { backgroundColor: inputBg, borderColor: border }]}
                onPress={() => setProfileModalUserId(leader.userId)}
              >
                <View style={[styles.avatarMini, { backgroundColor: leader.avatarColor }]}>
                  <Text style={styles.avatarMiniText}>{initials(leader.name)}</Text>
                </View>
                <Text style={{ color: textPrimary, fontSize: 13, fontWeight: "700", flex: 1 }} numberOfLines={1}>
                  {leader.name}
                </Text>
                <View style={[styles.leaderPill, { backgroundColor: isDark ? "rgba(126,200,245,0.14)" : "rgba(44,123,209,0.08)" }]}>
                  <Crown size={10} color={primaryColor} />
                  <Text style={{ color: primaryColor, fontSize: 10, fontWeight: "700" }}>Encargado/a</Text>
                </View>
              </TouchableOpacity>
            )}
            {otherMembers.length ? (
              <View style={{ gap: 8, marginTop: leader ? 8 : 0 }}>
                {otherMembers.map((m) => (
                  <TouchableOpacity
                    key={m.userId}
                    activeOpacity={0.8}
                    style={[styles.memberRow, { backgroundColor: inputBg, borderColor: border }]}
                    onPress={() => setProfileModalUserId(m.userId)}
                  >
                    <View style={[styles.avatarMini, { backgroundColor: m.avatarColor }]}>
                      <Text style={styles.avatarMiniText}>{initials(m.name)}</Text>
                    </View>
                    <Text style={{ color: textPrimary, fontSize: 13, fontWeight: "700", flex: 1 }} numberOfLines={1}>
                      {m.name}
                    </Text>
                    {!!m.roleInTeam && (
                      <Text style={{ color: textSecondary, fontSize: 11.5 }} numberOfLines={1}>
                        {m.roleInTeam}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              !leader && <Text style={{ color: textSecondary, fontSize: 13 }}>Sin integrantes asignados todavía.</Text>
            )}
          </SectionCard>

          <SectionCard icon={<Folder size={16} color={primaryColor} strokeWidth={2.2} />} title="Proyectos" cardBg={cardBg} border={border} textPrimary={textPrimary} ultraShadow={ultraShadow}>
            {teamProjects.length ? (
              <View style={{ gap: 8 }}>
                {teamProjects.map((project) => (
                  <TouchableOpacity
                    key={project.id}
                    activeOpacity={0.8}
                    style={[styles.memberRow, { backgroundColor: inputBg, borderColor: border }]}
                    onPress={() => navigation.navigate("ProjectDetail", { projectId: project.id })}
                  >
                    <View style={[styles.projectIcon, { backgroundColor: project.color + "20" }]}>
                      {project.iconUrl ? (
                        <Image source={{ uri: project.iconUrl }} style={styles.projectIconImage} />
                      ) : (
                        <Folder size={14} color={project.color} strokeWidth={2.2} />
                      )}
                    </View>
                    <Text style={{ color: textPrimary, fontSize: 13, fontWeight: "700", flex: 1 }} numberOfLines={1}>
                      {project.name}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[project.status] + "20" }]}>
                      <Text style={{ color: STATUS_COLORS[project.status], fontWeight: "700", fontSize: 10 }}>
                        {STATUS_LABELS[project.status]}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={{ color: textSecondary, fontSize: 13 }}>Este equipo todavía no está asignado a ningún proyecto.</Text>
            )}
          </SectionCard>

          <View style={{ height: 60 }} />
        </View>
      </ScrollView>

      <MemberProfileModal
        visible={!!profileModalUserId}
        userId={profileModalUserId}
        organizationId={organization?.id ?? null}
        isDark={isDark}
        onClose={() => setProfileModalUserId(null)}
      />
    </View>
  );
}

function SectionCard({
  icon,
  title,
  cardBg,
  border,
  textPrimary,
  ultraShadow,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  cardBg: string;
  border: string;
  textPrimary: string;
  ultraShadow: any;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
      <View style={styles.sectionHeader}>
        {icon}
        <Text style={[styles.sectionTitle, { color: textPrimary }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backLink: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 },
  backLinkText: { fontSize: 13.5, fontWeight: "600" },

  headerCard: { borderRadius: 28, borderWidth: 1, padding: 22, marginBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  teamIcon: { width: 52, height: 52, borderRadius: 18, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  teamIconImage: { width: 52, height: 52, resizeMode: "cover" },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4, marginBottom: 4 },
  description: { fontSize: 13.5, lineHeight: 20, marginTop: 16 },

  sectionCard: { borderRadius: 24, borderWidth: 1, padding: 20, marginBottom: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontWeight: "700" },

  memberRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  avatarMini: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarMiniText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  leaderPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },

  projectIcon: { width: 26, height: 26, borderRadius: 9, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  projectIconImage: { width: 26, height: 26, resizeMode: "cover" },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },

  emptyTitle: { fontSize: 15, fontWeight: "700" },
});
