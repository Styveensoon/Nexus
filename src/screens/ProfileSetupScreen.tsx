import React from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import ProfileEditorForm from "../components/ProfileEditorForm";

export default function ProfileSetupScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = Platform.OS === "web";

  const bg            = isDark ? "#020617" : "#FAFAFA";
  const textPrimary   = isDark ? "#F8FAFC" : "#020617";
  const textSecondary = isDark ? "#94A3B8" : "#475569";

  const containerStyle: any = isWeb
    ? { backgroundColor: bg, height: "100vh", width: "100%" }
    : { flex: 1, backgroundColor: bg };

  if (!user) return null;

  const displayName: string = user.user_metadata?.full_name ?? "";

  return (
    <View style={containerStyle}>
      {isWeb && (
        <View style={styles.backgroundTextureContainer} pointerEvents="none">
          <View style={[styles.glowOrb, { top: -150, left: "-10%", backgroundColor: isDark ? "rgba(37, 99, 235, 0.15)" : "rgba(37, 99, 235, 0.08)" }]} />
          <View style={[styles.glowOrb, { bottom: -200, right: "-10%", backgroundColor: isDark ? "rgba(124, 58, 237, 0.12)" : "rgba(124, 58, 237, 0.05)" }]} />
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: isMobile ? 20 : 40, paddingVertical: 48 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: "100%", maxWidth: 560 }}>
            <View style={styles.logoRow}>
              <Image source={require("../../assets/images/nexus-logo.png")} style={styles.logoIcon} resizeMode="contain" />
              <Text style={[styles.logoText, { color: textPrimary }]}>Nexus</Text>
            </View>

            <Text style={[styles.title, { color: textPrimary }]}>Personaliza tu perfil</Text>
            <Text style={[styles.subtitle, { color: textSecondary }]}>
              Así es como te va a conocer tu equipo. Esto alimenta al futuro Semillero IA.
            </Text>

            <ProfileEditorForm
              isDark={isDark}
              userId={user.id}
              displayName={displayName}
              submitLabel="Guardar y continuar"
              onSaved={() => navigation.replace("Main")}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  backgroundTextureContainer: {
    position: "absolute", width: "100%", height: "100%", overflow: "hidden", zIndex: -1,
  },
  glowOrb: {
    position: "absolute", width: 700, height: 700, borderRadius: 350, filter: "blur(150px)",
  } as any,
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 32 },
  logoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#2563EB", justifyContent: "center", alignItems: "center" },
  logoText: { fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  title: { fontSize: 32, fontWeight: "900", letterSpacing: -1, marginBottom: 8 },
  subtitle: { fontSize: 16, lineHeight: 24, marginBottom: 32 },
});
