import React, { useMemo, useState } from "react";
import { Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Check, Search, X } from "lucide-react-native";
import { TIMEZONE_OPTIONS } from "../lib/profiles";

type Props = {
  visible: boolean;
  isDark: boolean;
  selectedId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
};

export default function TimezoneModal({ visible, isDark, selectedId, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");

  const cardBg        = isDark ? "#0F172A" : "#FFFFFF";
  const border        = isDark ? "rgba(51, 65, 85, 0.6)" : "rgba(226, 232, 240, 0.9)";
  const textPrimary   = isDark ? "#F8FAFC" : "#020617";
  const textSecondary = isDark ? "#94A3B8" : "#475569";
  const primaryColor  = "#2563EB";
  const inputBg       = isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TIMEZONE_OPTIONS;
    return TIMEZONE_OPTIONS.filter((tz) => tz.label.toLowerCase().includes(q) || tz.offset.toLowerCase().includes(q));
  }, [query]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: textPrimary }]}>Zona horaria</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color={textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchWrapper, { backgroundColor: inputBg, borderColor: border }]}>
            <Search size={16} color={textSecondary} />
            <TextInput
              placeholder="Busca tu ciudad o país"
              placeholderTextColor={textSecondary}
              value={query}
              onChangeText={setQuery}
              style={[styles.searchInput, { color: textPrimary }, Platform.OS === "web" && styles.noOutline]}
            />
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {filtered.map((tz) => (
              <TouchableOpacity key={tz.id} activeOpacity={0.8} onPress={() => onSelect(tz.id)} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: textPrimary }]} numberOfLines={1}>
                    {tz.label}
                  </Text>
                  <Text style={[styles.rowOffset, { color: textSecondary }]}>{tz.offset}</Text>
                </View>
                {selectedId === tz.id && <Check size={18} color={primaryColor} />}
              </TouchableOpacity>
            ))}
            {filtered.length === 0 && (
              <Text style={[styles.empty, { color: textSecondary }]}>No encontramos esa zona horaria.</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(2, 6, 23, 0.6)", alignItems: "center", justifyContent: "center", padding: 20,
  },
  card: { width: "100%", maxWidth: 380, maxHeight: "80%", borderRadius: 24, borderWidth: 1, padding: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  searchWrapper: {
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, marginBottom: 12,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14 },
  noOutline: { outlineStyle: "none" } as any,
  list: { maxHeight: 320 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(148,163,184,0.25)",
  },
  rowLabel: { fontSize: 14, fontWeight: "700" },
  rowOffset: { fontSize: 12, marginTop: 2 },
  empty: { textAlign: "center", fontSize: 13, paddingVertical: 24 },
});
