import React, { useEffect, useState } from "react";
import { Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Sparkles, X } from "lucide-react-native";
import ClientSourcePickerModal from "./ClientSourcePickerModal";
import { ClientDocument, generateClientDocument } from "../lib/clientDocuments";

// Generar/regenerar el documento de una solicitud puntual (docs/CLIENTE.md
// §7) — reactivo, a diferencia del widget Dashboard: el cliente ya pidió
// esto vía Solicitudes, el staff elige fuente + prompt y genera acá.
type Props = {
  visible: boolean;
  isDark: boolean;
  organizationId: string;
  clientUserId: string;
  requestId: string;
  defaultTitle: string;
  existingDocument: ClientDocument | null;
  actorId: string;
  onClose: () => void;
  onGenerated: () => void;
};

export default function ClientDocumentGenerateModal({
  visible,
  isDark,
  organizationId,
  clientUserId,
  requestId,
  defaultTitle,
  existingDocument,
  actorId,
  onClose,
  onGenerated,
}: Props) {
  const [title, setTitle] = useState(defaultTitle);
  const [extraPrompt, setExtraPrompt] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const cardBg        = isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.85)";
  const inputBg       = isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.6)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = "#2C7BD1";
  const dangerColor   = "#EF4444";
  const isWeb = Platform.OS === "web";

  useEffect(() => {
    if (!visible) return;
    setTitle(existingDocument?.title ?? defaultTitle);
    setExtraPrompt(existingDocument?.extraPrompt ?? "");
    setProjectIds(existingDocument?.source.projectIds ?? []);
    setTeamIds(existingDocument?.source.teamIds ?? []);
    setErrorText(null);
  }, [visible, existingDocument, defaultTitle]);

  const handleGenerate = async () => {
    if (!title.trim()) return;
    setGenerating(true);
    setErrorText(null);
    const { error } = await generateClientDocument({
      organizationId,
      clientUserId,
      requestId,
      title: title.trim(),
      extraPrompt,
      projectIds,
      teamIds,
      actorId,
      existingDocumentId: existingDocument?.id ?? null,
    });
    setGenerating(false);
    if (error) {
      setErrorText("No se pudo generar el documento, intenta de nuevo.");
      return;
    }
    onGenerated();
    onClose();
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
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <ScrollView style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]} contentContainerStyle={{ padding: 20 }}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: textPrimary }]}>{existingDocument ? "Regenerar documento" : "Generar documento con IA"}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <X size={20} color={textSecondary} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: textSecondary }]}>Título</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrimary }, isWeb && ({ outlineStyle: "none" } as any)]}
            />

            <Text style={[styles.label, { color: textSecondary }]}>Fuente de datos</Text>
            <TouchableOpacity activeOpacity={0.8} style={[styles.sourceBtn, { backgroundColor: inputBg, borderColor: border }]} onPress={() => setShowSourcePicker(true)}>
              <Text style={{ color: textPrimary, fontSize: 13, fontWeight: "600" }}>
                {projectIds.length} proyectos, {teamIds.length} equipos
              </Text>
              <Text style={{ color: primaryColor, fontSize: 12.5, fontWeight: "700" }}>Elegir</Text>
            </TouchableOpacity>

            <Text style={[styles.label, { color: textSecondary }]}>Prompt de comportamiento extra (opcional)</Text>
            <TextInput
              value={extraPrompt}
              onChangeText={setExtraPrompt}
              placeholder="Ej. tono formal, resumen ejecutivo, no mencionar tareas bloqueadas…"
              placeholderTextColor={textSecondary}
              multiline
              style={[styles.input, styles.textarea, { backgroundColor: inputBg, borderColor: border, color: textPrimary }, isWeb && ({ outlineStyle: "none" } as any)]}
            />

            {!projectIds.length && !teamIds.length && (
              <Text style={{ color: textSecondary, fontSize: 11.5, fontStyle: "italic", marginTop: 8 }}>
                Elige al menos un proyecto o equipo para poder generar.
              </Text>
            )}

            {errorText && <Text style={[styles.errorText, { color: dangerColor }]}>{errorText}</Text>}

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={generating || !title.trim() || (!projectIds.length && !teamIds.length)}
              style={[
                styles.generateBtn,
                { backgroundColor: primaryColor, opacity: generating || !title.trim() || (!projectIds.length && !teamIds.length) ? 0.5 : 1 },
              ]}
              onPress={handleGenerate}
            >
              <Sparkles size={15} color="#FFF" strokeWidth={2.3} />
              <Text style={styles.generateBtnText}>{generating ? "Generando…" : existingDocument ? "Regenerar" : "Generar"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <ClientSourcePickerModal
        visible={showSourcePicker}
        isDark={isDark}
        organizationId={organizationId}
        initialProjectIds={projectIds}
        initialTeamIds={teamIds}
        onClose={() => setShowSourcePicker(false)}
        onApply={(p, t) => {
          setProjectIds(p);
          setTeamIds(t);
          setShowSourcePicker(false);
        }}
      />
    </>
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title: { fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },
  label: { fontSize: 11.5, fontWeight: "700", letterSpacing: 0.3, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13.5 },
  textarea: { minHeight: 80, textAlignVertical: "top" },
  sourceBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  errorText: { fontSize: 12, fontWeight: "600", marginTop: 12 },
  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 999, paddingVertical: 13, marginTop: 18 },
  generateBtnText: { color: "#FFF", fontSize: 13.5, fontWeight: "700" },
});
