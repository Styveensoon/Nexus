import React, { useCallback, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Sparkles } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useSpace } from "../context/SpaceContext";
import { ClientHomeSection, listClientHomeSections } from "../lib/clientHome";
import DashboardWidget from "../components/client-widgets/DashboardWidget";
import ProjectOverviewWidget from "../components/client-widgets/ProjectOverviewWidget";
import RequestsSummaryWidget from "../components/client-widgets/RequestsSummaryWidget";
import ChatPreviewWidget from "../components/client-widgets/ChatPreviewWidget";
import DeliverablesWidget from "../components/client-widgets/DeliverablesWidget";

// Home del cliente (docs/CLIENTE.md §3/§6) — estado inicial: bienvenida vacía
// pero cálida (sin tocar, filosofía anti-fake). En cuanto el equipo asignado
// arma al menos un widget (ClientHomeBuilderScreen, lado staff), esta
// pantalla pasa a listar esos widgets ordenados por posición. Chat y
// Solicitudes siguen siendo tabs propios e intactos — los widgets
// "chat_preview"/"requests_summary" acá son solo teasers con link.
export default function ClientHomeScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  // useAuth().organization es SIEMPRE null acá a propósito (ver AuthContext.tsx
  // — ese alias solo resuelve espacios "member"); las pantallas dentro de
  // ClientTabs necesitan leer la organización del espacio activo "client"
  // vía useSpace(). Bug real encontrado probando en vivo (pantalla en blanco).
  const { activeSpace } = useSpace();
  const organization = activeSpace?.kind === "client" ? activeSpace.organization : null;
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [sections, setSections] = useState<ClientHomeSection[]>([]);
  const [loading, setLoading] = useState(true);

  const bg            = isDark ? "#0B1220" : "#F1F5FA";
  const cardBg        = isDark ? "rgba(17, 24, 39, 0.6)" : "rgba(255, 255, 255, 0.6)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";

  const firstName = (user?.user_metadata as any)?.full_name?.trim?.().split(" ")[0] || "ahí";

  const load = useCallback(async () => {
    if (!organization || !user) return;
    setLoading(true);
    const { data } = await listClientHomeSections(organization.id, user.id);
    setSections(data);
    setLoading(false);
  }, [organization?.id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!organization || !user) return null;

  if (!loading && sections.length === 0) {
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
              <Text style={[styles.message, { color: textPrimary }]}>Estamos trabajando en tu proyecto, pronto tendremos resultados…</Text>
              <Text style={[styles.submessage, { color: textSecondary }]}>Cuando tu equipo agregue novedades a este espacio, las vas a ver acá.</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: isMobile ? 16 : 32 }}>
        <View style={{ width: "100%", maxWidth: 720, alignSelf: "center" }}>
          <Text style={[styles.greeting, styles.greetingLeft, { color: textPrimary }]}>¡Hola, {firstName}!</Text>
          <Text style={[styles.orgName, styles.orgNameLeft, { color: textSecondary }]}>{organization?.name ?? "Tu proyecto"}</Text>

          {loading ? (
            <Text style={{ color: textSecondary, fontSize: 13 }}>Cargando…</Text>
          ) : (
            <View style={{ gap: 16 }}>
              {sections.map((section) => {
                switch (section.type) {
                  case "dashboard":
                    return <DashboardWidget key={section.id} isDark={isDark} section={section} />;
                  case "project_overview":
                    return (
                      <ProjectOverviewWidget key={section.id} isDark={isDark} organizationId={organization.id} clientUserId={user.id} section={section} />
                    );
                  case "requests_summary":
                    return (
                      <RequestsSummaryWidget
                        key={section.id}
                        isDark={isDark}
                        organizationId={organization.id}
                        clientUserId={user.id}
                        onGoToRequests={() => navigation.navigate("ClientRequests")}
                      />
                    );
                  case "chat_preview":
                    return (
                      <ChatPreviewWidget
                        key={section.id}
                        isDark={isDark}
                        organizationId={organization.id}
                        clientUserId={user.id}
                        onGoToChat={() => navigation.navigate("ClientChat")}
                      />
                    );
                  case "deliverables":
                    return <DeliverablesWidget key={section.id} isDark={isDark} organizationId={organization.id} clientUserId={user.id} />;
                  default:
                    return null;
                }
              })}
            </View>
          )}
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
  greetingLeft: { textAlign: "left", marginBottom: 0 },
  orgName: { fontSize: 14, fontWeight: "600", marginTop: 4, marginBottom: 32, textAlign: "center" },
  orgNameLeft: { textAlign: "left", marginBottom: 20 },
  card: { width: "100%", borderRadius: 28, borderWidth: 1, padding: 32, alignItems: "center", gap: 8 },
  message: { fontSize: 17, fontWeight: "600", textAlign: "center", lineHeight: 26 },
  submessage: { fontSize: 13.5, textAlign: "center", lineHeight: 20 },
});
