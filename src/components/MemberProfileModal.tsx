import React, { useEffect, useState } from "react";
import { Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Clock, User, X } from "lucide-react-native";
import LevelDots from "./LevelDots";
import BadgePill from "./BadgePill";
import BadgeDetailModal from "./BadgeDetailModal";
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
import { ProfileBadge, getBadgeDefinition, listProfileBadges } from "../lib/badges";

const AZURE_DEEP = "#2C7BD1";

type Props = {
  visible: boolean;
  userId: string | null;
  organizationId?: string | null;
  fallbackName?: string;
  isDark: boolean;
  onClose: () => void;
  actionLabel?: string;
  onAction?: () => void;
  actionDanger?: boolean;
};

export default function MemberProfileModal({ visible, userId, organizationId, fallbackName, isDark, onClose, actionLabel, onAction, actionDanger }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [badges, setBadges] = useState<ProfileBadge[]>([]);
  const [detailBadge, setDetailBadge] = useState<ProfileBadge | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchErrorMsg, setFetchErrorMsg] = useState<string | null>(null);

  const cardBg        = isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.85)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";
  const primaryColor  = AZURE_DEEP;
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

  useEffect(() => {
    if (!visible || !userId) return;
    setLoading(true);
    setProfile(null);
    setBadges([]);
    setDetailBadge(null);
    setFetchErrorMsg(null);
    getProfile(userId).then(({ data, error }) => {
      setProfile(data);
      setFetchErrorMsg(error?.message ?? null);
      setLoading(false);
    });
    if (organizationId) {
      listProfileBadges(organizationId, userId).then(({ data }) => setBadges(data));
    }
  }, [visible, userId, organizationId]);

  const avatarColor = profile?.avatar_color ?? primaryColor;
  const previewTextColor = getContrastTextColor(avatarColor);
  const previewSubTextColor = previewTextColor === "#FFFFFF" ? "rgba(255,255,255,0.8)" : "rgba(15,23,42,0.65)";
  const avatarSource =
    profile && isUploadedAvatar(profile.avatar_url) ? { uri: profile.avatar_url! } : getDefaultAvatarSource(profile?.avatar_url ?? null);
  const roleLabel =
    profile?.role === CUSTOM_ROLE_VALUE ? profile.custom_role?.trim() || CUSTOM_ROLE_VALUE : profile?.role ?? null;
  const previewName = profile?.nickname?.trim() || fallbackName || "Este perfil";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.overlayScroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: textPrimary }]}>Perfil</Text>
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <X size={20} color={textSecondary} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <Text style={{ color: textSecondary }}>Cargando…</Text>
            ) : !profile ? (
              <>
                <Text style={{ color: textSecondary }}>No se pudo cargar este perfil.</Text>
                <Text style={{ color: textSecondary, fontSize: 11.5, marginTop: 8 }}>
                  {fetchErrorMsg
                    ? `Detalle: ${fetchErrorMsg}`
                    : "Puede que la política de permisos (RLS) de la tabla profiles todavía no esté aplicada en Supabase — revisa que hayas corrido el schema.sql completo más reciente."}
                </Text>
              </>
            ) : (
              <>
                <View style={[styles.previewRow, { backgroundColor: avatarColor }]}>
                  <View style={[styles.previewAvatar, { backgroundColor: "rgba(255,255,255,0.22)", borderColor: "rgba(255,255,255,0.5)" }]}>
                    {avatarSource ? <Image source={avatarSource} style={styles.previewAvatarImage} /> : <User size={24} color={previewTextColor} strokeWidth={2.2} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.previewName, { color: previewTextColor }]} numberOfLines={1}>
                      {previewName}
                    </Text>
                    <Text style={[styles.previewRoleText, { color: previewSubTextColor }]} numberOfLines={1}>
                      {roleLabel || "Sin rol asignado todavía"}
                    </Text>
                    {!!profile.bio && (
                      <Text style={[styles.previewBio, { color: previewSubTextColor }]} numberOfLines={2}>
                        {profile.bio}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={[styles.infoRow, { backgroundColor: inputBg, borderColor: border }]}>
                  <Clock size={14} color={textSecondary} strokeWidth={2.2} />
                  <Text style={[styles.infoText, { color: textSecondary }]} numberOfLines={1}>
                    {getTimezoneLabel(profile.timezone) ?? "Sin zona horaria configurada"}
                  </Text>
                </View>

                <Text style={[styles.sectionLabel, { color: textSecondary }]}>Habilidades</Text>
                {profile.skills?.length ? (
                  <View style={{ gap: 8, marginBottom: 20 }}>
                    {profile.skills.map((skill) => (
                      <View key={skill} style={[styles.readRow, { backgroundColor: inputBg, borderColor: border }]}>
                        <Text style={[styles.readRowName, { color: textPrimary }]} numberOfLines={1}>
                          {skill}
                        </Text>
                        <LevelDots value={profile.skill_levels?.[skill] ?? DEFAULT_SKILL_LEVEL} activeColor={primaryColor} trackColor={border} disabled />
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.emptyText, { color: textSecondary }]}>Aún no agregó habilidades.</Text>
                )}

                <Text style={[styles.sectionLabel, { color: textSecondary }]}>Idiomas</Text>
                {profile.languages?.length ? (
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
                  <Text style={[styles.emptyText, { color: textSecondary }]}>Aún no agregó idiomas.</Text>
                )}

                <Text style={[styles.sectionLabel, { color: textSecondary }]}>Badges</Text>
                {badges.length ? (
                  <View style={[styles.chipsRow, { marginBottom: 4 }]}>
                    {badges.map((badge) => {
                      const definition = getBadgeDefinition(badge.badgeKey);
                      if (!definition) return null;
                      return <BadgePill key={badge.id} badge={definition} size="sm" onPress={() => setDetailBadge(badge)} />;
                    })}
                  </View>
                ) : (
                  <Text style={[styles.emptyText, { color: textSecondary, marginBottom: 4 }]}>Todavía no tiene ningún badge.</Text>
                )}
              </>
            )}

            {actionLabel && onAction && (
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.actionBtn, { backgroundColor: actionDanger ? dangerColor : primaryColor }]}
                onPress={onAction}
              >
                <Text style={styles.actionBtnText}>{actionLabel}</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>

      <BadgeDetailModal visible={!!detailBadge} badge={detailBadge} isDark={isDark} onClose={() => setDetailBadge(null)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    ...Platform.select({ web: { backdropFilter: "blur(4px)" } as any, default: {} }),
  },
  overlayScroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", width: "100%" },
  card: { width: "100%", maxWidth: 420, borderRadius: 28, borderWidth: 1, padding: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  title: { fontSize: 17, fontWeight: "700" },

  previewRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, padding: 16, marginBottom: 16 },
  previewAvatar: { width: 56, height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center", overflow: "hidden", borderWidth: 2 },
  previewAvatarImage: { width: 64, height: 64, resizeMode: "cover" },
  previewName: { fontSize: 16, fontWeight: "700" },
  previewRoleText: { fontSize: 12.5, fontWeight: "600", marginTop: 2 },
  previewBio: { fontSize: 12.5, marginTop: 6, lineHeight: 17 },

  infoRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20 },
  infoText: { fontSize: 12.5, fontWeight: "600", flex: 1 },

  sectionLabel: { fontSize: 12, fontWeight: "700", marginBottom: 10 },
  emptyText: { fontSize: 12.5, lineHeight: 18, marginBottom: 20 },
  readRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  readRowName: { flexShrink: 1, flexGrow: 1, fontSize: 12.5, fontWeight: "700" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  langPill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 6, paddingLeft: 12 },
  langPillText: { fontSize: 12, fontWeight: "700" },
  langLevelBadge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  langLevelText: { color: "#FFF", fontSize: 9, fontWeight: "700" },

  actionBtn: { borderRadius: 999, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  actionBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});
