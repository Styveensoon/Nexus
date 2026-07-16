import React, { useMemo, useState } from "react";
import { Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Check, Search, X } from "lucide-react-native";
import { LANGUAGE_OPTIONS } from "../lib/profiles";

const AZURE_DEEP = "#2C7BD1";

// Mismo patrón que TimezoneModal.tsx (overlay + buscador + lista), pero
// multi-selección: tocar una fila la agrega/quita en vez de cerrar el modal.
type Props = {
  visible: boolean;
  isDark: boolean;
  selected: string[];
  onClose: () => void;
  onToggle: (language: string) => void;
};

export default function LanguageModal({ visible, isDark, selected, onClose, onToggle }: Props) {
  const [query, setQuery] = useState("");

  const cardBg        = isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.85)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = AZURE_DEEP;
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGE_OPTIONS;
    return LANGUAGE_OPTIONS.filter((lang) => lang.toLowerCase().includes(q));
  }, [query]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: textPrimary }]}>Idiomas</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color={textSecondary} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchWrapper, { backgroundColor: inputBg, borderColor: border }]}>
            <Search size={16} color={textSecondary} strokeWidth={2.2} />
            <TextInput
              placeholder="Busca un idioma"
              placeholderTextColor={textSecondary}
              value={query}
              onChangeText={setQuery}
              style={[styles.searchInput, { color: textPrimary }, Platform.OS === "web" && styles.noOutline]}
            />
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {filtered.map((lang) => {
              const active = selected.includes(lang);
              return (
                <TouchableOpacity key={lang} activeOpacity={0.8} onPress={() => onToggle(lang)} style={[styles.row, { borderBottomColor: border }]}>
                  <Text style={[styles.rowLabel, { color: textPrimary }]} numberOfLines={1}>
                    {lang}
                  </Text>
                  {active && <Check size={18} color={primaryColor} strokeWidth={2.3} />}
                </TouchableOpacity>
              );
            })}
            {filtered.length === 0 && (
              <Text style={[styles.empty, { color: textSecondary }]}>No encontramos ese idioma.</Text>
            )}
          </ScrollView>
        </View>
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
  card: { width: "100%", maxWidth: 380, maxHeight: "80%", borderRadius: 28, borderWidth: 1, padding: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 17, fontWeight: "700", letterSpacing: -0.3 },
  searchWrapper: {
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, marginBottom: 12,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14 },
  noOutline: { outlineStyle: "none" } as any,
  list: { maxHeight: 320 },
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 14, fontWeight: "600" },
  empty: { textAlign: "center", fontSize: 13, paddingVertical: 24 },
});
