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
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import {
  Activity,
  BadgeCheck,
  Building2,
  ChevronRight,
  Copy,
  Folder,
  LogOut,
  Search,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react-native";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { countTeams } from "../lib/teams";
import { countProjects } from "../lib/projects";
import { countOrgBadges } from "../lib/badges";
import { listActivity, ActivityEntry } from "../lib/activity";
import ActivityRow from "../components/ActivityRow";

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

function darkenHex(hex: string, amount = 0.25) {
  const clean = hex.replace("#", "");
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return "#1D4ED8";
  const num = parseInt(clean, 16);
  const r = Math.round(((num >> 16) & 0xff) * (1 - amount));
  const g = Math.round(((num >> 8) & 0xff) * (1 - amount));
  const b = Math.round((num & 0xff) * (1 - amount));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

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
  const [teamCount, setTeamCount] = useState<number | null>(null);
  const [projectCount, setProjectCount] = useState<number | null>(null);
  const [badgeCount, setBadgeCount] = useState<number | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>([]);

  // useFocusEffect (no useEffect) para que los conteos se refresquen cada vez
  // que se vuelve a esta pestaña (p. ej. después de crear un proyecto en otra
  // pestaña) — con useEffect solo se cargaban una vez al montar el tab.
  useFocusEffect(
    useCallback(() => {
      if (!organization) return;
      countTeams(organization.id).then(({ count }) => setTeamCount(count));
      countProjects(organization.id).then(({ count }) => setProjectCount(count));
      countOrgBadges(organization.id).then(({ count }) => setBadgeCount(count));
      listActivity({ organizationId: organization.id, limit: 5 }).then(({ data }) => setRecentActivity(data));
    }, [organization])
  );

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
                <View style={[styles.avatarGlow, { backgroundColor: mixHex(orgColor, isDark ? "#0B1220" : "#F1F5FA", 0.4) }]} />
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
                        {organization.owner_id === user?.id ? "OWNER" : "MIEMBRO"}
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

              {/* HERO */}
              <LinearGradient
                colors={[organization.color, darkenHex(organization.color)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.heroCard, { overflow: "hidden" }]}
              >
                <LinearGradient
                  colors={["rgba(255,255,255,0.32)", "rgba(255,255,255,0)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.65, y: 0.9 }}
                  style={StyleSheet.absoluteFillObject}
                  pointerEvents="none"
                />
                <Text style={styles.heroLabel}>TU WORKSPACE</Text>
                <Text style={styles.heroTitle} numberOfLines={1}>{organization.name}</Text>

                <View style={styles.heroCodeRow}>
                  <Text style={styles.heroCode}>{organization.invite_code}</Text>
                  <TouchableOpacity activeOpacity={0.85} style={styles.heroCopyBtn} onPress={handleCopyCode}>
                    <Copy size={14} color="#FFF" />
                    <Text style={styles.heroCopyText}>{copied ? "¡Copiado!" : "Copiar código"}</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              {/* EL SEMILLERO (solo el owner puede usarlo) */}
              {organization.owner_id === user?.id && (
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

                <View style={[styles.tile, { backgroundColor: inputBg, borderColor: border, width: isMobile ? "100%" : "32%" }, ultraShadow]}>
                  <View style={[styles.tileIcon, { backgroundColor: isDark ? "rgba(126,200,245,0.14)" : "rgba(44,123,209,0.08)" }]}>
                    <UserCheck size={18} color={primaryColor} strokeWidth={2.3} />
                  </View>
                  <Text style={[styles.tileTitle, { color: textPrimary }]}>Clientes</Text>
                  <Text style={[styles.tileStatus, { color: textSecondary }]}>Aún no tienes clientes agregados</Text>
                </View>
              </View>

              {/* PROYECTOS + ACTIVIDAD */}
              <View style={[styles.sectionsRow, { flexDirection: isMobile ? "column" : "row" }]}>
                <View style={{ width: isMobile ? "100%" : "48%" }}>
                  <Text style={[styles.sectionTitle, { color: textPrimary }]}>Proyectos</Text>
                  <View style={[styles.emptyCard, { backgroundColor: inputBg, borderColor: border }, ultraShadow]}>
                    <Folder size={30} color={textSecondary} strokeWidth={2} />
                    <Text style={[styles.emptyTitle, { color: textPrimary }]}>
                      {!projectCount
                        ? "No tienes ningún proyecto"
                        : `${projectCount} ${projectCount === 1 ? "proyecto" : "proyectos"} en tu organización`}
                    </Text>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate("Projects")}>
                      <Text style={[styles.emptyLink, { color: primaryColor }]}>Ver proyectos</Text>
                    </TouchableOpacity>
                    {!projectCount && organization.owner_id === user?.id && (
                      <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate("Semillero")}>
                        <Text style={[styles.emptyLink, { color: primaryColor }]}>¿Tienes alguna idea? Concrétala.</Text>
                      </TouchableOpacity>
                    )}
                  </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 16, flexShrink: 1 },
  avatarWrap: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  avatarGlow: { position: "absolute", width: 88, height: 88, borderRadius: 30 },
  avatar: { width: 64, height: 64, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  avatarImage: { width: 64, height: 64, borderRadius: 22 },
  greetingBig: { fontSize: 21, fontWeight: "600", letterSpacing: -0.4, maxWidth: 420 },
  orgChipRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  orgNameChip: { fontSize: 13, fontWeight: "600", maxWidth: 220 },
  rolePill: { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  rolePillText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  iconBtn: { width: 42, height: 42, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  sheet: { borderRadius: 36, borderWidth: 1, padding: 28, marginTop: 28 },

  searchWrapper: {
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 18,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 15 },
  noOutline: { outlineStyle: "none" } as any,

  heroCard: { borderRadius: 28, padding: 24, marginTop: 22 },
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
  sectionTitle: { fontSize: 18, fontWeight: "600", marginTop: 28, marginBottom: 12, letterSpacing: -0.2 },
  emptyCard: { borderRadius: 24, borderWidth: 1, padding: 28, alignItems: "center", gap: 8 },
  activityCard: { borderRadius: 24, borderWidth: 1, padding: 18 },
  emptyTitle: { fontSize: 15, fontWeight: "600", textAlign: "center" },
  emptySubtitle: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  emptyLink: { fontSize: 13, fontWeight: "700", textAlign: "center", marginTop: 2 },
});
