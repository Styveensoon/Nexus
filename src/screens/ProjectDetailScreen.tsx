import React, { useCallback, useState } from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowLeft, ArrowRight, ChevronDown, Crown, Folder, Layers, ListChecks, MessageCircle, Sparkles, Target, Users } from "lucide-react-native";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import MemberProfileModal from "../components/MemberProfileModal";
import ProjectStatusPickerModal from "../components/ProjectStatusPickerModal";
import {
  convertFirstStepToTask,
  listProjects,
  Project,
  ProjectStatus,
  STATUS_COLORS,
  STATUS_LABELS,
  updateProjectStatus,
} from "../lib/projects";
import { generateProjectDigest } from "../lib/digest";

const AZURE_DEEP = "#2C7BD1";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

// Pantalla de detalle de un proyecto puntual (docs/ESTADO.md la marcaba como
// "Pendiente" — hasta ahora Proyectos solo tenía tarjetas/lista, sin vista
// propia). Reusa listProjects y filtra por id en vez de duplicar la
// hidratación de miembros/equipos con una query aparte (mismo criterio que
// listMyProjects/listMyTeams).
export default function ProjectDetailScreen({ navigation, route }: any) {
  const { isDark } = useTheme();
  const { user, organization } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const projectId: string | undefined = route?.params?.projectId;
  const isOwner = !!organization && organization.owner_id === user?.id;

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

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);
  const [statusPickerVisible, setStatusPickerVisible] = useState(false);
  const [convertingStep, setConvertingStep] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [generatingDigest, setGeneratingDigest] = useState(false);
  const [digestError, setDigestError] = useState<string | null>(null);

  const loadProject = useCallback(async () => {
    if (!organization || !projectId) return;
    setLoading(true);
    const { data } = await listProjects(organization.id);
    setProject(data.find((p) => p.id === projectId) ?? null);
    setLoading(false);
  }, [organization, projectId]);

  useFocusEffect(
    useCallback(() => {
      loadProject();
    }, [loadProject])
  );

  const canManage = !!project && (isOwner || project.leaderId === user?.id);

  const allMembersMap = new Map<string, Project["members"][number]>();
  if (project) {
    [...project.members, ...project.teams.flatMap((t) => t.members)].forEach((m) => {
      if (!allMembersMap.has(m.userId)) allMembersMap.set(m.userId, m);
    });
  }
  const allMembers = Array.from(allMembersMap.values());
  const leader = allMembers.find((m) => m.userId === project?.leaderId);
  const otherMembers = allMembers.filter((m) => m.userId !== project?.leaderId);

  const handleSetStatus = async (status: ProjectStatus) => {
    if (!project || !canManage) return;
    setProject({ ...project, status });
    setStatusPickerVisible(false);
    await updateProjectStatus(project.id, status);
  };

  const handleConvertStep = async (step: string) => {
    if (!project || !user) return;
    setConvertError(null);
    setConvertingStep(step);
    const { error } = await convertFirstStepToTask(project, step, user.id);
    setConvertingStep(null);
    if (error) {
      setConvertError("No se pudo convertir este paso en tarea.");
      return;
    }
    setProject({ ...project, firstSteps: project.firstSteps.filter((s) => s !== step) });
  };

  const handleGenerateDigest = async () => {
    if (!project) return;
    setGeneratingDigest(true);
    setDigestError(null);
    const { error, content } = await generateProjectDigest(project.id);
    setGeneratingDigest(false);
    if (error || !content) {
      setDigestError("No se pudo generar el resumen, intenta de nuevo.");
      return;
    }
    setProject({ ...project, lastDigestContent: content, lastDigestAt: new Date().toISOString() });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bg, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: textSecondary }}>Cargando…</Text>
      </View>
    );
  }

  if (!project) {
    return (
      <View style={[styles.container, { backgroundColor: bg, alignItems: "center", justifyContent: "center", padding: 24 }]}>
        <Text style={[styles.emptyTitle, { color: textPrimary }]}>No se encontró este proyecto.</Text>
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
            <Text style={[styles.backLinkText, { color: textSecondary }]}>Volver a Proyectos</Text>
          </TouchableOpacity>

          <View style={[styles.headerCard, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
            <View style={styles.headerRow}>
              <View style={[styles.projectIcon, { backgroundColor: project.color + "20" }]}>
                {project.iconUrl ? (
                  <Image source={{ uri: project.iconUrl }} style={styles.projectIconImage} />
                ) : (
                  <Folder size={26} color={project.color} strokeWidth={2.2} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: textPrimary }]}>{project.name}</Text>
                <TouchableOpacity
                  activeOpacity={canManage ? 0.7 : 1}
                  disabled={!canManage}
                  onPress={() => setStatusPickerVisible(true)}
                  style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[project.status] + "20", alignSelf: "flex-start" }]}
                >
                  <Text style={{ color: STATUS_COLORS[project.status], fontWeight: "700", fontSize: 12.5 }}>
                    {STATUS_LABELS[project.status]}
                  </Text>
                  {canManage && <ChevronDown size={12} color={STATUS_COLORS[project.status]} />}
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.askAriaBtn, { backgroundColor: inputBg, borderColor: border }]}
                onPress={() =>
                  navigation.navigate("Aria", {
                    contextType: "project",
                    contextId: project.id,
                    contextLabel: project.name,
                  })
                }
              >
                <MessageCircle size={13} color={primaryColor} strokeWidth={2.3} />
                <Text style={[styles.askAriaBtnText, { color: primaryColor }]}>Preguntarle a Aria</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.description, { color: textSecondary }]}>
              {project.description || "Sin descripción."}
            </Text>
          </View>

          {/* RESUMEN SEMANAL — generado por IA (docs/ARQUITECTURA.md "Reportes
              automáticos con IA"), Edge Function project-weekly-digest. Se
              regenera solo con el cron semanal o el botón manual acá — nunca
              solo, ver la nota de generatingDigest. */}
          <SectionCard
            icon={<Sparkles size={16} color={primaryColor} strokeWidth={2.2} />}
            title="Resumen semanal"
            cardBg={cardBg}
            border={border}
            textPrimary={textPrimary}
            ultraShadow={ultraShadow}
          >
            {digestError && <Text style={{ color: "#EF4444", fontSize: 12.5, fontWeight: "600", marginBottom: 10 }}>{digestError}</Text>}
            {project.lastDigestContent ? (
              <View style={{ gap: 12 }}>
                <Text style={{ color: textPrimary, fontSize: 13.5, lineHeight: 20 }}>{project.lastDigestContent.summary}</Text>
                <View style={styles.digestMetricsRow}>
                  <View style={[styles.digestMetricBox, { backgroundColor: inputBg }]}>
                    <Text style={[styles.digestMetricValue, { color: primaryColor }]}>{project.lastDigestContent.metrics.progressPercent}%</Text>
                    <Text style={[styles.digestMetricLabel, { color: textSecondary }]}>Avance</Text>
                  </View>
                  <View style={[styles.digestMetricBox, { backgroundColor: inputBg }]}>
                    <Text style={[styles.digestMetricValue, { color: primaryColor }]}>{project.lastDigestContent.metrics.tasksCompleted}</Text>
                    <Text style={[styles.digestMetricLabel, { color: textSecondary }]}>Completadas</Text>
                  </View>
                  <View style={[styles.digestMetricBox, { backgroundColor: inputBg }]}>
                    <Text
                      style={[
                        styles.digestMetricValue,
                        { color: project.lastDigestContent.metrics.tasksOverdue > 0 ? "#EF4444" : primaryColor },
                      ]}
                    >
                      {project.lastDigestContent.metrics.tasksOverdue}
                    </Text>
                    <Text style={[styles.digestMetricLabel, { color: textSecondary }]}>Vencidas</Text>
                  </View>
                </View>
                {project.lastDigestAt && (
                  <Text style={{ color: textSecondary, fontSize: 11 }}>
                    Actualizado {new Date(project.lastDigestAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </Text>
                )}
              </View>
            ) : (
              <Text style={{ color: textSecondary, fontSize: 13 }}>
                Todavía no se generó ningún resumen — se arma solo cada lunes, o generalo ahora.
              </Text>
            )}
            {canManage && (
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={generatingDigest}
                style={[styles.digestGenerateBtn, { backgroundColor: primaryColor, opacity: generatingDigest ? 0.6 : 1 }]}
                onPress={handleGenerateDigest}
              >
                <Sparkles size={13} color="#FFF" strokeWidth={2.3} />
                <Text style={styles.digestGenerateBtnText}>
                  {generatingDigest ? "Generando…" : project.lastDigestContent ? "Regenerar" : "Generar ahora"}
                </Text>
              </TouchableOpacity>
            )}
          </SectionCard>

          {project.goals.length > 0 && (
            <SectionCard icon={<Target size={16} color={primaryColor} strokeWidth={2.2} />} title="Metas" cardBg={cardBg} border={border} textPrimary={textPrimary} ultraShadow={ultraShadow}>
              <View style={{ gap: 8 }}>
                {project.goals.map((goal) => (
                  <View key={goal} style={[styles.listRow, { backgroundColor: inputBg, borderColor: border }]}>
                    <Target size={13} color={primaryColor} strokeWidth={2.2} />
                    <Text style={{ color: textPrimary, fontSize: 13, flex: 1 }}>{goal}</Text>
                  </View>
                ))}
              </View>
            </SectionCard>
          )}

          {project.areas.length > 0 && (
            <SectionCard icon={<Layers size={16} color={primaryColor} strokeWidth={2.2} />} title="Áreas involucradas" cardBg={cardBg} border={border} textPrimary={textPrimary} ultraShadow={ultraShadow}>
              <View style={styles.chipsRow}>
                {project.areas.map((area) => (
                  <View key={area} style={[styles.chip, { borderColor: border, backgroundColor: inputBg }]}>
                    <Text style={{ color: textPrimary, fontSize: 12.5, fontWeight: "600" }}>{area}</Text>
                  </View>
                ))}
              </View>
            </SectionCard>
          )}

          <SectionCard icon={<Users size={16} color={primaryColor} strokeWidth={2.2} />} title="Equipos asignados" cardBg={cardBg} border={border} textPrimary={textPrimary} ultraShadow={ultraShadow}>
            {project.teams.length ? (
              <View style={{ gap: 8 }}>
                {project.teams.map((team) => (
                  <TouchableOpacity
                    key={team.id}
                    activeOpacity={0.8}
                    style={[styles.listRow, { backgroundColor: inputBg, borderColor: border }]}
                    onPress={() => navigation.navigate("TeamDetail", { teamId: team.id })}
                  >
                    <View style={[styles.teamDot, { backgroundColor: team.color }]} />
                    <Text style={{ color: textPrimary, fontSize: 13, fontWeight: "700", flex: 1 }}>{team.name}</Text>
                    <Text style={{ color: textSecondary, fontSize: 12 }}>
                      {team.members.length} {team.members.length === 1 ? "integrante" : "integrantes"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={{ color: textSecondary, fontSize: 13 }}>Ningún equipo asignado a este proyecto todavía.</Text>
            )}
          </SectionCard>

          <SectionCard icon={<Users size={16} color={primaryColor} strokeWidth={2.2} />} title="Miembros" cardBg={cardBg} border={border} textPrimary={textPrimary} ultraShadow={ultraShadow}>
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
                  <Text style={{ color: primaryColor, fontSize: 10, fontWeight: "700" }}>Líder</Text>
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
              !leader && <Text style={{ color: textSecondary, fontSize: 13 }}>Sin miembros asignados todavía.</Text>
            )}
          </SectionCard>

          {project.firstSteps.length > 0 && (
            <SectionCard icon={<ListChecks size={16} color={primaryColor} strokeWidth={2.2} />} title="Primeros pasos sugeridos por El Semillero" cardBg={cardBg} border={border} textPrimary={textPrimary} ultraShadow={ultraShadow}>
              {convertError && <Text style={{ color: "#EF4444", fontSize: 12.5, fontWeight: "600", marginBottom: 10 }}>{convertError}</Text>}
              <View style={{ gap: 8 }}>
                {project.firstSteps.map((step) => (
                  <View key={step} style={[styles.stepRow, { backgroundColor: inputBg, borderColor: border }]}>
                    <Text style={{ color: textPrimary, fontSize: 13, flex: 1, lineHeight: 19 }}>{step}</Text>
                    {canManage && (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        disabled={convertingStep === step}
                        style={[styles.convertBtn, { backgroundColor: primaryColor, opacity: convertingStep === step ? 0.6 : 1 }]}
                        onPress={() => handleConvertStep(step)}
                      >
                        <Text style={styles.convertBtnText}>{convertingStep === step ? "Creando…" : "Convertir en tarea"}</Text>
                        {convertingStep !== step && <ArrowRight size={12} color="#FFF" strokeWidth={2.3} />}
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            </SectionCard>
          )}

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

      <ProjectStatusPickerModal
        visible={statusPickerVisible}
        isDark={isDark}
        currentStatus={project.status}
        onClose={() => setStatusPickerVisible(false)}
        onSelect={handleSetStatus}
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
  projectIcon: { width: 52, height: 52, borderRadius: 18, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  projectIconImage: { width: 52, height: 52, resizeMode: "cover" },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4, marginBottom: 6 },
  description: { fontSize: 13.5, lineHeight: 20, marginTop: 16 },

  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  askAriaBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "flex-start" },
  askAriaBtnText: { fontSize: 12, fontWeight: "700" },

  sectionCard: { borderRadius: 24, borderWidth: 1, padding: 20, marginBottom: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontWeight: "700" },

  listRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  teamDot: { width: 10, height: 10, borderRadius: 5 },

  memberRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  avatarMini: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarMiniText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  leaderPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },

  stepRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flexWrap: "wrap" },
  convertBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  convertBtnText: { color: "#FFF", fontWeight: "700", fontSize: 11.5 },

  emptyTitle: { fontSize: 15, fontWeight: "700" },

  digestMetricsRow: { flexDirection: "row", gap: 8 },
  digestMetricBox: { flex: 1, borderRadius: 14, paddingVertical: 10, alignItems: "center" },
  digestMetricValue: { fontSize: 17, fontWeight: "700" },
  digestMetricLabel: { fontSize: 10, marginTop: 2 },
  digestGenerateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 999, paddingVertical: 11, marginTop: 14 },
  digestGenerateBtnText: { color: "#FFF", fontSize: 12.5, fontWeight: "700" },
});
