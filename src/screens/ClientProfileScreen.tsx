import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { LogOut, Plus } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import ProfileEditorForm from "../components/ProfileEditorForm";

// Perfil del cliente — reusa ProfileEditorForm tal cual (self-contained, no
// es específico de organización) y agrega el punto de entrada "Agregar
// espacio" (docs/CLIENTE.md §2), mismo que en BottomTabs/ClientTabs vía
// SpaceSwitcher pero también accesible acá para quien no lo haya visto ahí.
export default function ClientProfileScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const { user, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const bg            = isDark ? "#0B1220" : "#F1F5FA";
  const cardBg        = isDark ? "rgba(17, 24, 39, 0.6)" : "rgba(255, 255, 255, 0.6)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const AZURE_DEEP     = "#2C7BD1";

  const displayName: string = (user?.user_metadata as any)?.full_name ?? "";

  const handleSignOut = async () => {
    await signOut();
    navigation.getParent()?.reset({ index: 0, routes: [{ name: "Landing" }] });
  };

  if (!user) return null;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: isMobile ? 16 : 32 }}>
        <View style={{ width: "100%", maxWidth: 640, alignSelf: "center" }}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: textPrimary }]}>Tu perfil</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.iconBtn, { backgroundColor: cardBg, borderColor: border }]}
              onPress={handleSignOut}
            >
              <LogOut size={18} color={textSecondary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.addSpaceRow, { backgroundColor: cardBg, borderColor: border }]}
            onPress={() => navigation.navigate("AddSpace")}
          >
            <View style={[styles.addSpaceIcon, { backgroundColor: isDark ? "rgba(126,200,245,0.14)" : "rgba(44,123,209,0.08)" }]}>
              <Plus size={16} color={AZURE_DEEP} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.addSpaceTitle, { color: textPrimary }]}>¿Tienes más de un proyecto en Nexus?</Text>
              <Text style={[styles.addSpaceSubtitle, { color: textSecondary }]}>Agrégalo aquí con su código.</Text>
            </View>
          </TouchableOpacity>

          <ProfileEditorForm
            isDark={isDark}
            userId={user.id}
            displayName={displayName}
            submitLabel="Guardar cambios"
            onSaved={() => {}}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  iconBtn: { width: 42, height: 42, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  addSpaceRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 20 },
  addSpaceIcon: { width: 34, height: 34, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  addSpaceTitle: { fontSize: 13.5, fontWeight: "700" },
  addSpaceSubtitle: { fontSize: 12, marginTop: 2 },
});
