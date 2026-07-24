import React, { useCallback, useEffect, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FileCheck2 } from "lucide-react-native";
import {
  CLIENT_DELIVERABLE_STATUS_COLORS,
  CLIENT_DELIVERABLE_STATUS_LABELS,
  ClientDeliverable,
  decideClientDeliverable,
  listClientDeliverables,
} from "../../lib/clientDeliverables";

// Aprobaciones (docs/CLIENTE.md §9) — el cliente aprueba/rechaza directo
// desde este widget, sin tab propio (confirmado con el usuario: todo lo que
// no sea Chat/Solicitudes vive como widget del Home). Confirmación inline,
// nunca Alert.alert (docs/TRAMPAS.md).
type Props = {
  isDark: boolean;
  organizationId: string;
  clientUserId: string;
};

export default function DeliverablesWidget({ isDark, organizationId, clientUserId }: Props) {
  const [deliverables, setDeliverables] = useState<ClientDeliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmFor, setConfirmFor] = useState<{ id: string; decision: "approved" | "rejected" } | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const cardBg        = isDark ? "rgba(17, 24, 39, 0.6)" : "rgba(255, 255, 255, 0.6)";
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = "#2C7BD1";
  const dangerColor   = "#EF4444";
  const successColor  = "#10B981";

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await listClientDeliverables(organizationId, clientUserId);
    setDeliverables(data);
    setLoading(false);
  }, [organizationId, clientUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDecide = async (deliverableId: string, decision: "approved" | "rejected") => {
    setConfirmFor(null);
    const { error } = await decideClientDeliverable(deliverableId, clientUserId, decision);
    if (error) {
      setErrorText("No se pudo registrar tu decisión, intenta de nuevo.");
      return;
    }
    setErrorText(null);
    await load();
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
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
      <View style={styles.header}>
        <FileCheck2 size={16} color={primaryColor} strokeWidth={2.2} />
        <Text style={[styles.title, { color: textPrimary }]}>Entregables</Text>
      </View>

      {errorText && <Text style={[styles.errorText, { color: dangerColor }]}>{errorText}</Text>}

      {loading ? (
        <Text style={{ color: textSecondary, fontSize: 12.5 }}>Cargando…</Text>
      ) : deliverables.length === 0 ? (
        <Text style={{ color: textSecondary, fontSize: 12.5 }}>Todavía no hay entregables para revisar.</Text>
      ) : (
        <View style={{ gap: 10 }}>
          {deliverables.map((d) => (
            <View key={d.id} style={[styles.itemCard, { backgroundColor: inputBg, borderColor: border }]}>
              <View style={styles.itemHeader}>
                <Text style={[styles.itemTitle, { color: textPrimary }]} numberOfLines={1}>
                  {d.title}
                </Text>
                <View style={[styles.statusPill, { backgroundColor: CLIENT_DELIVERABLE_STATUS_COLORS[d.status] + "20" }]}>
                  <Text style={[styles.statusPillText, { color: CLIENT_DELIVERABLE_STATUS_COLORS[d.status] }]}>
                    {CLIENT_DELIVERABLE_STATUS_LABELS[d.status]}
                  </Text>
                </View>
              </View>
              {!!d.content && (
                <Text style={[styles.itemContent, { color: textSecondary }]} numberOfLines={3}>
                  {d.content}
                </Text>
              )}

              {d.status === "pending" &&
                (confirmFor?.id === d.id ? (
                  <View style={styles.confirmRow}>
                    <Text style={{ color: textSecondary, fontSize: 12 }}>
                      ¿{confirmFor.decision === "approved" ? "Aprobar" : "Rechazar"} este entregable?
                    </Text>
                    <TouchableOpacity onPress={() => handleDecide(d.id, confirmFor.decision)}>
                      <Text style={{ color: confirmFor.decision === "approved" ? successColor : dangerColor, fontSize: 12, fontWeight: "700" }}>Sí</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setConfirmFor(null)}>
                      <Text style={{ color: textSecondary, fontSize: 12, fontWeight: "700" }}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={[styles.actionBtn, { backgroundColor: successColor }]}
                      onPress={() => setConfirmFor({ id: d.id, decision: "approved" })}
                    >
                      <Text style={styles.actionBtnText}>Aprobar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={[styles.actionBtn, { backgroundColor: dangerColor }]}
                      onPress={() => setConfirmFor({ id: d.id, decision: "rejected" })}
                    >
                      <Text style={styles.actionBtnText}>Rechazar</Text>
                    </TouchableOpacity>
                  </View>
                ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 24, padding: 18 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  title: { fontSize: 14.5, fontWeight: "700" },
  errorText: { fontSize: 12, fontWeight: "600", marginBottom: 8 },
  itemCard: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 6 },
  itemHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  itemTitle: { fontSize: 13, fontWeight: "700", flex: 1 },
  itemContent: { fontSize: 12, lineHeight: 17 },
  statusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  statusPillText: { fontSize: 10.5, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: { flex: 1, borderRadius: 999, paddingVertical: 8, alignItems: "center" },
  actionBtnText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  confirmRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
});
