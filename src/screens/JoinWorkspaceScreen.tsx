import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { ArrowLeft, ArrowRight, Building2, CircleX, Hash } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { getOrganizationByCode, joinOrganization, Organization } from "../lib/organizations";
import { clearPendingOnboarding } from "../lib/supabase";

const WELCOME_MESSAGES = [
  "Los grandes equipos se construyen con las personas correctas. Bienvenido.",
  "Cada gran resultado empieza con el equipo adecuado. Es un buen momento para unirte.",
  "Tu talento suma. El equipo está listo para avanzar contigo.",
  "Aquí las ideas se convierten en resultados. Únete y sé parte de eso.",
  "Un paso más hacia un equipo con visión. Bienvenido a bordo.",
];

export default function JoinWorkspaceScreen({ navigation, route }: any) {
  const { isDark } = useTheme();
  const { user, refreshOrganization } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = Platform.OS === "web";

  const initialCode: string = route?.params?.code ?? "";

  const [codeInput, setCodeInput] = useState(initialCode);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [fetching, setFetching] = useState(!!initialCode);
  const [searched, setSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const welcomeMessage = useMemo(() => {
    if (!organization) return "";
    const index = organization.id.charCodeAt(0) % WELCOME_MESSAGES.length;
    return WELCOME_MESSAGES[index];
  }, [organization]);

  // Paleta "vidrio azure" — mismo lenguaje visual que Dashboard/Profile
  const AZURE_DEEP    = "#2C7BD1";
  const bg            = isDark ? "#0B1220" : "#F1F5FA";
  const cardBg        = isDark ? "rgba(17, 24, 39, 0.68)" : "rgba(255, 255, 255, 0.72)";
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

  const containerStyle: any = isWeb
    ? { backgroundColor: bg, height: "100vh", width: "100%" }
    : { flex: 1, backgroundColor: bg };

  useEffect(() => {
    if (initialCode) {
      handleSearch(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async (codeToSearch?: string) => {
    const value = (codeToSearch ?? codeInput).trim();
    if (!value) {
      setErrorMsg("Ingresa un código de invitación.");
      return;
    }
    setErrorMsg(null);
    setFetching(true);
    const { data, error } = await getOrganizationByCode(value);
    setSearched(true);
    setFetching(false);
    if (error || !data) {
      setOrganization(null);
      setErrorMsg("Ese código de invitación no es válido.");
    } else {
      setOrganization(data);
    }
  };

  const handleJoin = async () => {
    if (!organization || !user) return;
    setJoining(true);
    const { error } = await joinOrganization({ organizationId: organization.id, userId: user.id });
    if (error) {
      setJoining(false);
      setErrorMsg(error.message);
      return;
    }
    await clearPendingOnboarding();
    await refreshOrganization();
    setJoining(false);
    navigation.replace("ProfileSetup");
  };

  // Escape hatch: si la metadata de onboarding quedó apuntando a un código
  // viejo/equivocado (ver docs/TRAMPAS.md), esto es lo único que permite
  // salir del flujo de "unirme" sin quedar atrapado reintentando el mismo
  // código para siempre en cada sesión nueva.
  const handleCreateInstead = async () => {
    await clearPendingOnboarding();
    navigation.replace("WorkspaceSetup");
  };

  return (
    <View style={containerStyle}>

      <TouchableOpacity
        style={[styles.backLink, { top: isMobile ? 20 : 32, left: isMobile ? 20 : 40 }]}
        onPress={() => navigation.navigate("Landing")}
      >
        <ArrowLeft size={16} color={textSecondary} strokeWidth={2.2} />
        <Text style={[styles.backLinkText, { color: textSecondary }]}>Volver al inicio</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: isMobile ? 20 : 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: "100%", maxWidth: 440 }}>

          <View style={styles.logoRow}>
            <Image source={require("../../assets/images/nexus-logo.png")} style={styles.logoIcon} resizeMode="contain" />
            <Text style={[styles.logoText, { color: textPrimary }]}>Nexus</Text>
          </View>

          <Text style={[styles.title, { color: textPrimary }]}>Únete a tu equipo</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>
            {organization
              ? "Confirma que es el workspace correcto antes de unirte."
              : "Ingresa el código que te compartió tu equipo."}
          </Text>

          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
            {fetching ? (
              <ActivityIndicator color={primaryColor} style={{ paddingVertical: 24 }} />
            ) : organization ? (
              <>
                <View style={styles.previewCentered}>
                  <View style={[styles.previewLogo, { backgroundColor: organization.color }]}>
                    {organization.logo_url ? (
                      <Image source={{ uri: organization.logo_url }} style={styles.previewLogoImage} />
                    ) : (
                      <Building2 size={30} color="#FFF" strokeWidth={2.3} />
                    )}
                  </View>
                  <Text style={[styles.previewLabel, { color: textSecondary }]}>Te estás uniendo a</Text>
                  <Text style={[styles.previewName, { color: textPrimary }]} numberOfLines={1}>
                    {organization.name}
                  </Text>
                  <Text style={[styles.welcomeMessage, { color: textSecondary }]}>{welcomeMessage}</Text>
                </View>

                {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={joining}
                  style={[styles.btnPrimary, { backgroundColor: primaryColor, shadowColor: primaryColor, opacity: joining ? 0.7 : 1 }]}
                  onPress={handleJoin}
                >
                  <Text style={styles.btnPrimaryText}>{joining ? "Uniéndote…" : `Unirme a ${organization.name}`}</Text>
                  {!joining && <ArrowRight size={18} color="#FFF" strokeWidth={2.2} />}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {searched && (
                  <View style={styles.errorBlock}>
                    <CircleX size={28} color="#EF4444" strokeWidth={2.2} />
                    <Text style={[styles.errorTitle, { color: textPrimary }]}>{errorMsg}</Text>
                  </View>
                )}

                <Text style={[styles.label, { color: textSecondary }]}>Código de invitación</Text>
                <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: border }]}>
                  <Hash size={18} color={textSecondary} strokeWidth={2.2} />
                  <TextInput
                    placeholder="Ej. 7K3PQ2X"
                    placeholderTextColor={textSecondary}
                    autoCapitalize="characters"
                    value={codeInput}
                    onChangeText={setCodeInput}
                    onSubmitEditing={() => handleSearch()}
                    style={[styles.input, { color: textPrimary }, isWeb && styles.inputNoOutline]}
                  />
                </View>

                {!searched && errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.btnPrimary, { backgroundColor: primaryColor, shadowColor: primaryColor }]}
                  onPress={() => handleSearch()}
                >
                  <Text style={styles.btnPrimaryText}>Buscar workspace</Text>
                  <ArrowRight size={18} color="#FFF" strokeWidth={2.2} />
                </TouchableOpacity>

                <TouchableOpacity style={{ marginTop: 20, alignItems: "center" }} onPress={handleCreateInstead}>
                  <Text style={[styles.pivotLinkText, { color: textSecondary }]}>
                    ¿No tienes un código? <Text style={{ color: primaryColor, fontWeight: "700" }}>Crea tu propia organización</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backLink: {
    position: "absolute", zIndex: 10, flexDirection: "row", alignItems: "center", gap: 8,
  },
  backLinkText: { fontSize: 14, fontWeight: "600" },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 8 },
  inputWrapper: {
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, marginBottom: 20,
  },
  input: { flex: 1, paddingVertical: 16, fontSize: 15 },
  inputNoOutline: { outlineStyle: "none" } as any,
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 32 },
  logoIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#2C7BD1", justifyContent: "center", alignItems: "center" },
  logoText: { fontSize: 24, fontWeight: "700", letterSpacing: -0.5 },
  title: { fontSize: 32, fontWeight: "700", letterSpacing: -1, marginBottom: 8 },
  subtitle: { fontSize: 16, lineHeight: 24, marginBottom: 32 },
  card: { borderRadius: 32, borderWidth: 1, padding: 28 },
  previewCentered: { alignItems: "center", marginBottom: 24 },
  previewLogo: {
    width: 76, height: 76, borderRadius: 38, justifyContent: "center", alignItems: "center",
    overflow: "hidden", marginBottom: 16,
  },
  previewLogoImage: { width: 76, height: 76 },
  previewLabel: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  previewName: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5, textAlign: "center", marginBottom: 12 },
  welcomeMessage: { fontSize: 14, textAlign: "center", lineHeight: 21, paddingHorizontal: 12 },
  errorText: { color: "#EF4444", fontSize: 13, fontWeight: "600", marginBottom: 14 },
  errorBlock: { alignItems: "center", gap: 12, paddingVertical: 12, marginBottom: 20 },
  errorTitle: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  btnPrimary: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 999,
    paddingVertical: 18, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8,
  },
  btnPrimaryText: { color: "#FFF", fontWeight: "700", fontSize: 16, letterSpacing: 0.3 },
  btnSecondary: { borderRadius: 999, borderWidth: 1, paddingVertical: 18, alignItems: "center" },
  btnSecondaryText: { fontWeight: "600", fontSize: 15 },
  pivotLinkText: { fontSize: 13.5 },
});
