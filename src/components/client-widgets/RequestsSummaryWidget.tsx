import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ClipboardList } from "lucide-react-native";
import {
  CLIENT_REQUEST_STATUS_COLORS,
  CLIENT_REQUEST_STATUS_LABELS,
  CLIENT_REQUEST_STATUS_ORDER,
  ClientRequest,
  listClientRequests,
} from "../../lib/clients";

// Teaser del tab Solicitudes (docs/CLIENTE.md §6/§8) — Solicitudes sigue
// siendo un tab completo e intacto, esto es solo un resumen con link. Self-
// contained (fetch propio), mismo patrón que ProfileEditorForm.
type Props = {
  isDark: boolean;
  organizationId: string;
  clientUserId: string;
  onGoToRequests: () => void;
};

export default function RequestsSummaryWidget({ isDark, organizationId, clientUserId, onGoToRequests }: Props) {
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const cardBg        = isDark ? "rgba(17, 24, 39, 0.6)" : "rgba(255, 255, 255, 0.6)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = "#2C7BD1";

  useEffect(() => {
    let active = true;
    listClientRequests(organizationId, clientUserId).then(({ data }) => {
      if (active) {
        setRequests(data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [organizationId, clientUserId]);

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

  const counts = CLIENT_REQUEST_STATUS_ORDER.map((status) => ({
    status,
    count: requests.filter((r) => r.status === status).length,
  })).filter((c) => c.count > 0);

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
      <View style={styles.header}>
        <ClipboardList size={16} color={primaryColor} strokeWidth={2.2} />
        <Text style={[styles.title, { color: textPrimary }]}>Solicitudes</Text>
      </View>

      {loading ? (
        <Text style={{ color: textSecondary, fontSize: 12.5 }}>Cargando…</Text>
      ) : requests.length === 0 ? (
        <Text style={{ color: textSecondary, fontSize: 12.5 }}>Todavía no hiciste ninguna solicitud.</Text>
      ) : (
        <>
          <View style={styles.countsRow}>
            {counts.map((c) => (
              <View key={c.status} style={[styles.countPill, { backgroundColor: CLIENT_REQUEST_STATUS_COLORS[c.status] + "18" }]}>
                <Text style={[styles.countText, { color: CLIENT_REQUEST_STATUS_COLORS[c.status] }]}>
                  {c.count} {CLIENT_REQUEST_STATUS_LABELS[c.status]}
                </Text>
              </View>
            ))}
          </View>
          <View style={{ gap: 6, marginTop: 10 }}>
            {requests.slice(0, 3).map((r) => (
              <Text key={r.id} style={[styles.requestLine, { color: textSecondary }]} numberOfLines={1}>
                • {r.title}
              </Text>
            ))}
          </View>
        </>
      )}

      <TouchableOpacity onPress={onGoToRequests} style={{ marginTop: 12 }}>
        <Text style={{ color: primaryColor, fontSize: 12.5, fontWeight: "700" }}>Ver todas las solicitudes</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 24, padding: 18 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  title: { fontSize: 14.5, fontWeight: "700" },
  countsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  countPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  countText: { fontSize: 11.5, fontWeight: "700" },
  requestLine: { fontSize: 12, lineHeight: 17 },
});
