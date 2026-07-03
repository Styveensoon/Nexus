import React, { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { X } from "lucide-react-native";
import { BADGE_CATALOG, BadgeDefinition, ProfileBadge } from "../lib/badges";
import { OrganizationMemberProfile } from "../lib/organizations";
import { getContrastTextColor } from "../lib/profiles";
import { BADGE_ICONS } from "./BadgePill";
import BadgeDetailModal from "./BadgeDetailModal";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

type Props = {
  visible: boolean;
  member: OrganizationMemberProfile | null;
  isDark: boolean;
  grantedBadges: ProfileBadge[];
  canManage: boolean;
  busyKey: string | null;
  errorText: string | null;
  onClose: () => void;
  onGrant: (badgeKey: string) => void;
  onRevoke: (badgeKey: string) => void;
};

export default function BadgeAwardModal({
  visible,
  member,
  isDark,
  grantedBadges,
  canManage,
  busyKey,
  errorText,
  onClose,
  onGrant,
  onRevoke,
}: Props) {
  const cardBg        = isDark ? "#0F172A" : "#FFFFFF";
  const border        = isDark ? "rgba(51, 65, 85, 0.6)" : "rgba(226, 232, 240, 0.9)";
  const textPrimary   = isDark ? "#F8FAFC" : "#020617";
  const textSecondary = isDark ? "#94A3B8" : "#475569";
  const inputBg       = isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC";
  const primaryColor  = "#2563EB";
  const dangerColor   = "#EF4444";

  // Se resetean al cambiar de persona (el modal no se desmonta entre
  // aperturas, BadgesScreen solo cambia `member` — sin esto, un "¿Quitar?"
  // sin confirmar o un detalle abierto sobrevivirían al abrir a otra persona).
  const [confirmRevokeKey, setConfirmRevokeKey] = useState<string | null>(null);
  const [detailKey, setDetailKey] = useState<string | null>(null);

  useEffect(() => {
    setConfirmRevokeKey(null);
    setDetailKey(null);
  }, [member?.userId]);

  if (!member) return null;

  const grantedByKey = new Map(grantedBadges.map((b) => [b.badgeKey, b]));
  const grantedDefinitions = BADGE_CATALOG.filter((b) => grantedByKey.has(b.key));
  const availableBadges = BADGE_CATALOG.filter((b) => !grantedByKey.has(b.key));

  const renderIcon = (badge: BadgeDefinition, color: string, size = 16) => {
    const Icon = BADGE_ICONS[badge.icon] ?? BADGE_ICONS.Users;
    return <Icon size={size} color={color} />;
  };

  const detailBadge = detailKey ? grantedByKey.get(detailKey) ?? null : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.overlayScroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: textPrimary }]}>Badges</Text>
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <X size={20} color={textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.memberRow, { backgroundColor: inputBg, borderColor: border }]}>
              <View style={[styles.avatar, { backgroundColor: member.avatarColor }]}>
                <Text style={styles.avatarText}>{initials(member.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.memberName, { color: textPrimary }]} numberOfLines={1}>
                  {member.name}
                </Text>
                {!!(member.customRole || member.role) && (
                  <Text style={[styles.memberRole, { color: textSecondary }]} numberOfLines={1}>
                    {member.customRole || member.role}
                  </Text>
                )}
              </View>
            </View>

            {!canManage && (
              <Text style={[styles.noticeText, { color: textSecondary }]}>
                Solo el owner de la organización o el encargado del equipo de esta persona puede otorgarle/quitarle badges.
              </Text>
            )}

            {errorText && <Text style={[styles.errorText, { color: dangerColor }]}>{errorText}</Text>}

            <Text style={[styles.sectionLabel, { color: textSecondary }]}>Badges otorgados · toca uno para ver quién y cuándo</Text>
            {grantedDefinitions.length ? (
              <View style={styles.chipsRow}>
                {grantedDefinitions.map((badge) => {
                  const isBusy = busyKey === badge.key;
                  const textColor = getContrastTextColor(badge.color);

                  if (confirmRevokeKey === badge.key) {
                    return (
                      <View key={badge.key} style={[styles.confirmPill, { borderColor: dangerColor, backgroundColor: inputBg }]}>
                        <Text style={[styles.confirmPillText, { color: textPrimary }]} numberOfLines={1}>
                          ¿Quitar "{badge.label}"?
                        </Text>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          disabled={isBusy}
                          onPress={() => {
                            onRevoke(badge.key);
                            setConfirmRevokeKey(null);
                          }}
                          style={[styles.confirmPillBtn, { backgroundColor: dangerColor, opacity: isBusy ? 0.6 : 1 }]}
                        >
                          <Text style={styles.confirmPillBtnText}>Quitar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity hitSlop={6} onPress={() => setConfirmRevokeKey(null)}>
                          <X size={14} color={textSecondary} />
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  return (
                    <View key={badge.key} style={[styles.grantedPill, { backgroundColor: badge.color }]}>
                      <TouchableOpacity activeOpacity={0.8} style={styles.grantedPillMain} onPress={() => setDetailKey(badge.key)}>
                        {renderIcon(badge, textColor, 13)}
                        <Text style={[styles.grantedPillText, { color: textColor }]}>{badge.label}</Text>
                      </TouchableOpacity>
                      {canManage && (
                        <TouchableOpacity hitSlop={6} disabled={isBusy} onPress={() => setConfirmRevokeKey(badge.key)}>
                          <X size={13} color={textColor} style={{ opacity: isBusy ? 0.4 : 1 }} />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: textSecondary }]}>Todavía no tiene ningún badge.</Text>
            )}

            <Text style={[styles.sectionLabel, { color: textSecondary, marginTop: 20 }]}>Badges disponibles</Text>
            <View style={{ gap: 8 }}>
              {availableBadges.map((badge) => {
                const isBusy = busyKey === badge.key;
                return (
                  <TouchableOpacity
                    key={badge.key}
                    activeOpacity={canManage ? 0.8 : 1}
                    disabled={!canManage || isBusy}
                    onPress={() => onGrant(badge.key)}
                    style={[
                      styles.availableRow,
                      { backgroundColor: inputBg, borderColor: border, opacity: !canManage ? 0.55 : isBusy ? 0.6 : 1 },
                    ]}
                  >
                    <View style={[styles.availableIcon, { backgroundColor: badge.color }]}>{renderIcon(badge, "#FFFFFF")}</View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.availableLabel, { color: textPrimary }]}>{badge.label}</Text>
                      <Text style={[styles.availableDesc, { color: textSecondary }]} numberOfLines={2}>
                        {badge.description}
                      </Text>
                    </View>
                    {canManage && <Text style={[styles.grantLink, { color: primaryColor }]}>{isBusy ? "…" : "Otorgar"}</Text>}
                  </TouchableOpacity>
                );
              })}
              {availableBadges.length === 0 && (
                <Text style={[styles.emptyText, { color: textSecondary }]}>Ya tiene todos los badges del catálogo.</Text>
              )}
            </View>
          </View>
        </ScrollView>
      </View>

      <BadgeDetailModal visible={!!detailKey} badge={detailBadge} isDark={isDark} onClose={() => setDetailKey(null)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(2, 6, 23, 0.6)", alignItems: "center", justifyContent: "center", padding: 20 },
  overlayScroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", width: "100%" },
  card: { width: "100%", maxWidth: 440, borderRadius: 24, borderWidth: 1, padding: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  title: { fontSize: 18, fontWeight: "800" },

  memberRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 16 },
  avatar: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFF", fontWeight: "800", fontSize: 14 },
  memberName: { fontSize: 14.5, fontWeight: "800" },
  memberRole: { fontSize: 12, fontWeight: "600", marginTop: 2 },

  noticeText: { fontSize: 12, lineHeight: 17, marginBottom: 16 },
  errorText: { fontSize: 12, fontWeight: "600", lineHeight: 17, marginBottom: 16 },

  sectionLabel: { fontSize: 12, fontWeight: "700", marginBottom: 10 },
  emptyText: { fontSize: 12.5, lineHeight: 18 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  grantedPill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  grantedPillMain: { flexDirection: "row", alignItems: "center", gap: 6 },
  grantedPillText: { fontSize: 12, fontWeight: "700" },

  confirmPill: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, borderWidth: 1.5, paddingVertical: 6, paddingHorizontal: 10, maxWidth: 260 },
  confirmPillText: { fontSize: 11.5, fontWeight: "700", flexShrink: 1 },
  confirmPillBtn: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  confirmPillBtnText: { color: "#FFF", fontSize: 11, fontWeight: "800" },

  availableRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  availableIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  availableLabel: { fontSize: 13, fontWeight: "700" },
  availableDesc: { fontSize: 11.5, lineHeight: 15, marginTop: 2 },
  grantLink: { fontSize: 12.5, fontWeight: "700" },
});
