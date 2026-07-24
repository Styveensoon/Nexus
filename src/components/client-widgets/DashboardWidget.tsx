import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { ClientHomeSection } from "../../lib/clientHome";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Resumen ejecutivo generado por IA (docs/CLIENTE.md §6) — el cliente solo
// VE el resultado, generar/regenerar es una acción exclusiva del staff
// (ClientHomeBuilderScreen). Sin contenido generado todavía: estado vacío
// honesto, nunca un spinner falso (filosofía anti-fake, docs/PATRONES.md).
type Props = {
  isDark: boolean;
  section: ClientHomeSection;
};

export default function DashboardWidget({ isDark, section }: Props) {
  const cardBg        = isDark ? "rgba(17, 24, 39, 0.6)" : "rgba(255, 255, 255, 0.6)";
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = "#2C7BD1";

  const content = section.generatedContent;

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

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
      <View style={styles.header}>
        <Sparkles size={16} color={primaryColor} strokeWidth={2.2} />
        <Text style={[styles.title, { color: textPrimary }]}>{section.title}</Text>
      </View>

      {!content ? (
        <Text style={{ color: textSecondary, fontSize: 12.5 }}>Tu equipo todavía no generó este resumen.</Text>
      ) : (
        <View style={{ gap: 12 }}>
          <Text style={[styles.summary, { color: textPrimary }]}>{content.summary}</Text>

          {content.highlights.length > 0 && (
            <View style={{ gap: 6 }}>
              {content.highlights.map((h, i) => (
                <Text key={i} style={[styles.highlight, { color: textSecondary }]}>
                  ✦ {h}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.metricsRow}>
            <View style={[styles.metricBox, { backgroundColor: inputBg }]}>
              <Text style={[styles.metricValue, { color: primaryColor }]}>{content.metrics.progressPercent}%</Text>
              <Text style={[styles.metricLabel, { color: textSecondary }]}>Avance</Text>
            </View>
            <View style={[styles.metricBox, { backgroundColor: inputBg }]}>
              <Text style={[styles.metricValue, { color: primaryColor }]}>{content.metrics.tasksCompleted}</Text>
              <Text style={[styles.metricLabel, { color: textSecondary }]}>Completadas</Text>
            </View>
            <View style={[styles.metricBox, { backgroundColor: inputBg }]}>
              <Text style={[styles.metricValue, { color: content.metrics.tasksOverdue > 0 ? "#EF4444" : primaryColor }]}>
                {content.metrics.tasksOverdue}
              </Text>
              <Text style={[styles.metricLabel, { color: textSecondary }]}>Vencidas</Text>
            </View>
          </View>

          {section.generatedAt && <Text style={[styles.updatedAt, { color: textSecondary }]}>Actualizado {formatDateTime(section.generatedAt)}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 24, padding: 18 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  title: { fontSize: 14.5, fontWeight: "700" },
  summary: { fontSize: 13, lineHeight: 20 },
  highlight: { fontSize: 12, lineHeight: 18 },
  metricsRow: { flexDirection: "row", gap: 8 },
  metricBox: { flex: 1, borderRadius: 14, paddingVertical: 10, alignItems: "center" },
  metricValue: { fontSize: 17, fontWeight: "700" },
  metricLabel: { fontSize: 10, marginTop: 2 },
  updatedAt: { fontSize: 10.5 },
});
