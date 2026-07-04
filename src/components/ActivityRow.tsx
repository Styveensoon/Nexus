import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  BadgeCheck,
  BadgeX,
  ChevronRight,
  FolderMinus,
  FolderPlus,
  ListPlus,
  ListX,
  MessageCircle,
  RefreshCcw,
  SquareCheck,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react-native";

import { ActivityAction, ActivityEntry, describeActivity } from "../lib/activity";

// Mismo patrón que BADGE_ICONS en BadgePill.tsx: el mapeo de string -> ícono
// de lucide vive en el componente que lo renderiza, no en la capa de datos.
const ACTIVITY_ICONS: Record<ActivityAction, any> = {
  project_created: FolderPlus,
  project_status_changed: RefreshCcw,
  project_deleted: FolderMinus,
  team_created: Users,
  team_deleted: UserMinus,
  task_created: ListPlus,
  task_status_changed: SquareCheck,
  task_deleted: ListX,
  task_comment_created: MessageCircle,
  badge_granted: BadgeCheck,
  badge_revoked: BadgeX,
  member_joined: UserPlus,
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

export default function ActivityRow({
  entry,
  isDark,
  primaryColor,
  border,
  textPrimary,
  textSecondary,
  cardBg,
  onPress,
}: {
  entry: ActivityEntry;
  isDark: boolean;
  primaryColor: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
  onPress?: () => void;
}) {
  const Icon = ACTIVITY_ICONS[entry.action] ?? Users;

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.8 : 1}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.row, { borderColor: border, backgroundColor: cardBg }]}
    >
      <View style={[styles.iconWrap, { backgroundColor: isDark ? "rgba(126,200,245,0.14)" : "rgba(44,123,209,0.08)" }]}>
        <Icon size={16} color={primaryColor} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: textPrimary, fontSize: 13, lineHeight: 18 }}>
          <Text style={{ fontWeight: "700" }}>{entry.actorName}</Text> {describeActivity(entry)}
        </Text>
        <Text style={{ color: textSecondary, fontSize: 11.5, marginTop: 4 }}>{formatDateTime(entry.createdAt)}</Text>
      </View>
      {onPress && <ChevronRight size={16} color={textSecondary} strokeWidth={2.2} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, borderWidth: 1, borderRadius: 16, padding: 12, alignItems: "flex-start" },
  iconWrap: { width: 32, height: 32, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
