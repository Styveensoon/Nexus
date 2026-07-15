import React from "react";
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Sparkles } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

// Home del cliente (docs/CLIENTE.md §3) — estado inicial: bienvenida vacía
// pero cálida, priorizando la parte humana sobre el contenido funcional. Las
// secciones armadas por el equipo (Dashboard con IA, etc.) se agregan en una
// ronda posterior (client_home_sections) — este componente se reescribe
// entonces para renderizarlas en vez de solo mostrar el estado vacío.
export default function ClientHomeScreen() {
  const { isDark } = useTheme();
  const { organization, user } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const bg            = isDark ? "#0B1220" : "#F1F5FA";
  const cardBg        = isDark ? "rgba(17, 24, 39, 0.6)" : "rgba(255, 255, 255, 0.6)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";

  const firstName = (user?.user_metadata as any)?.full_name?.trim?.().split(" ")[0] || "ahí";

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: isMobile ? 16 : 32 }}>
        <View style={{ width: "100%", maxWidth: 720, alignSelf: "center", alignItems: "center", paddingTop: isMobile ? 24 : 64 }}>
          <View style={[styles.orgAvatar, { backgroundColor: organization?.color ?? "#2C7BD1" }]}>
            {organization?.logo_url ? (
              <Image source={{ uri: organization.logo_url }} style={styles.orgAvatarImage} />
            ) : (
              <Sparkles size={30} color="#FFF" strokeWidth={2.2} />
            )}
          </View>

          <Text style={[styles.greeting, { color: textPrimary }]}>¡Hola, {firstName}!</Text>
          <Text style={[styles.orgName, { color: textSecondary }]}>{organization?.name ?? "Tu proyecto"}</Text>

          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.message, { color: textPrimary }]}>
              Estamos trabajando en tu proyecto, pronto tendremos resultados…
            </Text>
            <Text style={[styles.submessage, { color: textSecondary }]}>
              Cuando tu equipo agregue novedades a este espacio, las vas a ver acá.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  orgAvatar: { width: 72, height: 72, borderRadius: 24, justifyContent: "center", alignItems: "center", overflow: "hidden", marginBottom: 20 },
  orgAvatarImage: { width: 72, height: 72 },
  greeting: { fontSize: 24, fontWeight: "700", letterSpacing: -0.5, textAlign: "center" },
  orgName: { fontSize: 14, fontWeight: "600", marginTop: 4, marginBottom: 32, textAlign: "center" },
  card: { width: "100%", borderRadius: 28, borderWidth: 1, padding: 32, alignItems: "center", gap: 8 },
  message: { fontSize: 17, fontWeight: "600", textAlign: "center", lineHeight: 26 },
  submessage: { fontSize: 13.5, textAlign: "center", lineHeight: 20 },
});
