import React, { useCallback, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileCheck2,
  FolderKanban,
  MessageCircle,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import ClientWidgetTypePickerModal from "../components/ClientWidgetTypePickerModal";
import ClientSourcePickerModal from "../components/ClientSourcePickerModal";
import {
  CLIENT_WIDGET_DEFAULT_TITLES,
  CLIENT_WIDGET_TYPES,
  ClientHomeSection,
  ClientHomeSectionType,
  createClientHomeSection,
  deleteClientHomeSection,
  generateDashboardContent,
  listClientHomeSections,
  reorderClientHomeSection,
  updateClientHomeSectionConfig,
} from "../lib/clientHome";

const ICONS: Record<string, any> = { Sparkles, FolderKanban, ClipboardList, MessageCircle, FileCheck2 };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Armar el home del cliente con widgets (docs/CLIENTE.md §6, "Plan de
// implementación — Home con widgets") — se llega desde el botón "Armar home"
// en ClientDetailScreen. Solo staff (RLS client_home_sections_insert_staff/
// _update_staff/_delete_staff ya lo impone del lado servidor, esta pantalla
// no vuelve a chequear rol).
export default function ClientHomeBuilderScreen({ navigation, route }: any) {
  const { isDark } = useTheme();
  const { organization, user } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = Platform.OS === "web";

  const { clientUserId, clientName } = route.params ?? {};

  const [sections, setSections] = useState<ClientHomeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [sourcePickerFor, setSourcePickerFor] = useState<ClientHomeSection | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});
  const [errorText, setErrorText] = useState<string | null>(null);

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
    const { data } = await listClientHomeSections(organization.id, clientUserId);
    setSections(data);
    const drafts: Record<string, string> = {};
    data.forEach((s) => {
      if (s.type === "dashboard") drafts[s.id] = s.config?.extraPrompt ?? "";
    });
    setPromptDrafts(drafts);
    setLoading(false);
  }, [organization?.id, clientUserId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!organization || !clientUserId) return null;

  const handleSelectType = async (type: ClientHomeSectionType) => {
    setShowTypePicker(false);
    if (!user) return;
    const meta = CLIENT_WIDGET_TYPES.find((w) => w.type === type)!;
    const defaultConfig: any = type === "dashboard" ? { projectIds: [], teamIds: [], extraPrompt: "" } : meta.needsSource ? { projectIds: [], teamIds: [] } : {};

    const { data, error } = await createClientHomeSection({
      organizationId: organization.id,
      clientUserId,
      type,
      title: CLIENT_WIDGET_DEFAULT_TITLES[type],
      config: defaultConfig,
      createdBy: user.id,
    });

    if (error || !data) {
      setErrorText("No se pudo agregar el widget.");
      return;
    }
    setErrorText(null);
    await load();

    if (meta.needsSource) {
      setSourcePickerFor({
        id: data.id,
        organizationId: organization.id,
        clientUserId,
        type,
        title: CLIENT_WIDGET_DEFAULT_TITLES[type],
        config: defaultConfig,
        generatedContent: null,
        generatedAt: null,
        position: 0,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
      });
    }
  };

  const handleApplySource = async (projectIds: string[], teamIds: string[]) => {
    if (!sourcePickerFor) return;
    const config =
      sourcePickerFor.type === "dashboard"
        ? { ...sourcePickerFor.config, projectIds, teamIds, extraPrompt: sourcePickerFor.config?.extraPrompt ?? "" }
        : { projectIds, teamIds };
    const sectionId = sourcePickerFor.id;
    setSourcePickerFor(null);
    const { error } = await updateClientHomeSectionConfig(sectionId, config);
    if (error) setErrorText("No se pudo guardar la fuente.");
    await load();
  };

  const handleSavePrompt = async (section: ClientHomeSection) => {
    const text = promptDrafts[section.id] ?? "";
    if (text === (section.config?.extraPrompt ?? "")) return;
    const config = { ...section.config, extraPrompt: text };
    await updateClientHomeSectionConfig(section.id, config);
    await load();
  };

  const handleGenerate = async (section: ClientHomeSection) => {
    if (!user) return;
    setGeneratingId(section.id);
    setErrorText(null);
    const { error } = await generateDashboardContent(section, user.id);
    setGeneratingId(null);
    if (error) {
      setErrorText("No se pudo generar el dashboard, intenta de nuevo.");
      return;
    }
    await load();
  };

  const handleDelete = async (sectionId: string) => {
    setConfirmDeleteId(null);
    await deleteClientHomeSection(sectionId);
    await load();
  };

  const handleReorder = async (sectionId: string, direction: "up" | "down") => {
    await reorderClientHomeSection(organization.id, clientUserId, sectionId, direction);
    await load();
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: isMobile ? 16 : 32 }}>
        <View style={{ width: "100%", maxWidth: 720, alignSelf: "center" }}>
          <View style={styles.header}>
            <TouchableOpacity activeOpacity={0.8} style={[styles.backBtn, { backgroundColor: cardBg, borderColor: border }]} onPress={() => navigation.goBack()}>
              <ArrowLeft size={18} color={textSecondary} strokeWidth={2.2} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.subtitle, { color: textSecondary }]}>Armar home de</Text>
              <Text style={[styles.title, { color: textPrimary }]} numberOfLines={1}>
                {clientName ?? "Cliente"}
              </Text>
            </View>
            <TouchableOpacity activeOpacity={0.85} style={[styles.addBtn, { backgroundColor: primaryColor }]} onPress={() => setShowTypePicker(true)}>
              <Plus size={16} color="#FFF" strokeWidth={2.4} />
              <Text style={styles.addBtnText}>Agregar</Text>
            </TouchableOpacity>
          </View>

          {errorText && <Text style={[styles.errorText, { color: dangerColor }]}>{errorText}</Text>}

          {loading ? (
            <Text style={{ color: textSecondary, fontSize: 13 }}>Cargando…</Text>
          ) : sections.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border }]}>
              <Sparkles size={26} color={textSecondary} strokeWidth={2} />
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>Este home todavía está vacío</Text>
              <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
                Usa "Agregar" para armar el espacio de tu cliente con Dashboard, Tu Proyecto, Entregables y más.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {sections.map((section, idx) => {
                const meta = CLIENT_WIDGET_TYPES.find((w) => w.type === section.type)!;
                const Icon = ICONS[meta.icon] ?? Sparkles;
                const sourceCount = meta.needsSource
                  ? `${(section.config?.projectIds ?? []).length} proyectos, ${(section.config?.teamIds ?? []).length} equipos`
                  : null;
                const hasSource = (section.config?.projectIds?.length ?? 0) > 0 || (section.config?.teamIds?.length ?? 0) > 0;

                return (
                  <View key={section.id} style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: border }]}>
                    <View style={styles.sectionHeader}>
                      <View style={[styles.iconWrap, { backgroundColor: primaryColor + "18" }]}>
                        <Icon size={16} color={primaryColor} strokeWidth={2.2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sectionTitle, { color: textPrimary }]}>{section.title}</Text>
                        <Text style={[styles.sectionType, { color: textSecondary }]}>{meta.label}</Text>
                      </View>
                      <View style={styles.orderBtns}>
                        <TouchableOpacity disabled={idx === 0} onPress={() => handleReorder(section.id, "up")} style={{ opacity: idx === 0 ? 0.3 : 1 }}>
                          <ChevronUp size={16} color={textSecondary} strokeWidth={2.3} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          disabled={idx === sections.length - 1}
                          onPress={() => handleReorder(section.id, "down")}
                          style={{ opacity: idx === sections.length - 1 ? 0.3 : 1 }}
                        >
                          <ChevronDown size={16} color={textSecondary} strokeWidth={2.3} />
                        </TouchableOpacity>
                      </View>
                      {confirmDeleteId === section.id ? (
                        <View style={styles.confirmRow}>
                          <TouchableOpacity onPress={() => handleDelete(section.id)}>
                            <Text style={{ color: dangerColor, fontSize: 12, fontWeight: "700" }}>Borrar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setConfirmDeleteId(null)}>
                            <Text style={{ color: textSecondary, fontSize: 12, fontWeight: "700" }}>Cancelar</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity onPress={() => setConfirmDeleteId(section.id)} hitSlop={6}>
                          <Trash2 size={16} color={textSecondary} strokeWidth={2.2} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {meta.needsSource && (
                      <View style={styles.sourceRow}>
                        <Text style={[styles.sourceText, { color: textSecondary }]}>Fuente: {sourceCount}</Text>
                        <TouchableOpacity onPress={() => setSourcePickerFor(section)}>
                          <Text style={{ color: primaryColor, fontSize: 12.5, fontWeight: "700" }}>Cambiar fuente</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {section.type === "dashboard" && (
                      <>
                        <TextInput
                          value={promptDrafts[section.id] ?? ""}
                          onChangeText={(text) => setPromptDrafts((prev) => ({ ...prev, [section.id]: text }))}
                          onBlur={() => handleSavePrompt(section)}
                          placeholder="Prompt de comportamiento extra (ej. tono formal, resumen ejecutivo)…"
                          placeholderTextColor={textSecondary}
                          multiline
                          style={[styles.promptInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }, isWeb && ({ outlineStyle: "none" } as any)]}
                        />

                        {section.generatedContent && (
                          <View style={[styles.previewBox, { borderColor: border }]}>
                            <Text style={[styles.previewText, { color: textPrimary }]} numberOfLines={3}>
                              {section.generatedContent.summary}
                            </Text>
                            <Text style={[styles.previewMeta, { color: textSecondary }]}>Actualizado {section.generatedAt ? formatDateTime(section.generatedAt) : ""}</Text>
                          </View>
                        )}

                        {!hasSource && <Text style={[styles.liveNote, { color: textSecondary }]}>Elige al menos un proyecto o equipo para poder generar.</Text>}

                        <TouchableOpacity
                          activeOpacity={0.85}
                          disabled={generatingId === section.id || !hasSource}
                          style={[styles.generateBtn, { backgroundColor: primaryColor, opacity: generatingId === section.id || !hasSource ? 0.5 : 1 }]}
                          onPress={() => handleGenerate(section)}
                        >
                          <Sparkles size={14} color="#FFF" strokeWidth={2.3} />
                          <Text style={styles.generateBtnText}>
                            {generatingId === section.id ? "Generando…" : section.generatedContent ? "Regenerar" : "Generar"}
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {(section.type === "requests_summary" || section.type === "chat_preview" || section.type === "deliverables") && (
                      <Text style={[styles.liveNote, { color: textSecondary }]}>Se arma automáticamente en vivo, sin configuración.</Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <ClientWidgetTypePickerModal visible={showTypePicker} isDark={isDark} onClose={() => setShowTypePicker(false)} onSelect={handleSelectType} />

      {sourcePickerFor && (
        <ClientSourcePickerModal
          visible={!!sourcePickerFor}
          isDark={isDark}
          organizationId={organization.id}
          initialProjectIds={sourcePickerFor.config?.projectIds ?? []}
          initialTeamIds={sourcePickerFor.config?.teamIds ?? []}
          onClose={() => setSourcePickerFor(null)}
          onApply={handleApplySource}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  subtitle: { fontSize: 12, fontWeight: "600" },
  title: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3, marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { color: "#FFF", fontSize: 12.5, fontWeight: "700" },

  errorText: { fontSize: 12.5, fontWeight: "600", marginBottom: 12 },

  emptyCard: { borderWidth: 1, borderRadius: 24, padding: 28, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  emptySubtitle: { fontSize: 12.5, textAlign: "center", lineHeight: 18 },

  sectionCard: { borderWidth: 1, borderRadius: 22, padding: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconWrap: { width: 34, height: 34, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 14.5, fontWeight: "700" },
  sectionType: { fontSize: 11.5, marginTop: 1 },
  orderBtns: { flexDirection: "row", gap: 2 },
  confirmRow: { flexDirection: "row", alignItems: "center", gap: 10 },

  sourceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  sourceText: { fontSize: 12 },

  promptInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, minHeight: 60, textAlignVertical: "top", marginTop: 12 },
  previewBox: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 10, gap: 6 },
  previewText: { fontSize: 12.5, lineHeight: 18 },
  previewMeta: { fontSize: 10.5 },
  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 999, paddingVertical: 11, marginTop: 12 },
  generateBtnText: { color: "#FFF", fontSize: 12.5, fontWeight: "700" },

  liveNote: { fontSize: 11.5, marginTop: 10, fontStyle: "italic" },
});
