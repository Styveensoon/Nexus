import React from "react";
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Sparkles } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import ClientChatThread from "../components/ClientChatThread";

// Chat real (docs/CLIENTE.md §5) — el cliente habla con quien esté asignado a
// su espacio (client_assignments). ClientChatThread es self-contained y se
// reusa tal cual del lado staff (ClientDetailScreen), solo cambia quién es
// currentUserId respecto a clientUserId.
export default function ClientChatScreen() {
  const { isDark } = useTheme();
  const { organization, user } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const bg            = isDark ? "#0B1220" : "#F1F5FA";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";

  if (!organization || !user) return null;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: isMobile ? 16 : 32 }}>
        <View style={{ width: "100%", maxWidth: 720, alignSelf: "center" }}>
          <View style={styles.header}>
            <View style={[styles.orgAvatar, { backgroundColor: organization.color }]}>
              {organization.logo_url ? (
                <Image source={{ uri: organization.logo_url }} style={styles.orgAvatarImage} />
              ) : (
                <Sparkles size={18} color="#FFF" strokeWidth={2.2} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: textPrimary }]}>{organization.name}</Text>
              <Text style={[styles.subtitle, { color: textSecondary }]}>Chat con el equipo que atiende tu proyecto</Text>
            </View>
          </View>

          <ClientChatThread
            organizationId={organization.id}
            clientUserId={user.id}
            currentUserId={user.id}
            isDark={isDark}
            maxHeight={isMobile ? 340 : 460}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  orgAvatar: { width: 44, height: 44, borderRadius: 16, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  orgAvatarImage: { width: 44, height: 44 },
  title: { fontSize: 18, fontWeight: "700", letterSpacing: -0.3 },
  subtitle: { fontSize: 12.5, marginTop: 2 },
});
