import React, { useCallback, useEffect, useState } from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { ArrowLeft, BadgeCheck, Clock, Folder, LogOut, Settings, User, Users } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import ProfileEditorForm from "../components/ProfileEditorForm";
import LevelDots from "../components/LevelDots";
import {
  CUSTOM_ROLE_VALUE,
  DEFAULT_LANGUAGE_LEVEL,
  DEFAULT_SKILL_LEVEL,
  Profile,
  getContrastTextColor,
  getDefaultAvatarSource,
  getProfile,
  getTimezoneLabel,
  isUploadedAvatar,
} from "../lib/profiles";

function SectionCard({
  icon,
  title,
  children,
  cardBg,
  border,
  textPrimary,
  ultraShadow,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  cardBg: string;
  border: string;
  textPrimary: string;
  ultraShadow: any;
}) {
  return (
    <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconWrap}>{icon}</View>
        <Text style={[styles.sectionTitle, { color: textPrimary }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function ProfileScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const { user, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = Platform.OS === "web";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await getProfile(user.id);
    setProfile(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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

  const handleSignOut = async () => {
    await signOut();
    navigation.getParent()?.reset({ index: 0, routes: [{ name: "Landing" }] });
  };

  if (loading || !user) {
    return (
      <View style={[styles.container, { backgroundColor: bg, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: textSecondary }}>Cargando…</Text>
      </View>
    );
  }

  const displayName: string = user.user_metadata?.full_name ?? "";

  if (editing) {
    return (
      <View style={[styles.container, { backgroundColor: bg }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: isMobile ? 16 : 32 }}>
          <View style={{ width: "100%", maxWidth: 760, alignSelf: "center" }}>
            <TouchableOpacity style={styles.backLink} onPress={() => setEditing(false)}>
              <ArrowLeft size={16} color={textSecondary} />
              <Text style={[styles.backLinkText, { color: textSecondary }]}>Volver a tu perfil</Text>
            </TouchableOpacity>

            <Text style={[styles.title, { color: textPrimary }]}>Editar perfil</Text>

            <ProfileEditorForm
              isDark={isDark}
              userId={user.id}
              displayName={displayName}
              submitLabel="Guardar cambios"
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                loadProfile();
              }}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  const previewName = profile?.nickname?.trim() || displayName || "Tu perfil";
  const avatarColor = profile?.avatar_color ?? primaryColor;
  const previewTextColor = getContrastTextColor(avatarColor);
  const previewSubTextColor = previewTextColor === "#FFFFFF" ? "rgba(255,255,255,0.8)" : "rgba(15,23,42,0.65)";
  const avatarSource =
    profile && isUploadedAvatar(profile.avatar_url) ? { uri: profile.avatar_url! } : getDefaultAvatarSource(profile?.avatar_url ?? null);
  const roleLabel =
    profile?.role === CUSTOM_ROLE_VALUE ? profile.custom_role?.trim() || CUSTOM_ROLE_VALUE : profile?.role ?? null;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: isMobile ? 16 : 32 }}>
        <View style={{ width: "100%", maxWidth: 760, alignSelf: "center" }}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: textPrimary }]}>Tu perfil</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.iconBtn, { backgroundColor: cardBg, borderColor: border }]}
              onPress={() => setEditing(true)}
            >
              <Settings size={18} color={textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.previewRow, { backgroundColor: avatarColor }, ultraShadow]}>
            <View style={[styles.previewAvatar, { backgroundColor: "rgba(255,255,255,0.22)", borderColor: "rgba(255,255,255,0.5)" }]}>
              {avatarSource ? <Image source={avatarSource} style={styles.previewAvatarImage} /> : <User size={28} color={previewTextColor} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.previewName, { color: previewTextColor }]} numberOfLines={1}>
                {previewName}
              </Text>
              <Text style={[styles.previewRoleText, { color: previewSubTextColor }]} numberOfLines={1}>
                {roleLabel || "Sin rol asignado todavía"}
              </Text>
              {!!profile?.bio && (
                <Text style={[styles.previewBio, { color: previewSubTextColor }]} numberOfLines={2}>
                  {profile.bio}
                </Text>
              )}
            </View>
          </View>

          <View style={[styles.infoRow, { backgroundColor: inputBg, borderColor: border }]}>
            <Clock size={16} color={textSecondary} />
            <Text style={[styles.infoText, { color: textSecondary }]} numberOfLines={1}>
              {getTimezoneLabel(profile?.timezone ?? null) ?? "Sin zona horaria configurada"}
            </Text>
          </View>

          <SectionCard
            icon={<BadgeCheck size={18} color={primaryColor} />}
            title="Habilidades"
            cardBg={cardBg}
            border={border}
            textPrimary={textPrimary}
            ultraShadow={ultraShadow}
          >
            {profile?.skills?.length ? (
              <View style={{ gap: 8 }}>
                {profile.skills.map((skill) => (
                  <View key={skill} style={[styles.readRow, { backgroundColor: inputBg, borderColor: border }]}>
                    <Text style={[styles.readRowName, { color: textPrimary }]} numberOfLines={1}>
                      {skill}
                    </Text>
                    <LevelDots
                      value={profile.skill_levels?.[skill] ?? DEFAULT_SKILL_LEVEL}
                      activeColor={primaryColor}
                      trackColor={border}
                      disabled
                    />
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: textSecondary }]}>Aún no agregaste habilidades.</Text>
            )}
          </SectionCard>

          <SectionCard
            icon={<Users size={18} color={primaryColor} />}
            title="Idiomas"
            cardBg={cardBg}
            border={border}
            textPrimary={textPrimary}
            ultraShadow={ultraShadow}
          >
            {profile?.languages?.length ? (
              <View style={styles.chipsRow}>
                {profile.languages.map((lang) => (
                  <View key={lang} style={[styles.langPill, { backgroundColor: inputBg, borderColor: border }]}>
                    <Text style={[styles.langPillText, { color: textPrimary }]}>{lang}</Text>
                    <View style={[styles.langLevelBadge, { backgroundColor: primaryColor }]}>
                      <Text style={styles.langLevelText}>{profile.language_levels?.[lang] ?? DEFAULT_LANGUAGE_LEVEL}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: textSecondary }]}>Aún no agregaste idiomas.</Text>
            )}
          </SectionCard>

          <SectionCard
            icon={<BadgeCheck size={18} color={primaryColor} />}
            title="Badges"
            cardBg={cardBg}
            border={border}
            textPrimary={textPrimary}
            ultraShadow={ultraShadow}
          >
            {profile?.badges?.length ? (
              <View style={styles.chipsRow}>
                {profile.badges.map((badge) => (
                  <View key={badge.id} style={[styles.badgePill, { backgroundColor: badge.color }]}>
                    <Text style={[styles.badgePillText, { color: getContrastTextColor(badge.color) }]}>{badge.name}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: textSecondary }]}>
                Aún no tienes badges. Cuando definamos quién puede otorgarlos, los vas a ver aquí.
              </Text>
            )}
          </SectionCard>

          <SectionCard
            icon={<Users size={18} color={primaryColor} />}
            title="Equipos"
            cardBg={cardBg}
            border={border}
            textPrimary={textPrimary}
            ultraShadow={ultraShadow}
          >
            <Text style={[styles.emptyText, { color: textSecondary }]}>
              Aún no perteneces a ningún equipo. Esto se conecta cuando construyamos Equipos en Nexus.
            </Text>
          </SectionCard>

          <SectionCard
            icon={<Folder size={18} color={primaryColor} />}
            title="Proyectos"
            cardBg={cardBg}
            border={border}
            textPrimary={textPrimary}
            ultraShadow={ultraShadow}
          >
            <Text style={[styles.emptyText, { color: textSecondary }]}>
              Aún no estás en ningún proyecto. Esto se conecta cuando construyamos Proyectos en Nexus.
            </Text>
          </SectionCard>

          <TouchableOpacity activeOpacity={0.8} style={styles.signOutRow} onPress={handleSignOut}>
            <LogOut size={16} color="#EF4444" />
            <Text style={styles.signOutText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  title: { fontSize: 26, fontWeight: "900", letterSpacing: -0.7 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  backLink: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 },
  backLinkText: { fontSize: 14, fontWeight: "600" },
  previewRow: {
    flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 20, padding: 20, marginBottom: 20,
  },
  previewAvatar: {
    width: 68, height: 68, borderRadius: 18, justifyContent: "center", alignItems: "center", overflow: "hidden", borderWidth: 2,
  },
  previewAvatarImage: { width: 78, height: 78, resizeMode: "cover" },
  previewName: { fontSize: 19, fontWeight: "800" },
  previewRoleText: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  previewBio: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  infoRow: {
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 20,
  },
  infoText: { fontSize: 13, fontWeight: "600", flex: 1 },
  sectionCard: { borderRadius: 20, borderWidth: 1, padding: 20, marginBottom: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  sectionIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  emptyText: { fontSize: 13, lineHeight: 19 },
  readRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12,
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
  },
  readRowName: { flexShrink: 1, flexGrow: 1, fontSize: 13, fontWeight: "700" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  langPill: {
    flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 999,
    paddingVertical: 8, paddingHorizontal: 8, paddingLeft: 14,
  },
  langPillText: { fontSize: 13, fontWeight: "700" },
  langLevelBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  langLevelText: { color: "#FFF", fontSize: 10, fontWeight: "800" },
  badgePill: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  badgePillText: { fontSize: 13, fontWeight: "700" },
  signOutRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 20,
  },
  signOutText: { color: "#EF4444", fontSize: 14, fontWeight: "700" },
});
