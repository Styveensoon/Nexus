import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import {
  GitBranch,
  MessageSquare,
  HardDrive,
  Calendar,
  Kanban,
  Users,
  Video,
  Bug,
} from "lucide-react-native";

interface IntegrationsSectionProps {
  isDark: boolean;
  isMobile: boolean;
}

const AZURE_DEEP = "#2C7BD1";

// Todavía no hay ninguna integración construida (ver docs/ESTADO.md) — esta sección es
// roadmap/aspiracional, por eso cada tarjeta lleva la etiqueta "Próximamente" en vez de
// dar a entender que ya funciona.
const INTEGRATIONS = [
  { icon: GitBranch,     name: "GitHub" },
  { icon: MessageSquare, name: "Slack" },
  { icon: HardDrive,     name: "Google Drive" },
  { icon: Calendar,      name: "Google Calendar" },
  { icon: Kanban,        name: "Trello" },
  { icon: Users,         name: "Discord" },
  { icon: Video,         name: "Microsoft Teams" },
  { icon: Bug,           name: "Jira" },
];

export default function IntegrationsSection({ isDark, isMobile }: IntegrationsSectionProps) {
  const cardBg        = isDark ? "rgba(17, 24, 39, 0.62)" : "rgba(255, 255, 255, 0.72)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const iconBg        = isDark ? "rgba(44,123,209,0.16)" : "#EAF4FC";
  const tagBg         = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.045)";

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

  return (
    <View style={[styles.wrap, { paddingHorizontal: isMobile ? 16 : "5%", paddingVertical: isMobile ? 48 : 120 }]}>
      <View style={[styles.container, { maxWidth: 1280 }]}>
        <Text style={[styles.title, { color: textPrimary, fontSize: isMobile ? 28 : 44, marginBottom: isMobile ? 16 : 20 }]}>
          Se conecta con tu flujo de trabajo
        </Text>
        <Text style={[styles.sub, { color: textSecondary, fontSize: isMobile ? 15 : 20, marginBottom: isMobile ? 32 : 56 }]}>
          Estamos construyendo integraciones nativas con las herramientas que tu equipo ya usa todos los días.
        </Text>

        <View style={styles.grid}>
          {INTEGRATIONS.map((it) => (
            <View
              key={it.name}
              style={[
                styles.card,
                { width: isMobile ? "47%" : 190, backgroundColor: cardBg, borderColor: border, borderWidth: 1 },
                ultraShadow,
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
                <it.icon size={22} color={AZURE_DEEP} strokeWidth={2.2} />
              </View>
              <Text style={[styles.cardName, { color: textPrimary }]}>{it.name}</Text>
              <View style={[styles.tag, { backgroundColor: tagBg }]}>
                <Text style={[styles.tagText, { color: textSecondary }]}>Próximamente</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", alignItems: "center" },
  container: { width: "100%", alignSelf: "center" },
  title: { fontWeight: "700", textAlign: "center", letterSpacing: -1 },
  sub: { textAlign: "center", lineHeight: 30, maxWidth: 760, alignSelf: "center", fontWeight: "400" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 16, justifyContent: "center" },
  card: {
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
  },
  iconWrap: { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center", marginBottom: 14 },
  cardName: { fontSize: 15, fontWeight: "600", marginBottom: 10, textAlign: "center" },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  tagText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
});
