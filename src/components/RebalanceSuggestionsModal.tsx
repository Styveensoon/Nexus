import React, { useEffect, useState } from "react";
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ArrowRight, Sparkles, X } from "lucide-react-native";
import { requestRebalanceSuggestions, RebalanceSuggestion } from "../lib/rebalance";
import { updateTask } from "../lib/tasks";

// El Semillero como copiloto continuo (docs/ARQUITECTURA.md) — sugerencias
// de reasignación dentro de un proyecto ya en marcha, mismo patrón visual
// que la card "Sugerencias de IA" de BadgesScreen.tsx, pero en un modal
// dedicado (se abre a demanda desde TasksScreen, no vive inline en la
// pantalla). No se persiste nada — se recalcula cada vez que se abre.
type Props = {
  visible: boolean;
  isDark: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
  onApplied: () => void;
};

export default function RebalanceSuggestionsModal({ visible, isDark, projectId, projectName, onClose, onApplied }: Props) {
  const [suggestions, setSuggestions] = useState<RebalanceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [askedOnce, setAskedOnce] = useState(false);

  const cardBg        = isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.9)";
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = "#2C7BD1";
  const dangerColor   = "#EF4444";

  useEffect(() => {
    if (!visible) return;
    setSuggestions([]);
    setErrorText(null);
    setAskedOnce(false);
  }, [visible, projectId]);

  const handleAnalyze = async () => {
    setLoading(true);
    setErrorText(null);
    setAskedOnce(true);
    const { data, error } = await requestRebalanceSuggestions(projectId);
    setLoading(false);
    if (error) {
      setErrorText("No se pudo analizar el proyecto, intenta de nuevo.");
      return;
    }
    setSuggestions(data);
  };

  const handleApply = async (suggestion: RebalanceSuggestion) => {
    setBusyTaskId(suggestion.taskId);
    const { error } = await updateTask(suggestion.taskId, { assignedUserId: suggestion.toUserId });
    setBusyTaskId(null);
    if (error) {
      setErrorText("No se pudo reasignar esa tarea.");
      return;
    }
    setSuggestions((prev) => prev.filter((s) => s.taskId !== suggestion.taskId));
    onApplied();
  };

  const handleDismiss = (taskId: string) => {
    setSuggestions((prev) => prev.filter((s) => s.taskId !== taskId));
  };

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ScrollView style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]} contentContainerStyle={{ padding: 20 }}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: textPrimary }]}>Sugerencias de reasignación</Text>
              <Text style={[styles.subtitle, { color: textSecondary }]} numberOfLines={1}>
                {projectName}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color={textSecondary} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.description, { color: textSecondary }]}>
            El Semillero analiza la carga y los skills del equipo de este proyecto y sugiere mover tareas puntuales cuando alguien está
            sobrecargado o vencido y otra persona calza mejor.
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={loading}
            style={[styles.analyzeBtn, { backgroundColor: primaryColor, opacity: loading ? 0.6 : 1 }]}
            onPress={handleAnalyze}
          >
            <Sparkles size={14} color="#FFF" strokeWidth={2.3} />
            <Text style={styles.analyzeBtnText}>{loading ? "Analizando…" : "Analizar proyecto"}</Text>
          </TouchableOpacity>

          {errorText && <Text style={[styles.errorText, { color: dangerColor }]}>{errorText}</Text>}

          {!loading && askedOnce && !errorText && suggestions.length === 0 && (
            <Text style={[styles.emptyText, { color: textSecondary }]}>
              No encontró ninguna reasignación que valga la pena por ahora — la carga parece bien distribuida.
            </Text>
          )}

          {suggestions.length > 0 && (
            <View style={{ gap: 10, marginTop: 16 }}>
              {suggestions.map((s) => {
                const isBusy = busyTaskId === s.taskId;
                return (
                  <View key={s.taskId} style={[styles.suggestionRow, { backgroundColor: inputBg, borderColor: border }]}>
                    <Text style={[styles.suggestionTitle, { color: textPrimary }]} numberOfLines={1}>
                      {s.taskTitle}
                    </Text>
                    <View style={styles.transferRow}>
                      <Text style={[styles.transferName, { color: textSecondary }]} numberOfLines={1}>
                        {s.fromUserName}
                      </Text>
                      <ArrowRight size={12} color={primaryColor} strokeWidth={2.3} />
                      <Text style={[styles.transferName, { color: textPrimary, fontWeight: "700" }]} numberOfLines={1}>
                        {s.toUserName}
                      </Text>
                    </View>
                    <Text style={[styles.suggestionReason, { color: textSecondary }]}>{s.reason}</Text>
                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        disabled={isBusy}
                        style={[styles.applyBtn, { backgroundColor: primaryColor, opacity: isBusy ? 0.6 : 1 }]}
                        onPress={() => handleApply(s)}
                      >
                        <Text style={styles.applyBtnText}>{isBusy ? "…" : "Reasignar"}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDismiss(s.taskId)}>
                        <Text style={{ color: textSecondary, fontSize: 12.5, fontWeight: "700" }}>Descartar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
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
  card: { width: "100%", maxWidth: 460, maxHeight: "85%", borderRadius: 28, borderWidth: 1 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 },
  title: { fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },
  subtitle: { fontSize: 12, marginTop: 2 },
  description: { fontSize: 12.5, lineHeight: 18, marginBottom: 16 },
  analyzeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 999, paddingVertical: 12 },
  analyzeBtnText: { color: "#FFF", fontSize: 13, fontWeight: "700" },
  errorText: { fontSize: 12.5, fontWeight: "600", marginTop: 14 },
  emptyText: { fontSize: 12.5, lineHeight: 18, marginTop: 16, textAlign: "center" },
  suggestionRow: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  suggestionTitle: { fontSize: 13.5, fontWeight: "700" },
  transferRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  transferName: { fontSize: 12.5, flexShrink: 1 },
  suggestionReason: { fontSize: 12, lineHeight: 17 },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 4 },
  applyBtn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  applyBtnText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
});
