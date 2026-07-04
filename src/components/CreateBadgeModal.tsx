import React, { useState } from "react";
import { Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Check, Palette, X } from "lucide-react-native";
import { getContrastTextColor } from "../lib/profiles";
import { BADGE_ICONS } from "./BadgePill";
import ColorPickerModal from "./ColorPickerModal";

const PRESET_COLORS = ["#2C7BD1", "#7C3AED", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#64748B"];
const ICON_NAMES = Object.keys(BADGE_ICONS);

type Props = {
  visible: boolean;
  isDark: boolean;
  saving: boolean;
  errorText: string | null;
  onClose: () => void;
  onCreate: (params: { label: string; description: string; icon: string; color: string }) => void;
};

// Crear un badge propio de la organización (Punto 5 del feedback: CRUD
// completo, no solo ver/asignar) — el catálogo de íconos se acota a los que
// ya soporta BADGE_ICONS (BadgePill.tsx, 24 en total: los 10 del catálogo
// fijo + 14 extra pensados para reconocimientos) para no tener que mapear
// íconos nuevos de lucide en el resto de la app. El color acepta los 7
// rápidos de siempre o cualquier hex vía "Personalizar color" (mismo
// ColorPickerModal que usa IconColorPicker para equipos/proyectos).
export default function CreateBadgeModal({ visible, isDark, saving, errorText, onClose, onCreate }: Props) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState(ICON_NAMES[0]);
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const cardBg        = isDark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.92)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";
  const isWeb = Platform.OS === "web";

  const reset = () => {
    setLabel("");
    setDescription("");
    setIcon(ICON_NAMES[0]);
    setColor(PRESET_COLORS[0]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    if (!label.trim()) return;
    onCreate({ label: label.trim(), description: description.trim(), icon, color });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.overlayScroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: textPrimary }]}>Crear badge</Text>
              <TouchableOpacity onPress={handleClose} hitSlop={8}>
                <X size={18} color={textSecondary} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            <View style={[styles.previewPill, { backgroundColor: color }]}>
              {(() => {
                const Icon = BADGE_ICONS[icon] ?? BADGE_ICONS.Users;
                return <Icon size={14} color={getContrastTextColor(color)} strokeWidth={2.2} />;
              })()}
              <Text style={{ color: getContrastTextColor(color), fontSize: 12.5, fontWeight: "700" }}>
                {label.trim() || "Nombre del badge"}
              </Text>
            </View>

            <Text style={[styles.label, { color: textSecondary }]}>Nombre</Text>
            <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: border }]}>
              <TextInput
                value={label}
                onChangeText={setLabel}
                placeholder="Ej. Madrugador/a"
                placeholderTextColor={textSecondary}
                style={[styles.input, { color: textPrimary }, isWeb && styles.noOutline]}
              />
            </View>

            <Text style={[styles.label, { color: textSecondary }]}>Descripción</Text>
            <View style={[styles.textAreaWrapper, { backgroundColor: inputBg, borderColor: border }]}>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="¿Qué reconoce este badge?"
                placeholderTextColor={textSecondary}
                multiline
                style={[styles.textArea, { color: textPrimary }, isWeb && styles.noOutline]}
              />
            </View>

            <Text style={[styles.label, { color: textSecondary }]}>Ícono</Text>
            <View style={styles.iconRow}>
              {ICON_NAMES.map((name) => {
                const Icon = BADGE_ICONS[name];
                const selected = icon === name;
                return (
                  <TouchableOpacity
                    key={name}
                    activeOpacity={0.8}
                    onPress={() => setIcon(name)}
                    style={[styles.iconSwatch, { backgroundColor: selected ? color : inputBg, borderColor: selected ? color : border }]}
                  >
                    <Icon size={16} color={selected ? getContrastTextColor(color) : textSecondary} strokeWidth={2.2} />
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { color: textSecondary }]}>Color</Text>
            <View style={styles.colorRow}>
              {PRESET_COLORS.map((c) => (
                <TouchableOpacity key={c} activeOpacity={0.8} onPress={() => setColor(c)} style={[styles.colorSwatch, { backgroundColor: c }]}>
                  {color.toUpperCase() === c.toUpperCase() && <Check size={14} color="#FFF" strokeWidth={2.3} />}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowColorPicker(true)}
                style={[
                  styles.customSwatch,
                  { borderColor: border, backgroundColor: !PRESET_COLORS.some((c) => c.toUpperCase() === color.toUpperCase()) ? color : inputBg },
                ]}
              >
                {!PRESET_COLORS.some((c) => c.toUpperCase() === color.toUpperCase()) ? (
                  <Check size={14} color="#FFF" strokeWidth={2.3} />
                ) : (
                  <Palette size={14} color={textSecondary} strokeWidth={2.2} />
                )}
              </TouchableOpacity>
            </View>
            <Text style={[styles.hexLabel, { color: textSecondary }]}>{color.toUpperCase()}</Text>

            {errorText && <Text style={styles.errorText}>{errorText}</Text>}

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={saving || !label.trim()}
              style={[styles.submitBtn, { backgroundColor: color, opacity: saving || !label.trim() ? 0.6 : 1 }]}
              onPress={handleSubmit}
            >
              <Text style={{ color: getContrastTextColor(color), fontWeight: "700", fontSize: 14 }}>
                {saving ? "Creando…" : "Crear badge"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      <ColorPickerModal
        visible={showColorPicker}
        initialColor={color}
        isDark={isDark}
        onClose={() => setShowColorPicker(false)}
        onConfirm={(hex) => {
          setColor(hex);
          setShowColorPicker(false);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(2, 6, 23, 0.5)", alignItems: "center", justifyContent: "center", padding: 20,
    ...Platform.select({ web: { backdropFilter: "blur(4px)" } as any, default: {} }),
  },
  overlayScroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", width: "100%" },
  card: { width: "100%", maxWidth: 420, borderRadius: 24, borderWidth: 1, padding: 22 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 16, fontWeight: "700" },
  previewPill: {
    flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start", borderRadius: 999,
    paddingHorizontal: 13, paddingVertical: 8, marginBottom: 18,
  },
  label: { fontSize: 12.5, fontWeight: "700", marginBottom: 8 },
  inputWrapper: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, marginBottom: 16 },
  input: { paddingVertical: 12, fontSize: 13.5 },
  textAreaWrapper: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  textArea: { minHeight: 50, fontSize: 13.5, textAlignVertical: "top" },
  noOutline: { outlineStyle: "none" } as any,
  iconRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  iconSwatch: { width: 34, height: 34, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10, alignItems: "center" },
  colorSwatch: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  customSwatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  hexLabel: { fontSize: 11.5, fontWeight: "700", letterSpacing: 0.5, marginBottom: 20 },
  errorText: { color: "#EF4444", fontSize: 12.5, fontWeight: "600", marginBottom: 14 },
  submitBtn: { alignItems: "center", justifyContent: "center", borderRadius: 999, paddingVertical: 14 },
});
