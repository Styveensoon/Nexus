import React, { useCallback, useState } from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowLeft, ChevronDown, LayoutGrid, Sparkles, User as UserIcon, Users as UsersIcon } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import ClientChatThread from "../components/ClientChatThread";
import ClientAssignModal from "../components/ClientAssignModal";
import ClientRequestStatusPickerModal from "../components/ClientRequestStatusPickerModal";
import ClientDocumentGenerateModal from "../components/ClientDocumentGenerateModal";
import ChatAttachmentButtons from "../components/ChatAttachmentButtons";
import {
  ClientAssigneeInfo,
  CLIENT_REQUEST_STATUS_COLORS,
  CLIENT_REQUEST_STATUS_LABELS,
  ClientRequest,
  getClientAssignment,
  listClientRequests,
  updateClientRequestStatus,
  uploadClientAttachment,
} from "../lib/clients";
import { ClientDocument, getDocumentForRequest } from "../lib/clientDocuments";
import {
  CLIENT_DELIVERABLE_STATUS_COLORS,
  CLIENT_DELIVERABLE_STATUS_LABELS,
  ClientDeliverable,
  createClientDeliverable,
  listClientDeliverables,
} from "../lib/clientDeliverables";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

// Vista de gestión de un cliente puntual (docs/CLIENTE.md §4/§5/§8), lado
// organización — secciones apiladas (sin tabs) para no sumar más superficie
// de la necesaria: Asignación (solo el owner puede reasignar), Chat (mismo
// ClientChatThread que usa el lado cliente) y Solicitudes (cambio de estado
// para el staff).
export default function ClientDetailScreen({ navigation, route }: any) {
  const { isDark } = useTheme();
  const { organization, user } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isOwner = !!organization && organization.owner_id === user?.id;

  const { clientUserId, clientName, clientAvatarUrl, clientAvatarColor } = route.params ?? {};

  const [assignment, setAssignment] = useState<ClientAssigneeInfo | null>(null);
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [documentsByRequest, setDocumentsByRequest] = useState<Record<string, ClientDocument | null>>({});
  const [deliverables, setDeliverables] = useState<ClientDeliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [statusPickerForRequest, setStatusPickerForRequest] = useState<ClientRequest | null>(null);
  const [documentModalRequest, setDocumentModalRequest] = useState<ClientRequest | null>(null);

  const [showDeliverableForm, setShowDeliverableForm] = useState(false);
  const [newDeliverableTitle, setNewDeliverableTitle] = useState("");
  const [newDeliverableContent, setNewDeliverableContent] = useState("");
  const [newDeliverableAttachment, setNewDeliverableAttachment] = useState<{ url: string; name: string } | null>(null);
  const [creatingDeliverable, setCreatingDeliverable] = useState(false);
  const [deliverableErrorText, setDeliverableErrorText] = useState<string | null>(null);

  const bg            = isDark ? "#0B1220" : "#F1F5FA";
  const cardBg        = isDark ? "rgba(17, 24, 39, 0.6)" : "rgba(255, 255, 255, 0.6)";
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = "#2C7BD1";
  const dangerColor   = "#EF4444";

  const load = useCallback(async () => {
    if (!organization || !clientUserId) return;
    setLoading(true);
    const [assignmentRes, requestsRes, deliverablesRes] = await Promise.all([
      getClientAssignment(organization.id, clientUserId),
      listClientRequests(organization.id, clientUserId),
      listClientDeliverables(organization.id, clientUserId),
    ]);
    setAssignment(assignmentRes);
    setRequests(requestsRes.data);
    setDeliverables(deliverablesRes.data);

    const documentEntries = await Promise.all(
      requestsRes.data.map(async (r) => {
        const { data } = await getDocumentForRequest(r.id);
        return [r.id, data] as const;
      })
    );
    setDocumentsByRequest(Object.fromEntries(documentEntries));

    setLoading(false);
  }, [organization?.id, clientUserId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleChangeRequestStatus = async (status: any) => {
    if (!statusPickerForRequest || !user) return;
    const requestId = statusPickerForRequest.id;
    setStatusPickerForRequest(null);
    await updateClientRequestStatus(requestId, status, user.id);
    await load();
  };

  const handleCreateDeliverable = async () => {
    if (!organization || !clientUserId || !user || !newDeliverableTitle.trim()) return;
    setCreatingDeliverable(true);
    setDeliverableErrorText(null);
    const { error } = await createClientDeliverable({
      organizationId: organization.id,
      clientUserId,
      title: newDeliverableTitle.trim(),
      content: newDeliverableContent.trim() || null,
      attachmentUrl: newDeliverableAttachment?.url ?? null,
      createdBy: user.id,
    });
    setCreatingDeliverable(false);
    if (error) {
      setDeliverableErrorText("No se pudo crear el entregable.");
      return;
    }
    setNewDeliverableTitle("");
    setNewDeliverableContent("");
    setNewDeliverableAttachment(null);
    setShowDeliverableForm(false);
    await load();
  };

  if (!organization || !clientUserId) return null;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: isMobile ? 16 : 32 }}>
        <View style={{ width: "100%", maxWidth: 800, alignSelf: "center" }}>
          <View style={styles.header}>
            <TouchableOpacity activeOpacity={0.8} style={[styles.backBtn, { backgroundColor: cardBg, borderColor: border }]} onPress={() => navigation.goBack()}>
              <ArrowLeft size={18} color={textSecondary} strokeWidth={2.2} />
            </TouchableOpacity>
            <View style={[styles.avatar, { backgroundColor: clientAvatarColor ?? "#2C7BD1", overflow: "hidden" }]}>
              {clientAvatarUrl ? <Image source={{ uri: clientAvatarUrl }} style={{ width: 44, height: 44 }} /> : <Text style={styles.avatarText}>{initials(clientName ?? "Cliente")}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.subtitle, { color: textSecondary }]}>Cliente</Text>
              <Text style={[styles.title, { color: textPrimary }]} numberOfLines={1}>
                {clientName ?? "Cliente"}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.homeBtn, { backgroundColor: primaryColor }]}
              onPress={() => navigation.navigate("ClientHomeBuilder", { clientUserId, clientName, clientAvatarUrl, clientAvatarColor })}
            >
              <LayoutGrid size={15} color="#FFF" strokeWidth={2.3} />
              {!isMobile && <Text style={styles.homeBtnText}>Armar home</Text>}
            </TouchableOpacity>
          </View>

          {/* ASIGNACIÓN */}
          <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Encargado de atenderlo</Text>
            {loading ? (
              <Text style={{ color: textSecondary, fontSize: 13 }}>Cargando…</Text>
            ) : (
              <View style={styles.assignmentRow}>
                <View style={[styles.assignmentIcon, { backgroundColor: inputBg }]}>
                  {assignment?.type === "team" ? (
                    <UsersIcon size={16} color={primaryColor} strokeWidth={2.3} />
                  ) : (
                    <UserIcon size={16} color={primaryColor} strokeWidth={2.3} />
                  )}
                </View>
                <Text style={[styles.assignmentText, { color: textPrimary }]}>
                  {assignment ? assignment.name : "Todavía nadie fue asignado (solo el owner puede ver/atender por ahora)"}
                </Text>
              </View>
            )}
            {isOwner && (
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.reassignBtn, { backgroundColor: primaryColor }]}
                onPress={() => setShowAssignModal(true)}
              >
                <Text style={styles.reassignBtnText}>{assignment ? "Reasignar" : "Asignar"}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* CHAT */}
          <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Chat</Text>
            <ClientChatThread
              organizationId={organization.id}
              clientUserId={clientUserId}
              currentUserId={user!.id}
              isDark={isDark}
              maxHeight={isMobile ? 300 : 380}
            />
          </View>

          {/* SOLICITUDES */}
          <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Solicitudes</Text>
            {loading ? (
              <Text style={{ color: textSecondary, fontSize: 13 }}>Cargando…</Text>
            ) : requests.length === 0 ? (
              <Text style={{ color: textSecondary, fontSize: 13 }}>Este cliente todavía no hizo ninguna solicitud.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {requests.map((r) => {
                  const document = documentsByRequest[r.id];
                  return (
                    <View key={r.id} style={[styles.requestCardColumn, { borderColor: border }]}>
                      <View style={styles.requestHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.requestTitle, { color: textPrimary }]} numberOfLines={1}>
                            {r.title}
                          </Text>
                          {!!r.description && (
                            <Text style={[styles.requestDescription, { color: textSecondary }]} numberOfLines={2}>
                              {r.description}
                            </Text>
                          )}
                          <Text style={[styles.requestDate, { color: textSecondary }]}>{formatDate(r.createdAt)}</Text>
                        </View>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          style={[styles.statusPill, { backgroundColor: CLIENT_REQUEST_STATUS_COLORS[r.status] + "20" }]}
                          onPress={() => setStatusPickerForRequest(r)}
                        >
                          <Text style={[styles.statusPillText, { color: CLIENT_REQUEST_STATUS_COLORS[r.status] }]}>
                            {CLIENT_REQUEST_STATUS_LABELS[r.status]}
                          </Text>
                          <ChevronDown size={12} color={CLIENT_REQUEST_STATUS_COLORS[r.status]} strokeWidth={2.4} />
                        </TouchableOpacity>
                      </View>

                      {document ? (
                        <View style={[styles.docPreview, { borderColor: border }]}>
                          <Text style={[styles.docPreviewTitle, { color: textPrimary }]} numberOfLines={1}>
                            📄 {document.title}
                          </Text>
                          {document.generatedContent?.sections?.[0] && (
                            <Text style={[styles.docPreviewBody, { color: textSecondary }]} numberOfLines={2}>
                              {document.generatedContent.sections[0].body}
                            </Text>
                          )}
                          <TouchableOpacity onPress={() => setDocumentModalRequest(r)}>
                            <Text style={{ color: primaryColor, fontSize: 12, fontWeight: "700", marginTop: 4 }}>Regenerar</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity activeOpacity={0.8} style={styles.genDocBtn} onPress={() => setDocumentModalRequest(r)}>
                          <Sparkles size={13} color={primaryColor} strokeWidth={2.3} />
                          <Text style={{ color: primaryColor, fontSize: 12.5, fontWeight: "700" }}>Generar documento con IA</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* ENTREGABLES */}
          <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={styles.deliverablesHeader}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Entregables</Text>
              <TouchableOpacity onPress={() => setShowDeliverableForm((v) => !v)}>
                <Text style={{ color: primaryColor, fontSize: 12.5, fontWeight: "700" }}>{showDeliverableForm ? "Cancelar" : "+ Nuevo"}</Text>
              </TouchableOpacity>
            </View>

            {showDeliverableForm && (
              <View style={[styles.deliverableForm, { borderColor: border }]}>
                <TextInput
                  value={newDeliverableTitle}
                  onChangeText={setNewDeliverableTitle}
                  placeholder="Título (ej. Propuesta de diseño v1)"
                  placeholderTextColor={textSecondary}
                  style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                />
                <TextInput
                  value={newDeliverableContent}
                  onChangeText={setNewDeliverableContent}
                  placeholder="Contenido / descripción (opcional)"
                  placeholderTextColor={textSecondary}
                  multiline
                  style={[styles.input, styles.textarea, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                />
                <View style={styles.deliverableAttachRow}>
                  <ChatAttachmentButtons
                    color={primaryColor}
                    onAttachmentReady={async (data, contentType, ext, name) => {
                      if (!user) return;
                      const { url, error } = await uploadClientAttachment(user.id, data, contentType, ext);
                      if (!error && url) setNewDeliverableAttachment({ url, name });
                    }}
                    onError={(message) => setDeliverableErrorText(message)}
                  />
                  {newDeliverableAttachment && (
                    <Text style={{ color: textSecondary, fontSize: 12 }} numberOfLines={1}>
                      Adjunto: {newDeliverableAttachment.name}
                    </Text>
                  )}
                </View>
                {deliverableErrorText && <Text style={[styles.errorText, { color: dangerColor }]}>{deliverableErrorText}</Text>}
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={creatingDeliverable || !newDeliverableTitle.trim()}
                  style={[styles.submitBtn, { backgroundColor: primaryColor, opacity: creatingDeliverable || !newDeliverableTitle.trim() ? 0.6 : 1 }]}
                  onPress={handleCreateDeliverable}
                >
                  <Text style={styles.submitBtnText}>{creatingDeliverable ? "Creando…" : "Crear entregable"}</Text>
                </TouchableOpacity>
              </View>
            )}

            {deliverables.length === 0 ? (
              <Text style={{ color: textSecondary, fontSize: 13 }}>Todavía no hay entregables para este cliente.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {deliverables.map((d) => (
                  <View key={d.id} style={[styles.requestRow, { borderColor: border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.requestTitle, { color: textPrimary }]} numberOfLines={1}>
                        {d.title}
                      </Text>
                      {!!d.content && (
                        <Text style={[styles.requestDescription, { color: textSecondary }]} numberOfLines={2}>
                          {d.content}
                        </Text>
                      )}
                      <Text style={[styles.requestDate, { color: textSecondary }]}>{formatDate(d.createdAt)}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: CLIENT_DELIVERABLE_STATUS_COLORS[d.status] + "20" }]}>
                      <Text style={[styles.statusPillText, { color: CLIENT_DELIVERABLE_STATUS_COLORS[d.status] }]}>
                        {CLIENT_DELIVERABLE_STATUS_LABELS[d.status]}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <ClientAssignModal
        visible={showAssignModal}
        isDark={isDark}
        organizationId={organization.id}
        clientUserId={clientUserId}
        assignedBy={user!.id}
        onClose={() => setShowAssignModal(false)}
        onAssigned={async () => {
          setShowAssignModal(false);
          await load();
        }}
      />

      <ClientRequestStatusPickerModal
        visible={!!statusPickerForRequest}
        isDark={isDark}
        currentStatus={statusPickerForRequest?.status ?? null}
        onClose={() => setStatusPickerForRequest(null)}
        onSelect={handleChangeRequestStatus}
      />

      {documentModalRequest && user && (
        <ClientDocumentGenerateModal
          visible={!!documentModalRequest}
          isDark={isDark}
          organizationId={organization.id}
          clientUserId={clientUserId}
          requestId={documentModalRequest.id}
          defaultTitle={documentModalRequest.title}
          existingDocument={documentsByRequest[documentModalRequest.id] ?? null}
          actorId={user.id}
          onClose={() => setDocumentModalRequest(null)}
          onGenerated={load}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  avatar: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  subtitle: { fontSize: 12, fontWeight: "600" },
  title: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3, marginTop: 2 },

  sectionCard: { borderWidth: 1, borderRadius: 24, padding: 18, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "700", marginBottom: 12 },

  assignmentRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  assignmentIcon: { width: 32, height: 32, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  assignmentText: { fontSize: 13, fontWeight: "600", flex: 1 },
  reassignBtn: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  reassignBtnText: { color: "#FFF", fontSize: 12.5, fontWeight: "700" },

  requestRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: 16, padding: 12 },
  requestCardColumn: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 10 },
  requestHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  requestTitle: { fontSize: 13.5, fontWeight: "700" },
  requestDescription: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  requestDate: { fontSize: 10.5, marginTop: 6 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusPillText: { fontSize: 11, fontWeight: "700" },

  homeBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  homeBtnText: { color: "#FFF", fontSize: 12.5, fontWeight: "700" },

  docPreview: { borderWidth: 1, borderRadius: 12, padding: 10 },
  docPreviewTitle: { fontSize: 12.5, fontWeight: "700" },
  docPreviewBody: { fontSize: 11.5, marginTop: 4, lineHeight: 16 },
  genDocBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },

  deliverablesHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  deliverableForm: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10, marginBottom: 14 },
  deliverableAttachRow: { flexDirection: "row", alignItems: "center", gap: 12 },

  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13.5 },
  textarea: { minHeight: 70, textAlignVertical: "top" },
  errorText: { fontSize: 12, fontWeight: "600" },
  submitBtn: { borderRadius: 999, paddingVertical: 12, alignItems: "center" },
  submitBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13.5 },
});
