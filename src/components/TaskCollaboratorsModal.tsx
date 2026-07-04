import React, { useMemo, useState } from "react";
import { Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Check, Plus, Search, User, X } from "lucide-react-native";
import { OrganizationMemberProfile } from "../lib/organizations";
import { TaskCollaborator } from "../lib/tasks";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

type Props = {
  visible: boolean;
  isDark: boolean;
  primaryColor: string;
  orgMembers: OrganizationMemberProfile[];
  collaborators: TaskCollaborator[];
  busyUserId: string | null;
  onToggle: (member: OrganizationMemberProfile) => void;
  onClose: () => void;
};

// Picker de "colaboradores adicionales" de una task (Punto 3 del feedback) —
// mismo lenguaje visual de buscador + lista que otros pickers de la app
// (TimezoneModal, TeamScreen), pero de selección múltiple con toggle directo
// en la fila en vez de autocerrarse al elegir.
export default function TaskCollaboratorsModal({
  visible,
  isDark,
  primaryColor,
  orgMembers,
  collaborators,
  busyUserId,
  onToggle,
  onClose,
}: Props) {
  const [search, setSearch] = useState("");
  const isWeb = Platform.OS === "web";

  const cardBg        = isDark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.92)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";

  const collaboratorIds = useMemo(() => new Set(collaborators.map((c) => c.userId)), [collaborators]);

  const filtered = orgMembers.filter((m) => m.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: textPrimary }]}>Agregar colaboradores</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={18} color={textSecondary} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchWrapper, { backgroundColor: inputBg, borderColor: border }]}>
            <Search size={16} color={textSecondary} strokeWidth={2.2} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar por nombre…"
              placeholderTextColor={textSecondary}
              style={[styles.searchInput, { color: textPrimary }, isWeb && styles.noOutline]}
            />
          </View>

          <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
            {filtered.length === 0 ? (
              <Text style={{ color: textSecondary, fontSize: 13, textAlign: "center", paddingVertical: 16 }}>
                No se encontró a nadie con ese nombre.
              </Text>
            ) : (
              filtered.map((member) => {
                const isCollaborator = collaboratorIds.has(member.userId);
                const busy = busyUserId === member.userId;
                return (
                  <TouchableOpacity
                    key={member.userId}
                    activeOpacity={0.8}
                    disabled={busy}
                    onPress={() => onToggle(member)}
                    style={[styles.row, { backgroundColor: inputBg, borderColor: border, opacity: busy ? 0.6 : 1 }]}
                  >
                    <View style={[styles.avatar, { backgroundColor: member.avatarColor }]}>
                      <Text style={styles.avatarText}>{initials(member.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textPrimary, fontSize: 13.5, fontWeight: "700" }} numberOfLines={1}>
                        {member.name}
                      </Text>
                      {(member.customRole || member.role) && (
                        <Text style={{ color: textSecondary, fontSize: 11.5 }} numberOfLines={1}>
                          {member.customRole || member.role}
                        </Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.toggleBtn,
                        { backgroundColor: isCollaborator ? primaryColor : "transparent", borderColor: isCollaborator ? primaryColor : border },
                      ]}
                    >
                      {isCollaborator ? <Check size={14} color="#FFF" strokeWidth={2.5} /> : <Plus size={14} color={textSecondary} strokeWidth={2.3} />}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(2, 6, 23, 0.5)", alignItems: "center", justifyContent: "center", padding: 20,
    ...Platform.select({ web: { backdropFilter: "blur(4px)" } as any, default: {} }),
  },
  card: { width: "100%", maxWidth: 420, borderRadius: 24, borderWidth: 1, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 16, fontWeight: "700" },
  searchWrapper: {
    flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 13.5 },
  noOutline: { outlineStyle: "none" } as any,
  row: {
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
  },
  avatar: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  toggleBtn: { width: 26, height: 26, borderRadius: 9, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
});
