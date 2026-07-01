import React, { useState } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { Building2, Copy, Folder, LogOut, Search, Sparkles } from "lucide-react-native";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

function darkenHex(hex: string, amount = 0.25) {
  const clean = hex.replace("#", "");
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return "#1D4ED8";
  const num = parseInt(clean, 16);
  const r = Math.round(((num >> 16) & 0xff) * (1 - amount));
  const g = Math.round(((num >> 8) & 0xff) * (1 - amount));
  const b = Math.round((num & 0xff) * (1 - amount));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export default function DashboardScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const { user, organization, loading, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = Platform.OS === "web";

  const [copied, setCopied] = useState(false);

  const bg            = isDark ? "#020617" : "#FAFAFA";
  const cardBg        = isDark ? "rgba(15, 23, 42, 0.8)" : "rgba(255, 255, 255, 0.9)";
  const border        = isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(226, 232, 240, 0.8)";
  const textPrimary   = isDark ? "#F8FAFC" : "#020617";
  const textSecondary = isDark ? "#94A3B8" : "#475569";
  const primaryColor  = "#2563EB";
  const inputBg       = isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC";

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

  const firstName =
    (user?.user_metadata as any)?.full_name?.trim?.().split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "ahí";

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
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: isMobile ? 16 : 32 }}>
        <View style={{ width: "100%", maxWidth: 960, alignSelf: "center" }}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.avatar, { backgroundColor: organization?.color ?? primaryColor }]}>
                {organization?.logo_url ? (
                  <Image source={{ uri: organization.logo_url }} style={styles.avatarImage} />
                ) : (
                  <Building2 size={22} color="#FFF" />
                )}
              </View>
              <View>
                <Text style={[styles.greeting, { color: textSecondary }]}>Hola, {firstName} 👋</Text>
                <Text style={[styles.orgName, { color: textPrimary }]} numberOfLines={1}>
                  {organization?.name ?? "Nexus"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.iconBtn, { backgroundColor: cardBg, borderColor: border }]}
              onPress={handleSignOut}
            >
              <LogOut size={18} color={textSecondary} />
            </TouchableOpacity>
          </View>

          {!organization ? (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: border, marginTop: 24 }, ultraShadow]}>
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>Tu cuenta no tiene un workspace todavía</Text>
              <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
                Cierra sesión y vuelve a entrar para retomar la creación o unión a una organización.
              </Text>
            </View>
          ) : (
            <>
              {/* SEARCH */}
              <View style={[styles.searchWrapper, { backgroundColor: inputBg, borderColor: border }]}>
                <Search size={18} color={textSecondary} />
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
                style={styles.heroCard}
              >
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

              {/* STATS */}
              <View style={[styles.statsRow, { flexDirection: isMobile ? "column" : "row" }]}>
                <View style={[styles.statCard, { backgroundColor: cardBg, borderColor: border, width: isMobile ? "100%" : "48%" }, ultraShadow]}>
                  <View style={[styles.statIcon, { backgroundColor: isDark ? "rgba(37,99,235,0.15)" : "#EFF6FF" }]}>
                    <Building2 size={18} color={primaryColor} />
                  </View>
                  <Text style={[styles.statValue, { color: textPrimary }]}>
                    {organization.owner_id === user?.id ? "Owner" : "Miembro"}
                  </Text>
                  <Text style={[styles.statLabel, { color: textSecondary }]}>Tu rol</Text>
                </View>

                {/* Cuando se habilite el conteo real de miembros (política RLS opcional
                    en supabase/schema.sql), agregar aquí una tercera tarjeta "Miembros". */}
                <View style={[styles.statCard, { backgroundColor: cardBg, borderColor: border, width: isMobile ? "100%" : "48%" }, ultraShadow]}>
                  <View style={[styles.statIcon, { backgroundColor: isDark ? "rgba(37,99,235,0.15)" : "#EFF6FF" }]}>
                    <Sparkles size={18} color={primaryColor} />
                  </View>
                  <Text style={[styles.statValue, { color: textPrimary }]} numberOfLines={1}>
                    {organization.invite_code}
                  </Text>
                  <Text style={[styles.statLabel, { color: textSecondary }]}>Código de invitación</Text>
                </View>
              </View>

              {/* PROYECTOS */}
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Proyectos</Text>
              <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
                <Folder size={32} color={textSecondary} />
                <Text style={[styles.emptyTitle, { color: textPrimary }]}>Aún no tienes proyectos</Text>
                <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
                  Cuando actives el módulo de proyectos, los verás aquí.
                </Text>
              </View>

              {/* ACTIVIDAD */}
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Actividad reciente</Text>
              <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
                <Sparkles size={32} color={textSecondary} />
                <Text style={[styles.emptyTitle, { color: textPrimary }]}>Sin actividad todavía</Text>
                <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
                  Aquí verás lo que pase en tu workspace en tiempo real.
                </Text>
              </View>
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  avatar: { width: 50, height: 50, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  avatarImage: { width: 50, height: 50, borderRadius: 16 },
  greeting: { fontSize: 13, fontWeight: "600" },
  orgName: { fontSize: 20, fontWeight: "900", letterSpacing: -0.5, maxWidth: 240 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  searchWrapper: {
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 16, marginTop: 24,
  },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 15 },
  noOutline: { outlineStyle: "none" } as any,

  heroCard: { borderRadius: 24, padding: 24, marginTop: 20 },
  heroLabel: { color: "rgba(255,255,255,0.8)", fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  heroTitle: { color: "#FFF", fontSize: 26, fontWeight: "900", marginTop: 6, letterSpacing: -0.5 },
  heroCodeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20 },
  heroCode: { color: "#FFF", fontSize: 15, fontWeight: "700", letterSpacing: 2 },
  heroCopyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
  },
  heroCopyText: { color: "#FFF", fontWeight: "700", fontSize: 12 },

  statsRow: { gap: 16, marginTop: 20, justifyContent: "space-between" },
  statCard: { borderRadius: 20, borderWidth: 1, padding: 18 },
  statIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  statValue: { fontSize: 18, fontWeight: "900" },
  statLabel: { fontSize: 13, marginTop: 4 },

  card: { borderRadius: 20, borderWidth: 1, padding: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginTop: 28, marginBottom: 12, letterSpacing: -0.3 },
  emptyCard: { borderRadius: 20, borderWidth: 1, padding: 28, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  emptySubtitle: { fontSize: 13, textAlign: "center", lineHeight: 20 },
});
