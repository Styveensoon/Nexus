import React, { useState } from "react";
import { Building2, Check, ChevronDown, Handshake, Plus, X } from "lucide-react-native";
import { Image, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSpace } from "../context/SpaceContext";
import { Space, spaceKey } from "../lib/spaces";

// Selector de espacio (docs/CLIENTE.md §2) — visible SIEMPRE en el header/nav
// de los dos shells (BottomTabs.tsx para miembros, ClientTabs.tsx para
// clientes), no solo cuando ya hay 2+ espacios: sirve también como el punto
// de entrada a "Agregar espacio" para quien todavía tiene uno solo.
type Props = {
  isDark: boolean;
  navigation: any;
  compact?: boolean; // true en la barra móvil (solo ícono, sin nombre al lado)
};

export default function SpaceSwitcher({ isDark, navigation, compact }: Props) {
  const { spaces, activeSpace, setActiveSpace } = useSpace();
  const [visible, setVisible] = useState(false);

  const cardBg        = isDark ? "rgba(15,23,42,0.9)" : "rgba(255,255,255,0.92)";
  const border         = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary    = isDark ? "#F8FAFC" : "#101828";
  const textSecondary  = isDark ? "#94A3B8" : "#5B6472";
  const inputBg        = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";
  const AZURE_DEEP      = "#2C7BD1";

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

  const handleSelect = (space: Space) => {
    setActiveSpace(space);
    setVisible(false);
  };

  const handleAddSpace = () => {
    setVisible(false);
    navigation.navigate("AddSpace");
  };

  if (!activeSpace) return null;

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.trigger, { backgroundColor: inputBg, borderColor: border }]}
        onPress={() => setVisible(true)}
      >
        <View style={[styles.triggerAvatar, { backgroundColor: activeSpace.organization.color }]}>
          {activeSpace.organization.logo_url ? (
            <Image source={{ uri: activeSpace.organization.logo_url }} style={styles.triggerAvatarImage} />
          ) : activeSpace.kind === "client" ? (
            <Handshake size={14} color="#FFF" strokeWidth={2.4} />
          ) : (
            <Building2 size={14} color="#FFF" strokeWidth={2.4} />
          )}
        </View>
        {!compact && (
          <Text style={[styles.triggerText, { color: textPrimary }]} numberOfLines={1}>
            {activeSpace.organization.name}
          </Text>
        )}
        <ChevronDown size={14} color={textSecondary} strokeWidth={2.4} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setVisible(false)} />
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: textPrimary }]}>Tus espacios</Text>
              <TouchableOpacity onPress={() => setVisible(false)} hitSlop={8}>
                <X size={20} color={textSecondary} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 6 }}>
              {spaces.map((space) => {
                const selected = activeSpace && spaceKey(space) === spaceKey(activeSpace);
                return (
                  <TouchableOpacity
                    key={spaceKey(space)}
                    activeOpacity={0.8}
                    onPress={() => handleSelect(space)}
                    style={[styles.row, { backgroundColor: selected ? AZURE_DEEP + "14" : "transparent" }]}
                  >
                    <View style={[styles.rowAvatar, { backgroundColor: space.organization.color }]}>
                      {space.organization.logo_url ? (
                        <Image source={{ uri: space.organization.logo_url }} style={styles.rowAvatarImage} />
                      ) : space.kind === "client" ? (
                        <Handshake size={16} color="#FFF" strokeWidth={2.3} />
                      ) : (
                        <Building2 size={16} color="#FFF" strokeWidth={2.3} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowName, { color: textPrimary }]} numberOfLines={1}>
                        {space.organization.name}
                      </Text>
                      <Text style={[styles.rowKind, { color: textSecondary }]}>
                        {space.kind === "client" ? "Cliente" : space.role === "owner" ? "Owner" : "Miembro"}
                      </Text>
                    </View>
                    {selected && <Check size={16} color={AZURE_DEEP} strokeWidth={2.4} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity activeOpacity={0.8} style={[styles.addRow, { borderColor: border }]} onPress={handleAddSpace}>
              <Plus size={16} color={AZURE_DEEP} strokeWidth={2.4} />
              <Text style={[styles.addRowText, { color: AZURE_DEEP }]}>Agregar espacio</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 6, maxWidth: 200,
  },
  triggerAvatar: { width: 20, height: 20, borderRadius: 7, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  triggerAvatarImage: { width: 20, height: 20 },
  triggerText: { fontSize: 12.5, fontWeight: "700", flexShrink: 1 },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    ...Platform.select({ web: { backdropFilter: "blur(4px)" } as any, default: {} }),
  },
  card: { width: "100%", maxWidth: 360, borderRadius: 28, borderWidth: 1, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title: { fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 10 },
  rowAvatar: { width: 34, height: 34, borderRadius: 12, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  rowAvatarImage: { width: 34, height: 34 },
  rowName: { fontSize: 14, fontWeight: "700" },
  rowKind: { fontSize: 11.5, marginTop: 1 },
  addRow: {
    flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, marginTop: 12, paddingTop: 14,
    justifyContent: "center",
  },
  addRowText: { fontSize: 13.5, fontWeight: "700" },
});
