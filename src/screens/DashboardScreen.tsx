import React, { useCallback, useState } from "react";
import {
  Image,
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
import * as Clipboard from "expo-clipboard";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronRight,
  Copy,
  Crown,
  Folder,
  Gauge,
  LogOut,
  MessageCircle,
  Search,
  Settings,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react-native";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { listTeams, Team } from "../lib/teams";
import { listProjects, Project, STATUS_COLORS, STATUS_LABELS } from "../lib/projects";
import { countOrgBadges } from "../lib/badges";
import { countOrgClients } from "../lib/clients";
import { listActivity, ActivityEntry } from "../lib/activity";
import { getWorkloadForLeader, getWorkloadForOrganization, WorkloadEntry } from "../lib/workload";
import {
  listTasksForUser,
  Task,
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
  isOverdue,
  isDueSoon,
  formatShortDate,
  DUE_SOON_COLOR,
} from "../lib/tasks";
import ActivityRow from "../components/ActivityRow";
import ActivityDetailModal from "../components/ActivityDetailModal";

// Paleta de marca de Nexus (azure del logo) — acento moderado, no cubre áreas grandes.
// El color de la organización (organization.color) sigue siendo el que manda en el
// hero card y el avatar, esa es una feature de branding por workspace aparte.
const AZURE_DEEP = "#2C7BD1";

const WELCOME_PHRASES: Array<(name: string) => string> = [
  (n) => `¡Qué bueno verte, ${n}! 👋`,
  (n) => `Bienvenido de nuevo, ${n} 👋`,
  (n) => `Listo para un gran día, ${n}?`,
  (n) => `${n}, tu equipo te está esperando 🚀`,
  (n) => `Hoy es un buen día para avanzar, ${n}`,
  (n) => `De vuelta a la acción, ${n} 💪`,
  (n) => `A construir grandes cosas, ${n}`,
  (n) => `${n}, vamos con todo hoy`,
  (n) => `Un gusto tenerte aquí, ${n} 👋`,
];

function mixHex(hex: string, base: string, weight = 0.14) {
  const parse = (h: string) => {
    const clean = h.replace("#", "");
    return /^[0-9A-Fa-f]{6}$/.test(clean) ? parseInt(clean, 16) : null;
  };
  const a = parse(hex);
  const b = parse(base);
  if (a === null || b === null) return base;
  const mix = (shift: number) => {
    const av = (a >> shift) & 0xff;
    const bv = (b >> shift) & 0xff;
    return Math.round(av * weight + bv * (1 - weight));
  };
  const r = mix(16), g = mix(8), c = mix(0);
  return `#${[r, g, c].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export default function DashboardScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const { user, organization, loading, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = Platform.OS === "web";

  const [copied, setCopied] = useState(false);
  // Se elige una vez por montaje: cambia cada sesión / cada refresh, se mantiene estable mientras se navega dentro de la app.
  const [phraseIndex] = useState(() => Math.floor(Math.random() * WELCOME_PHRASES.length));
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [badgeCount, setBadgeCount] = useState<number | null>(null);
  const [clientCount, setClientCount] = useState<number | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>([]);
  const [detailEntry, setDetailEntry] = useState<ActivityEntry | null>(null);
  const [myTasks, setMyTasks] = useState<Task[] | null>(null);
  const [workload, setWorkload] = useState<WorkloadEntry[] | null>(null);

  // useFocusEffect (no useEffect) para que los conteos se refresquen cada vez
  // que se vuelve a esta pestaña (p. ej. después de crear un proyecto en otra
  // pestaña) — con useEffect solo se cargaban una vez al montar el tab.
  useFocusEffect(
    useCallback(() => {
      if (!organization || !user) return;
      listTeams(organization.id).then(({ data }) => setTeams(data));
      listProjects(organization.id).then(({ data }) => setProjects(data));
      countOrgBadges(organization.id).then(({ count }) => setBadgeCount(count));
      countOrgClients(organization.id).then(({ count }) => setClientCount(count));
      listActivity({ organizationId: organization.id, limit: 5 }).then(({ data }) => setRecentActivity(data));
      listTasksForUser(organization.id, user.id).then(({ data }) => setMyTasks(data));

      // Workload Balancer: el owner ve toda la organización, un encargado de
      // equipo (no owner) ve solo los integrantes de los equipos que lidera —
      // se decide acá porque isOwner todavía no está calculado en este punto
      // del render (depende de `organization`, ya disponible en el closure).
      const isOwnerNow = organization.owner_id === user.id;
      if (isOwnerNow) {
        getWorkloadForOrganization(organization.id).then(({ data }) => setWorkload(data));
      } else {
        getWorkloadForLeader(organization.id, user.id).then(({ data }) => setWorkload(data));
      }
    }, [organization, user])
  );

  const teamCount = teams?.length ?? null;
  const isOwner = organization?.owner_id === user?.id;
  // "A cargo" = lidera al menos un equipo o un proyecto sin ser el owner de la
  // organización (el owner ya ve todo, no necesita este chip extra). Mapea a
  // los mismos leader_id que ya usan TasksScreen/BadgesScreen para permisos
  // reales — esto es solo presentación, no agrega ningún permiso nuevo.
  const ledTeams = !isOwner ? (teams ?? []).filter((t) => t.leaderId === user?.id) : [];
  const ledProjects = !isOwner ? (projects ?? []).filter((p) => p.leaderId === user?.id) : [];
  const isLeader = ledTeams.length > 0 || ledProjects.length > 0;

  // Tareas propias pendientes: asignadas a mí, a un equipo del que soy
  // integrante, o donde soy colaborador (listTasksForUser ya resuelve las 3
  // vías). Se excluyen los estados terminales y se ordena vencidas primero,
  // luego por vencer, luego el resto por fecha (sin fecha al final).
  const pendingMyTasks = (myTasks ?? [])
    .filter((t) => t.status !== "completed" && t.status !== "cancelled")
    .sort((a, b) => {
      const rank = (t: Task) => (isOverdue(t) ? 0 : isDueSoon(t) ? 1 : 2);
      const rankDiff = rank(a) - rank(b);
      if (rankDiff !== 0) return rankDiff;
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    })
    .slice(0, 5);

  const bg            = isDark ? "#0B1220" : "#F1F5FA";
  const cardBg        = isDark ? "rgba(17, 24, 39, 0.58)" : "rgba(255, 255, 255, 0.6)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = AZURE_DEEP;
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";
  const sheetBg       = isDark ? "rgba(15, 23, 42, 0.6)" : "rgba(255, 255, 255, 0.6)";

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

  const pageBg = organization ? mixHex(organization.color, bg, 0.14) : bg;
  const orgColor = organization?.color ?? primaryColor;

  const firstName =
    (user?.user_metadata as any)?.full_name?.trim?.().split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "ahí";

  const welcomeMessage = WELCOME_PHRASES[phraseIndex](firstName);

  const handleSignOut = async () => {
    await signOut();
    navigation.getParent()?.reset({ index: 0, routes: [{ name: "Landing" }] });
  };

  const handleCopyCode = async () => {
    if (!organization) return;
    try {
      await Clipboard.setStringAsync(organization.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // portapapeles no disponible (raro), el botón simplemente no cambia a "Copiado"
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bg, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: textSecondary }}>Cargando…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: pageBg, overflow: "hidden" }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: isMobile ? 16 : 32 }}>
        <View style={{ width: "100%", maxWidth: 1280, alignSelf: "center" }}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarWrap}>
                <View style={[styles.avatar, { backgroundColor: orgColor }]}>
                  {organization?.logo_url ? (
                    <Image source={{ uri: organization.logo_url }} style={styles.avatarImage} />
                  ) : (
                    <Building2 size={26} color="#FFF" strokeWidth={2.3} />
                  )}
                </View>
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={[styles.greetingBig, { color: textPrimary }]} numberOfLines={1}>
                  {welcomeMessage}
                </Text>
                <View style={styles.orgChipRow}>
                  <Text style={[styles.orgNameChip, { color: textSecondary }]} numberOfLines={1}>
                    {organization?.name ?? "Nexus"}
                  </Text>
                  {organization && (
                    <View style={[styles.rolePill, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(44,123,209,0.08)" }]}>
                      <Text style={[styles.rolePillText, { color: isDark ? textSecondary : AZURE_DEEP }]}>
                        {isOwner ? "OWNER" : "MIEMBRO"}
                      </Text>
                    </View>
                  )}
                  {isLeader && (
                    <View style={[styles.leaderPill, { backgroundColor: isDark ? "rgba(126,200,245,0.14)" : "rgba(44,123,209,0.1)" }]}>
                      <Crown size={11} color={AZURE_DEEP} strokeWidth={2.4} />
                      <Text style={[styles.rolePillText, { color: AZURE_DEEP }]}>
                        {ledTeams.length + ledProjects.length === 1 ? "A CARGO DE 1" : `A CARGO DE ${ledTeams.length + ledProjects.length}`}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {isMobile && (
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.iconBtn, { backgroundColor: cardBg, borderColor: border }]}
                onPress={handleSignOut}
              >
                <LogOut size={18} color={textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {!organization ? (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: border, marginTop: 24 }, ultraShadow]}>
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>Tu cuenta no tiene un workspace todavía</Text>
              <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
                Cierra sesión y vuelve a entrar para retomar la creación o unión a una organización.
              </Text>
            </View>
          ) : (
            <View style={[styles.sheet, { backgroundColor: sheetBg, borderColor: border, padding: isMobile ? 18 : 28 }, ultraShadow]}>
              {/* SEARCH */}
              <View style={[styles.searchWrapper, { backgroundColor: inputBg, borderColor: border }]}>
                <Search size={18} color={textSecondary} strokeWidth={2.3} />
                <TextInput
                  placeholder="Buscar…"
                  placeholderTextColor={textSecondary}
                  style={[styles.searchInput, { color: textPrimary }, isWeb && styles.noOutline]}
                />
              </View>

              {/* HERO — color sólido original de la organización, sin degradado
                  ni overlay de brillo (se probó y con ciertos colores de marca
                  se veía mal, ver feedback del usuario). */}
              <View style={[styles.heroCard, { backgroundColor: organization.color, overflow: "hidden" }]}>
                <View style={styles.heroTopRow}>
                  <Text style={styles.heroLabel}>TU WORKSPACE</Text>
                  {isOwner && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.heroSettingsBtn}
                      onPress={() => navigation.navigate("OrganizationSettings")}
                    >
                      <Settings size={16} color="#FFF" strokeWidth={2.3} />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.heroTitle} numberOfLines={1}>{organization.name}</Text>

                <View style={styles.heroCodeRow}>
                  <Text style={styles.heroCode}>{organization.invite_code}</Text>
                  <TouchableOpacity activeOpacity={0.85} style={styles.heroCopyBtn} onPress={handleCopyCode}>
                    <Copy size={14} color="#FFF" />
                    <Text style={styles.heroCopyText}>{copied ? "¡Copiado!" : "Copiar código"}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* EL SEMILLERO (solo el owner puede usarlo) */}
              {isOwner && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.semilleroCard, { backgroundColor: inputBg, borderColor: border }, ultraShadow]}
                  onPress={() => navigation.navigate("Semillero")}
                >
                  <View style={[styles.semilleroIcon, { backgroundColor: mixHex(AZURE_DEEP, isDark ? "#0F172A" : "#FFFFFF", 0.16) }]}>
                    <Sparkles size={22} color={AZURE_DEEP} strokeWidth={2.3} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.semilleroTitle, { color: textPrimary }]}>El Semillero</Text>
                    <Text style={[styles.semilleroDesc, { color: textSecondary }]} numberOfLines={2}>
                      Describe tu proyecto y la IA forma el equipo ideal basándose en perfiles reales de tu organización.
                    </Text>
                  </View>
                  <ChevronRight size={20} color={textSecondary} />
                </TouchableOpacity>
              )}

              {/* ARIA — asistente general, visible para cualquier miembro (no
                  solo owner, a diferencia de El Semillero de arriba). Ayuda a
                  entender proyectos/tareas puntuales y sirve como copiloto de
                  onboarding para gente nueva en la organización. */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.semilleroCard, { backgroundColor: inputBg, borderColor: border }, ultraShadow]}
                onPress={() => navigation.navigate("Aria")}
              >
                <View style={[styles.semilleroIcon, { backgroundColor: mixHex(AZURE_DEEP, isDark ? "#0F172A" : "#FFFFFF", 0.16) }]}>
                  <MessageCircle size={22} color={AZURE_DEEP} strokeWidth={2.3} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.semilleroTitle, { color: textPrimary }]}>Aria</Text>
                  <Text style={[styles.semilleroDesc, { color: textSecondary }]} numberOfLines={2}>
                    Tu asistente dentro de Nexus — pregúntale sobre un proyecto, una tarea, o lo que necesites entender del equipo.
                  </Text>
                </View>
                <ChevronRight size={20} color={textSecondary} />
              </TouchableOpacity>

              {/* EQUIPOS / BADGES / CLIENTES */}
              <View style={[styles.tileRow, { flexDirection: isMobile ? "column" : "row" }]}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.tile, { backgroundColor: inputBg, borderColor: border, width: isMobile ? "100%" : "32%" }, ultraShadow]}
                  onPress={() => navigation.navigate("Team")}
                >
                  <View style={[styles.tileIcon, { backgroundColor: isDark ? "rgba(126,200,245,0.14)" : "rgba(44,123,209,0.08)" }]}>
                    <Users size={18} color={primaryColor} strokeWidth={2.3} />
                  </View>
                  <Text style={[styles.tileTitle, { color: textPrimary }]}>Equipos</Text>
                  <Text style={[styles.tileStatus, { color: textSecondary }]}>
                    {teamCount === null
                      ? "Cargando…"
                      : teamCount === 0
                      ? "Aún no has creado equipos"
                      : `${teamCount} ${teamCount === 1 ? "equipo creado" : "equipos creados"}`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.tile, { backgroundColor: inputBg, borderColor: border, width: isMobile ? "100%" : "32%" }, ultraShadow]}
                  onPress={() => navigation.navigate("Badges")}
                >
                  <View style={[styles.tileIcon, { backgroundColor: isDark ? "rgba(126,200,245,0.14)" : "rgba(44,123,209,0.08)" }]}>
                    <BadgeCheck size={18} color={primaryColor} strokeWidth={2.3} />
                  </View>
                  <Text style={[styles.tileTitle, { color: textPrimary }]}>Badges</Text>
                  <Text style={[styles.tileStatus, { color: textSecondary }]}>
                    {badgeCount === null
                      ? "Cargando…"
                      : badgeCount === 0
                      ? "Aún no hay badges otorgados"
                      : `${badgeCount} ${badgeCount === 1 ? "badge otorgado" : "badges otorgados"}`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.tile, { backgroundColor: inputBg, borderColor: border, width: isMobile ? "100%" : "32%" }, ultraShadow]}
                  onPress={() => navigation.navigate("Clients")}
                >
                  <View style={[styles.tileIcon, { backgroundColor: isDark ? "rgba(126,200,245,0.14)" : "rgba(44,123,209,0.08)" }]}>
                    <UserCheck size={18} color={primaryColor} strokeWidth={2.3} />
                  </View>
                  <Text style={[styles.tileTitle, { color: textPrimary }]}>Clientes</Text>
                  <Text style={[styles.tileStatus, { color: textSecondary }]}>
                    {clientCount === null
                      ? "Cargando…"
                      : clientCount === 0
                      ? "Aún no tienes clientes agregados"
                      : `${clientCount} ${clientCount === 1 ? "cliente" : "clientes"}`}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* LO QUE LIDERAS — solo si sos encargado de algún equipo o líder de
                  algún proyecto sin ser el owner (el owner ya ve todo desde
                  arriba, este bloque es específicamente para dar contexto de
                  liderazgo a un miembro normal). */}
              {isLeader && (
                <>
                  <Text style={[styles.sectionTitle, { color: textPrimary }]}>Lo que lideras</Text>
                  <View style={styles.projectsMiniGrid}>
                    {ledTeams.map((team) => (
                      <TouchableOpacity
                        key={`team-${team.id}`}
                        activeOpacity={0.85}
                        style={[styles.projectMiniCard, { backgroundColor: inputBg, borderColor: border }, ultraShadow]}
                        onPress={() => navigation.navigate("Team")}
                      >
                        <View style={[styles.projectMiniIcon, { backgroundColor: team.color + "20" }]}>
                          {team.iconUrl ? (
                            <Image source={{ uri: team.iconUrl }} style={styles.projectMiniIconImage} />
                          ) : (
                            <Users size={16} color={team.color} strokeWidth={2.2} />
                          )}
                        </View>
                        <Text style={[styles.projectMiniTitle, { color: textPrimary }]} numberOfLines={1}>
                          {team.name}
                        </Text>
                        <View style={[styles.projectMiniStatus, { backgroundColor: AZURE_DEEP + "20" }]}>
                          <Text style={{ color: AZURE_DEEP, fontWeight: "700", fontSize: 10 }}>Encargado/a</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                    {ledProjects.map((project) => (
                      <TouchableOpacity
                        key={`project-${project.id}`}
                        activeOpacity={0.85}
                        style={[styles.projectMiniCard, { backgroundColor: inputBg, borderColor: border }, ultraShadow]}
                        onPress={() => navigation.navigate("Projects")}
                      >
                        <View style={[styles.projectMiniIcon, { backgroundColor: project.color + "20" }]}>
                          {project.iconUrl ? (
                            <Image source={{ uri: project.iconUrl }} style={styles.projectMiniIconImage} />
                          ) : (
                            <Folder size={16} color={project.color} strokeWidth={2.2} />
                          )}
                        </View>
                        <Text style={[styles.projectMiniTitle, { color: textPrimary }]} numberOfLines={1}>
                          {project.name}
                        </Text>
                        <View style={[styles.projectMiniStatus, { backgroundColor: AZURE_DEEP + "20" }]}>
                          <Text style={{ color: AZURE_DEEP, fontWeight: "700", fontSize: 10 }}>Líder</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* CARGA DEL EQUIPO (Workload Balancer) — solo owner (toda la
                  organización) o encargado de equipo (solo sus equipos), ver
                  lib/workload.ts. Un miembro normal no gestiona gente, no ve
                  esta sección. */}
              {(isOwner || isLeader) && (
                <>
                  <Text style={[styles.sectionTitle, { color: textPrimary }]}>Carga del equipo</Text>
                  {workload === null ? (
                    <View style={[styles.emptyCard, { backgroundColor: inputBg, borderColor: border }, ultraShadow]}>
                      <Text style={[styles.emptyTitle, { color: textPrimary }]}>Cargando…</Text>
                    </View>
                  ) : workload.length === 0 ? (
                    <View style={[styles.emptyCard, { backgroundColor: inputBg, borderColor: border }, ultraShadow]}>
                      <Gauge size={30} color={textSecondary} strokeWidth={2} />
                      <Text style={[styles.emptyTitle, { color: textPrimary }]}>Todavía no hay nadie para mostrar acá</Text>
                      <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
                        {isOwner
                          ? "Cuando tu organización tenga miembros, vas a ver su carga de tareas acá."
                          : "Cuando tu equipo tenga integrantes, vas a ver su carga de tareas acá."}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.activityCard, { backgroundColor: inputBg, borderColor: border }, ultraShadow]}>
                      <View style={{ gap: 14 }}>
                        {workload.slice(0, 6).map((entry, index) => {
                          const maxActive = Math.max(...workload.map((w) => w.activeTasks), 1);
                          const pct = Math.min(100, Math.round((entry.activeTasks / maxActive) * 100));
                          const isLast = index === Math.min(workload.length, 6) - 1;
                          const initials = entry.name
                            .trim()
                            .split(/\s+/)
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((p) => p[0]?.toUpperCase())
                            .join("") || "?";
                          return (
                            <View key={entry.userId} style={[styles.workloadRow, { borderColor: isLast ? "transparent" : border }]}>
                              <View style={[styles.workloadAvatar, { backgroundColor: entry.avatarColor, overflow: "hidden" }]}>
                                {entry.avatarUrl ? (
                                  <Image source={{ uri: entry.avatarUrl }} style={{ width: 32, height: 32 }} />
                                ) : (
                                  <Text style={styles.workloadAvatarText}>{initials}</Text>
                                )}
                              </View>
                              <View style={{ flex: 1 }}>
                                <View style={styles.workloadNameRow}>
                                  <Text style={[styles.workloadName, { color: textPrimary }]} numberOfLines={1}>
                                    {entry.name}
                                  </Text>
                                  <Text style={[styles.workloadCount, { color: textSecondary }]}>
                                    {entry.activeTasks} {entry.activeTasks === 1 ? "tarea activa" : "tareas activas"}
                                  </Text>
                                </View>
                                <View style={[styles.workloadTrack, { backgroundColor: border }]}>
                                  <View
                                    style={[
                                      styles.workloadFill,
                                      { width: `${pct}%`, backgroundColor: entry.overdueTasks > 0 ? "#EF4444" : primaryColor },
                                    ]}
                                  />
                                </View>
                              </View>
                              {entry.overdueTasks > 0 && (
                                <View style={styles.overdueBadge}>
                                  <AlertTriangle size={11} color="#EF4444" strokeWidth={2.4} />
                                  <Text style={styles.overdueBadgeText}>{entry.overdueTasks}</Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </>
              )}

              {/* MIS TAREAS PENDIENTES — asignadas a mí, a un equipo mío, o donde
                  soy colaborador (ver listTasksForUser en lib/tasks.ts).
                  Visible para cualquiera, incluido el owner si tiene tareas
                  propias — no es una vista exclusiva de "miembro normal". */}
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Mis tareas pendientes</Text>
              {myTasks === null ? (
                <View style={[styles.emptyCard, { backgroundColor: inputBg, borderColor: border }, ultraShadow]}>
                  <Text style={[styles.emptyTitle, { color: textPrimary }]}>Cargando…</Text>
                </View>
              ) : pendingMyTasks.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: inputBg, borderColor: border }, ultraShadow]}>
                  <CheckCircle2 size={30} color={textSecondary} strokeWidth={2} />
                  <Text style={[styles.emptyTitle, { color: textPrimary }]}>No tienes tareas pendientes</Text>
                  <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
                    Cuando te asignen una tarea, o a un equipo tuyo, aparecerá aquí.
                  </Text>
                </View>
              ) : (
                <View style={[styles.activityCard, { backgroundColor: inputBg, borderColor: border }, ultraShadow]}>
                  <View style={{ gap: 10 }}>
                    {pendingMyTasks.map((task, index) => {
                      const overdue = isOverdue(task);
                      const dueSoon = isDueSoon(task);
                      const dueColor = overdue ? "#EF4444" : dueSoon ? DUE_SOON_COLOR : textSecondary;
                      const isLast = index === pendingMyTasks.length - 1;
                      return (
                        <TouchableOpacity
                          key={task.id}
                          activeOpacity={0.8}
                          style={[styles.taskRow, { borderColor: isLast ? "transparent" : border }]}
                          onPress={() => navigation.navigate("Tasks")}
                        >
                          <View style={[styles.taskStatusDot, { backgroundColor: TASK_STATUS_COLORS[task.status] }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.taskRowTitle, { color: textPrimary }]} numberOfLines={1}>
                              {task.title}
                            </Text>
                            <Text style={[styles.taskRowMeta, { color: textSecondary }]} numberOfLines={1}>
                              {TASK_STATUS_LABELS[task.status]}
                              {task.assignee.type === "team" ? ` · ${task.assignee.name}` : ""}
                            </Text>
                          </View>
                          {task.dueDate && (
                            <Text style={[styles.taskRowDue, { color: dueColor }]}>
                              {overdue ? "Venció " : ""}
                              {formatShortDate(task.dueDate)}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate("Tasks")}>
                    <Text style={[styles.emptyLink, { color: primaryColor, marginTop: 14 }]}>Ver todas mis tareas</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* PROYECTOS + ACTIVIDAD */}
              <View style={[styles.sectionsRow, { flexDirection: isMobile ? "column" : "row" }]}>
                <View style={{ width: isMobile ? "100%" : "48%" }}>
                  <Text style={[styles.sectionTitle, { color: textPrimary }]}>Proyectos</Text>
                  {!projects || projects.length <= 1 ? (
                    <View style={[styles.emptyCard, { backgroundColor: inputBg, borderColor: border }, ultraShadow]}>
                      <Folder size={30} color={textSecondary} strokeWidth={2} />
                      <Text style={[styles.emptyTitle, { color: textPrimary }]}>
                        {projects === null
                          ? "Cargando…"
                          : projects.length === 0
                          ? "No tienes ningún proyecto"
                          : "1 proyecto en tu organización"}
                      </Text>
                      {projects !== null && (
                        <>
                          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate("Projects")}>
                            <Text style={[styles.emptyLink, { color: primaryColor }]}>Ver proyectos</Text>
                          </TouchableOpacity>
                          {projects.length === 0 && isOwner && (
                            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate("Semillero")}>
                              <Text style={[styles.emptyLink, { color: primaryColor }]}>¿Tienes alguna idea? Concrétala.</Text>
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                    </View>
                  ) : (
                    <>
                      <View style={styles.projectsMiniGrid}>
                        {projects.slice(0, 4).map((project) => (
                          <TouchableOpacity
                            key={project.id}
                            activeOpacity={0.85}
                            style={[styles.projectMiniCard, { backgroundColor: inputBg, borderColor: border }, ultraShadow]}
                            onPress={() => navigation.navigate("Projects")}
                          >
                            <View style={[styles.projectMiniIcon, { backgroundColor: project.color + "20" }]}>
                              {project.iconUrl ? (
                                <Image source={{ uri: project.iconUrl }} style={styles.projectMiniIconImage} />
                              ) : (
                                <Folder size={16} color={project.color} strokeWidth={2.2} />
                              )}
                            </View>
                            <Text style={[styles.projectMiniTitle, { color: textPrimary }]} numberOfLines={1}>
                              {project.name}
                            </Text>
                            <View style={[styles.projectMiniStatus, { backgroundColor: STATUS_COLORS[project.status] + "20" }]}>
                              <Text style={{ color: STATUS_COLORS[project.status], fontWeight: "700", fontSize: 10 }} numberOfLines={1}>
                                {STATUS_LABELS[project.status]}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate("Projects")}>
                        <Text style={[styles.emptyLink, { color: primaryColor, marginTop: 12 }]}>
                          {projects.length > 4 ? `Ver los ${projects.length} proyectos` : "Ver proyectos"}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                <View style={{ width: isMobile ? "100%" : "48%" }}>
                  <Text style={[styles.sectionTitle, { color: textPrimary }]}>Actividad reciente</Text>
                  {recentActivity.length === 0 ? (
                    <View style={[styles.emptyCard, { backgroundColor: inputBg, borderColor: border }, ultraShadow]}>
                      <Activity size={30} color={textSecondary} strokeWidth={2} />
                      <Text style={[styles.emptyTitle, { color: textPrimary }]}>Sin actividad todavía</Text>
                      <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
                        Aquí verás lo que pase en tu workspace en tiempo real.
                      </Text>
                      <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate("Activity")}>
                        <Text style={[styles.emptyLink, { color: primaryColor }]}>Ver actividad</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={[styles.activityCard, { backgroundColor: inputBg, borderColor: border }, ultraShadow]}>
                      <View style={{ gap: 10 }}>
                        {recentActivity.slice(0, 3).map((entry) => (
                          <ActivityRow
                            key={entry.id}
                            entry={entry}
                            isDark={isDark}
                            primaryColor={orgColor}
                            border={border}
                            textPrimary={textPrimary}
                            textSecondary={textSecondary}
                            cardBg={cardBg}
                            onPress={() => setDetailEntry(entry)}
                          />
                        ))}
                      </View>
                      <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate("Activity")}>
                        <Text style={[styles.emptyLink, { color: primaryColor, marginTop: 14 }]}>Ver toda la actividad</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      <ActivityDetailModal
        visible={!!detailEntry}
        entry={detailEntry}
        isDark={isDark}
        primaryColor={AZURE_DEEP}
        onClose={() => setDetailEntry(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 16, flexShrink: 1 },
  avatarWrap: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  avatar: { width: 64, height: 64, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  avatarImage: { width: 64, height: 64, borderRadius: 22 },
  greetingBig: { fontSize: 21, fontWeight: "600", letterSpacing: -0.4, maxWidth: 420 },
  orgChipRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  orgNameChip: { fontSize: 13, fontWeight: "600", maxWidth: 220 },
  rolePill: { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  rolePillText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  leaderPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  iconBtn: { width: 42, height: 42, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  sheet: { borderRadius: 36, borderWidth: 1, padding: 28, marginTop: 28 },

  searchWrapper: {
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 18,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 15 },
  noOutline: { outlineStyle: "none" } as any,

  heroCard: { borderRadius: 28, padding: 24, marginTop: 22 },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroSettingsBtn: {
    width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  heroLabel: { color: "rgba(255,255,255,0.85)", fontWeight: "700", fontSize: 12, letterSpacing: 1 },
  heroTitle: { color: "#FFF", fontSize: 25, fontWeight: "600", marginTop: 6, letterSpacing: -0.4 },
  heroCodeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20 },
  heroCode: { color: "#FFF", fontSize: 15, fontWeight: "700", letterSpacing: 2 },
  heroCopyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
  },
  heroCopyText: { color: "#FFF", fontWeight: "700", fontSize: 12 },

  semilleroCard: {
    flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 24, borderWidth: 1, padding: 18, marginTop: 22,
  },
  semilleroIcon: { width: 44, height: 44, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  semilleroTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  semilleroDesc: { fontSize: 12.5, lineHeight: 18 },

  tileRow: { gap: 16, marginTop: 22 },
  tile: { borderRadius: 24, borderWidth: 1, padding: 18 },
  tileIcon: { width: 36, height: 36, borderRadius: 14, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  tileTitle: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  tileStatus: { fontSize: 12, lineHeight: 16 },

  sectionsRow: { gap: 28, marginTop: 4 },

  card: { borderRadius: 24, borderWidth: 1, padding: 24 },
  projectsMiniGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  projectMiniCard: { width: "48%", borderRadius: 18, borderWidth: 1, padding: 14 },
  projectMiniIcon: { width: 30, height: 30, borderRadius: 11, justifyContent: "center", alignItems: "center", marginBottom: 10, overflow: "hidden" },
  projectMiniIconImage: { width: 30, height: 30 },
  projectMiniTitle: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  projectMiniStatus: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginTop: 28, marginBottom: 12, letterSpacing: -0.2 },
  emptyCard: { borderRadius: 24, borderWidth: 1, padding: 28, alignItems: "center", gap: 8 },
  activityCard: { borderRadius: 24, borderWidth: 1, padding: 18 },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, paddingBottom: 10 },
  taskStatusDot: { width: 8, height: 8, borderRadius: 4 },
  taskRowTitle: { fontSize: 13.5, fontWeight: "600" },
  taskRowMeta: { fontSize: 11.5, marginTop: 2 },
  taskRowDue: { fontSize: 11.5, fontWeight: "700" },
  emptyTitle: { fontSize: 15, fontWeight: "600", textAlign: "center" },
  emptySubtitle: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  emptyLink: { fontSize: 13, fontWeight: "700", textAlign: "center", marginTop: 2 },

  workloadRow: { flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, paddingBottom: 14 },
  workloadAvatar: { width: 32, height: 32, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  workloadAvatarText: { color: "#FFF", fontWeight: "700", fontSize: 12 },
  workloadNameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  workloadName: { fontSize: 13.5, fontWeight: "600", flexShrink: 1 },
  workloadCount: { fontSize: 11.5 },
  workloadTrack: { height: 6, borderRadius: 999, overflow: "hidden" },
  workloadFill: { height: 6, borderRadius: 999 },
  overdueBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(239,68,68,0.12)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  overdueBadgeText: { color: "#EF4444", fontSize: 11, fontWeight: "700" },
});
