import React, { useCallback, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ChevronDown, ChevronUp, ClipboardList, FileText, Plus, X } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useSpace } from "../context/SpaceContext";
import {
  cancelClientRequest,
  CLIENT_REQUEST_STATUS_COLORS,
  CLIENT_REQUEST_STATUS_LABELS,
  ClientRequest,
  createClientRequest,
  listClientRequests,
} from "../lib/clients";
import { ClientDocument, getDocumentForRequest } from "../lib/clientDocuments";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

// Solicitudes reales (docs/CLIENTE.md §8) — el cliente pide algo (documento,
// presentación, reporte custom) y se notifica por email a todos los
// encargados actuales (notifyClientRequestCreated en lib/emails.ts, llamado
// desde createClientRequest en lib/clients.ts). También queda visible acá
// dentro de la plataforma, no solo en el correo.
export default function ClientRequestsScreen() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  // useAuth().organization es SIEMPRE null acá a propósito (ver AuthContext.tsx
  // — ese alias solo resuelve espacios "member"); las pantallas dentro de
  // ClientTabs necesitan leer la organización del espacio activo "client"
  // vía useSpace(). Bug real encontrado probando en vivo (pantalla en blanco).
  const { activeSpace } = useSpace();
  const organization = activeSpace?.kind === "client" ? activeSpace.organization : null;
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = Platform.OS === "web";

  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [documentsByRequest, setDocumentsByRequest] = useState<Record<string, ClientDocument | null>>({});
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const bg            = isDark ? "#0B1220" : "#F1F5FA";
  const cardBg        = isDark ? "rgba(17, 24, 39, 0.6)" : "rgba(255, 255, 255, 0.6)";
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = "#2C7BD1";
  const dangerColor   = "#EF4444";

  const load = useCallback(async () => {
    if (!organization || !user) return;
    setLoading(true);
    const { data } = await listClientRequests(organization.id, user.id);
    setRequests(data);

    const documentEntries = await Promise.all(
      data.map(async (r) => {
        const { data: doc } = await getDocumentForRequest(r.id);
        return [r.id, doc] as const;
      })
    );
    setDocumentsByRequest(Object.fromEntries(documentEntries));

    setLoading(false);
  }, [organization?.id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleCreate = async () => {
    if (!organization || !user || !newTitle.trim()) return;
    setCreating(true);
    const { error } = await createClientRequest({
      organizationId: organization.id,
      clientUserId: user.id,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
    });
    setCreating(false);
    if (error) {
      setErrorText("No se pudo crear la solicitud.");
      return;
    }
    setErrorText(null);
    setNewTitle("");
    setNewDescription("");
    setShowForm(false);
    await load();
  };

  const handleCancel = async (requestId: string) => {
    if (!user) return;
    setConfirmCancelId(null);
    const { error } = await cancelClientRequest(requestId, user.id);
    if (error) {
      setErrorText("No se pudo cancelar la solicitud.");
      return;
    }
    await load();
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: isMobile ? 16 : 32 }}>
        <View style={{ width: "100%", maxWidth: 720, alignSelf: "center" }}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: textPrimary }]}>Solicitudes</Text>
              <Text style={[styles.subtitle, { color: textSecondary }]}>Pide documentos, reportes o lo que necesites</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.addBtn, { backgroundColor: primaryColor }]}
              onPress={() => setShowForm((v) => !v)}
            >
              {showForm ? <X size={18} color="#FFF" strokeWidth={2.3} /> : <Plus size={18} color="#FFF" strokeWidth={2.3} />}
            </TouchableOpacity>
          </View>

          {showForm && (
            <View style={[styles.formCard, { backgroundColor: cardBg, borderColor: border }]}>
              <TextInput
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="¿Qué necesitas? (ej. Reporte de avance)"
                placeholderTextColor={textSecondary}
                style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrimary }, isWeb && styles.noOutline]}
              />
              <TextInput
                value={newDescription}
                onChangeText={setNewDescription}
                placeholder="Detalles adicionales (opcional)"
                placeholderTextColor={textSecondary}
                multiline
                style={[
                  styles.input,
                  styles.textarea,
                  { backgroundColor: inputBg, borderColor: border, color: textPrimary },
                  isWeb && styles.noOutline,
                ]}
              />
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={creating || !newTitle.trim()}
                style={[styles.submitBtn, { backgroundColor: primaryColor, opacity: creating || !newTitle.trim() ? 0.6 : 1 }]}
                onPress={handleCreate}
              >
                <Text style={styles.submitBtnText}>{creating ? "Enviando…" : "Enviar solicitud"}</Text>
              </TouchableOpacity>
            </View>
          )}

          {errorText && <Text style={[styles.errorText, { color: dangerColor }]}>{errorText}</Text>}

          {loading ? (
            <Text style={{ color: textSecondary, fontSize: 13 }}>Cargando…</Text>
          ) : requests.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border }]}>
              <ClipboardList size={26} color={textSecondary} strokeWidth={2} />
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>Todavía no hiciste ninguna solicitud</Text>
              <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
                Usa el botón "+" para pedir un documento, reporte o cualquier otra cosa a tu equipo.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {requests.map((r) => (
                <View key={r.id} style={[styles.requestCard, { backgroundColor: cardBg, borderColor: border }]}>
                  <View style={styles.requestHeader}>
                    <Text style={[styles.requestTitle, { color: textPrimary }]} numberOfLines={2}>
                      {r.title}
                    </Text>
                    <View style={[styles.statusPill, { backgroundColor: CLIENT_REQUEST_STATUS_COLORS[r.status] + "20" }]}>
                      <Text style={[styles.statusPillText, { color: CLIENT_REQUEST_STATUS_COLORS[r.status] }]}>
                        {CLIENT_REQUEST_STATUS_LABELS[r.status]}
                      </Text>
                    </View>
                  </View>
                  {!!r.description && <Text style={[styles.requestDescription, { color: textSecondary }]}>{r.description}</Text>}
                  <Text style={[styles.requestDate, { color: textSecondary }]}>{formatDate(r.createdAt)}</Text>

                  {documentsByRequest[r.id] && (
                    <View style={[styles.docBox, { borderColor: border }]}>
                      <TouchableOpacity
                        style={styles.docHeader}
                        onPress={() => setExpandedDocId(expandedDocId === r.id ? null : r.id)}
                      >
                        <FileText size={14} color={primaryColor} strokeWidth={2.2} />
                        <Text style={[styles.docTitle, { color: textPrimary }]} numberOfLines={1}>
                          {documentsByRequest[r.id]!.title}
                        </Text>
                        {expandedDocId === r.id ? (
                          <ChevronUp size={14} color={textSecondary} strokeWidth={2.2} />
                        ) : (
                          <ChevronDown size={14} color={textSecondary} strokeWidth={2.2} />
                        )}
                      </TouchableOpacity>
                      {expandedDocId === r.id && (
                        <View style={{ gap: 10, marginTop: 8 }}>
                          {(documentsByRequest[r.id]!.generatedContent?.sections ?? []).map((s, i) => (
                            <View key={i}>
                              <Text style={[styles.docSectionHeading, { color: textPrimary }]}>{s.heading}</Text>
                              <Text style={[styles.docSectionBody, { color: textSecondary }]}>{s.body}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {r.status === "open" &&
                    (confirmCancelId === r.id ? (
                      <View style={styles.confirmRow}>
                        <Text style={{ color: textSecondary, fontSize: 12 }}>¿Cancelar esta solicitud?</Text>
                        <TouchableOpacity onPress={() => handleCancel(r.id)}>
                          <Text style={{ color: dangerColor, fontSize: 12, fontWeight: "700" }}>Sí, cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setConfirmCancelId(null)}>
                          <Text style={{ color: textSecondary, fontSize: 12, fontWeight: "700" }}>Volver</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={{ marginTop: 8 }} onPress={() => setConfirmCancelId(r.id)}>
                        <Text style={{ color: textSecondary, fontSize: 12, fontWeight: "700" }}>Cancelar</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  title: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  subtitle: { fontSize: 12.5, marginTop: 2 },
  addBtn: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center" },

  formCard: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 10, marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  textarea: { minHeight: 70, textAlignVertical: "top" },
  submitBtn: { borderRadius: 999, paddingVertical: 12, alignItems: "center" },
  submitBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13.5 },
  noOutline: { outlineStyle: "none" } as any,

  errorText: { fontSize: 12.5, fontWeight: "600", marginBottom: 12 },

  emptyCard: { borderWidth: 1, borderRadius: 24, padding: 28, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  emptySubtitle: { fontSize: 12.5, textAlign: "center", lineHeight: 18 },

  requestCard: { borderWidth: 1, borderRadius: 18, padding: 16 },
  requestHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  requestTitle: { fontSize: 14.5, fontWeight: "700", flex: 1 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  requestDescription: { fontSize: 12.5, marginTop: 6, lineHeight: 18 },
  requestDate: { fontSize: 11, marginTop: 8 },
  confirmRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },

  docBox: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 10 },
  docHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  docTitle: { fontSize: 12.5, fontWeight: "700", flex: 1 },
  docSectionHeading: { fontSize: 12, fontWeight: "700" },
  docSectionBody: { fontSize: 12, marginTop: 2, lineHeight: 17 },
});
