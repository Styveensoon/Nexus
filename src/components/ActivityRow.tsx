import React from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  BadgeCheck,
  BadgeX,
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
}: {
  entry: ActivityEntry;
  isDark: boolean;
  primaryColor: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
}) {
  const Icon = ACTIVITY_ICONS[entry.action] ?? Users;

  return (
    <View style={[styles.row, { borderColor: border, backgroundColor: cardBg }]}>
      <View style={[styles.iconWrap, { backgroundColor: isDark ? "rgba(37,99,235,0.15)" : "#EFF6FF" }]}>
        <Icon size={16} color={primaryColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: textPrimary, fontSize: 13, lineHeight: 18 }}>
          <Text style={{ fontWeight: "800" }}>{entry.actorName}</Text> {describeActivity(entry)}
        </Text>
        <Text style={{ color: textSecondary, fontSize: 11.5, marginTop: 4 }}>{formatDateTime(entry.createdAt)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, borderWidth: 1, borderRadius: 14, padding: 12, alignItems: "flex-start" },
  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
