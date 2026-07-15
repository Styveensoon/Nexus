import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { ArrowLeft, ArrowRight, Building2 } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { createOrganization } from "../lib/organizations";
import IconColorPicker from "../components/IconColorPicker";

// El acento único de la app (azure) no restringe qué color de marca puede elegir
// una organización para SU workspace — ese es un dato de negocio, no un color de
// chrome. Se reemplazó solo el violeta ("#7C3AED") por ser el color secundario que
// el resto de la app dejó de usar, para no dar la falsa impresión de que sigue vigente.
const WORKSPACE_COLORS = ["#2C7BD1", "#F97316", "#10B981", "#F59E0B", "#EF4444", "#EC4899"];

export default function WorkspaceSetupScreen({ navigation, route }: any) {
  const { isDark } = useTheme();
  const { user, refreshOrganization } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = Platform.OS === "web";

  const [name, setName] = useState(route?.params?.orgName ?? "");
  const [color, setColor] = useState(WORKSPACE_COLORS[0]);
  const [logoUrl, setLogoUrl] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  const handleCreate = async () => {
    setErrorMsg(null);
    if (!name.trim()) {
      setErrorMsg("Ponle un nombre a tu organización.");
      return;
    }
    if (!user) {
      setErrorMsg("Tu sesión expiró, vuelve a iniciar sesión.");
      return;
    }

    setLoading(true);
    const { error } = await createOrganization({
      ownerId: user.id,
      name: name.trim(),
      color,
      logoUrl: logoUrl.trim() || null,
    });

    if (error) {
      setLoading(false);
      setErrorMsg(error.message);
      return;
    }

    await refreshOrganization();
    setLoading(false);
    navigation.replace("ProfileSetup");
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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: isMobile ? 20 : 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: "100%", maxWidth: 440 }}>
            <View style={styles.logoRow}>
              <Image source={require("../../assets/images/nexus-logo.png")} style={styles.logoIcon} resizeMode="contain" />
              <Text style={[styles.logoText, { color: textPrimary }]}>Nexus</Text>
            </View>

            <Text style={[styles.title, { color: textPrimary }]}>Personaliza tu workspace</Text>
            <Text style={[styles.subtitle, { color: textSecondary }]}>
              Así es como tu equipo va a reconocer su espacio en Nexus.
            </Text>

            <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
              <View style={[styles.previewCard, { backgroundColor: inputBg, borderColor: border }]}>
                <View style={styles.previewRow}>
                  <View style={[styles.previewLogo, { backgroundColor: color, overflow: "hidden" }]}>
                    {logoUrl ? (
                      <Image source={{ uri: logoUrl }} style={styles.previewLogoImage} />
                    ) : (
                      <Building2 size={24} color="#FFF" strokeWidth={2.3} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.previewLabel, { color: textSecondary }]}>Vista previa</Text>
                    <Text style={[styles.previewName, { color: textPrimary }]} numberOfLines={1}>
                      {name.trim() || "Mi organización"}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={[styles.label, { color: textSecondary }]}>Nombre del workspace</Text>
                <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: focusedField === "name" ? primaryColor : border }]}>
                  <Building2 size={18} color={textSecondary} strokeWidth={2.2} />
                  <TextInput
                    placeholder="Nombre de tu organización"
                    placeholderTextColor={textSecondary}
                    value={name}
                    onChangeText={setName}
                    onFocus={() => setFocusedField("name")}
                    onBlur={() => setFocusedField(null)}
                    style={[styles.input, { color: textPrimary }, isWeb && styles.inputNoOutline]}
                  />
                </View>
              </View>

              <View style={styles.section}>
                <Text style={[styles.label, { color: textSecondary }]}>Logo y color de marca</Text>
                <IconColorPicker
                  isDark={isDark}
                  userId={user?.id ?? ""}
                  color={color}
                  onColorChange={setColor}
                  iconUrl={logoUrl || null}
                  onIconChange={(url) => setLogoUrl(url ?? "")}
                  fallbackIcon={Building2}
                />
              </View>

              {errorMsg && <Text style={[styles.errorText, { marginTop: 4, marginBottom: 8 }]}>{errorMsg}</Text>}

              <TouchableOpacity
                activeOpacity={0.85}
                disabled={loading}
                style={[styles.btnPrimary, { backgroundColor: primaryColor, shadowColor: primaryColor, opacity: loading ? 0.7 : 1 }]}
                onPress={handleCreate}
              >
                <Text style={styles.btnPrimaryText}>{loading ? "Creando workspace…" : "Crear workspace"}</Text>
                {!loading && <ArrowRight size={18} color="#FFF" strokeWidth={2.2} />}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  backLink: {
    position: "absolute", zIndex: 10, flexDirection: "row", alignItems: "center", gap: 8,
  },
  backLinkText: { fontSize: 14, fontWeight: "600" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 32 },
  logoIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#2C7BD1", justifyContent: "center", alignItems: "center" },
  logoText: { fontSize: 24, fontWeight: "700", letterSpacing: -0.5 },
  title: { fontSize: 32, fontWeight: "700", letterSpacing: -1, marginBottom: 8 },
  subtitle: { fontSize: 16, lineHeight: 24, marginBottom: 32 },
  card: { borderRadius: 32, borderWidth: 1, padding: 28 },
  previewCard: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 28 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  previewLogo: { width: 56, height: 56, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  previewLogoImage: { width: 56, height: 56, resizeMode: "cover" },
  previewLabel: { fontSize: 12, fontWeight: "700", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.4 },
  previewName: { fontSize: 18, fontWeight: "600" },
  section: { marginBottom: 28 },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 10 },
  inputWrapper: {
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16,
  },
  input: { flex: 1, paddingVertical: 16, fontSize: 15 },
  inputNoOutline: { outlineStyle: "none" } as any,
  errorText: { color: "#EF4444", fontSize: 13, fontWeight: "600" },
  btnPrimary: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 999,
    paddingVertical: 18, marginTop: 4, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8,
  },
  btnPrimaryText: { color: "#FFF", fontWeight: "700", fontSize: 16, letterSpacing: 0.3 },
});
