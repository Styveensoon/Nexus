import React, { useState } from "react";
import {
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
import { ArrowLeft, ArrowRight, Building2, Check, Image as ImageIcon, Palette, Sparkles } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { createOrganization } from "../lib/organizations";
import ColorPickerModal from "../components/ColorPickerModal";

const WORKSPACE_COLORS = ["#2563EB", "#7C3AED", "#10B981", "#F59E0B", "#EF4444", "#EC4899"];

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
  const [showColorPicker, setShowColorPicker] = useState(false);

  const bg            = isDark ? "#020617" : "#FAFAFA";
  const cardBg        = isDark ? "rgba(15, 23, 42, 0.8)" : "rgba(255, 255, 255, 0.9)";
  const border        = isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(226, 232, 240, 0.8)";
  const textPrimary   = isDark ? "#F8FAFC" : "#020617";
  const textSecondary = isDark ? "#94A3B8" : "#475569";
  const primaryColor  = "#2563EB";
  const inputBg       = isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC";

  const ultraShadow = Platform.select({
    web: {
      boxShadow: isDark
        ? "0 25px 50px -12px rgba(0,0,0,1), 0 0 0 1px rgba(255,255,255,0.05) inset"
        : "0 30px 60px -15px rgba(0,0,0,0.08), 0 10px 30px -5px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02) inset",
      backdropFilter: "blur(12px)",
    } as any,
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.4 : 0.06,
      shadowRadius: 16,
      elevation: 6,
    },
  });

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
    navigation.replace("Main");
  };

  return (
    <View style={containerStyle}>
      {isWeb && (
        <View style={styles.backgroundTextureContainer} pointerEvents="none">
          <View style={[styles.glowOrb, { top: -150, left: "-10%", backgroundColor: isDark ? "rgba(37, 99, 235, 0.15)" : "rgba(37, 99, 235, 0.08)" }]} />
          <View style={[styles.glowOrb, { bottom: -200, right: "-10%", backgroundColor: isDark ? "rgba(124, 58, 237, 0.12)" : "rgba(124, 58, 237, 0.05)" }]} />
        </View>
      )}

      <TouchableOpacity
        style={[styles.backLink, { top: isMobile ? 20 : 32, left: isMobile ? 20 : 40 }]}
        onPress={() => navigation.navigate("Landing")}
      >
        <ArrowLeft size={16} color={textSecondary} />
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
              <View style={styles.logoIcon}>
                <Sparkles size={18} color="#FFF" />
              </View>
              <Text style={[styles.logoText, { color: textPrimary }]}>Nexus</Text>
            </View>

            <Text style={[styles.title, { color: textPrimary }]}>Personaliza tu workspace</Text>
            <Text style={[styles.subtitle, { color: textSecondary }]}>
              Así es como tu equipo va a reconocer su espacio en Nexus.
            </Text>

            <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
              <View style={styles.previewRow}>
                <View style={[styles.previewLogo, { backgroundColor: color }]}>
                  <Building2 size={22} color="#FFF" />
                </View>
                <Text style={[styles.previewName, { color: textPrimary }]} numberOfLines={1}>
                  {name.trim() || "Mi organización"}
                </Text>
              </View>

              <Text style={[styles.label, { color: textSecondary }]}>Nombre del workspace</Text>
              <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: focusedField === "name" ? primaryColor : border }]}>
                <Building2 size={18} color={textSecondary} />
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

              <Text style={[styles.label, { color: textSecondary }]}>Color de marca</Text>
              <View style={styles.colorRow}>
                {WORKSPACE_COLORS.map((c) => (
                  <TouchableOpacity key={c} activeOpacity={0.8} onPress={() => setColor(c)} style={[styles.colorSwatch, { backgroundColor: c }]}>
                    {color === c && <Check size={16} color="#FFF" />}
                  </TouchableOpacity>
                ))}
                {!WORKSPACE_COLORS.includes(color) && (
                  <View style={[styles.colorSwatch, { backgroundColor: color, borderWidth: 2, borderColor: isDark ? "#F8FAFC" : "#FFFFFF" }]}>
                    <Check size={16} color="#FFF" />
                  </View>
                )}
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.customColorBtn, { borderColor: border, backgroundColor: inputBg }]}
                onPress={() => setShowColorPicker(true)}
              >
                <Palette size={16} color={primaryColor} />
                <Text style={[styles.customColorText, { color: textPrimary }]}>Personalizar color</Text>
              </TouchableOpacity>

              <Text style={[styles.label, { color: textSecondary }]}>Logo (opcional)</Text>
              <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: focusedField === "logo" ? primaryColor : border }]}>
                <ImageIcon size={18} color={textSecondary} />
                <TextInput
                  placeholder="URL de tu logo"
                  placeholderTextColor={textSecondary}
                  autoCapitalize="none"
                  value={logoUrl}
                  onChangeText={setLogoUrl}
                  onFocus={() => setFocusedField("logo")}
                  onBlur={() => setFocusedField(null)}
                  style={[styles.input, { color: textPrimary }, isWeb && styles.inputNoOutline]}
                />
              </View>

              {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

              <TouchableOpacity
                activeOpacity={0.85}
                disabled={loading}
                style={[styles.btnPrimary, { backgroundColor: primaryColor, shadowColor: primaryColor, opacity: loading ? 0.7 : 1 }]}
                onPress={handleCreate}
              >
                <Text style={styles.btnPrimaryText}>{loading ? "Creando workspace…" : "Crear workspace"}</Text>
                {!loading && <ArrowRight size={18} color="#FFF" />}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ColorPickerModal
        visible={showColorPicker}
        initialColor={color}
        isDark={isDark}
        onClose={() => setShowColorPicker(false)}
        onConfirm={(hex) => {
          setColor(hex);
          setShowColorPicker(false);
        }}
      />
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
  backLink: {
    position: "absolute", zIndex: 10, flexDirection: "row", alignItems: "center", gap: 8,
  },
  backLinkText: { fontSize: 14, fontWeight: "600" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 32 },
  logoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#2563EB", justifyContent: "center", alignItems: "center" },
  logoText: { fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  title: { fontSize: 32, fontWeight: "900", letterSpacing: -1, marginBottom: 8 },
  subtitle: { fontSize: 16, lineHeight: 24, marginBottom: 32 },
  card: { borderRadius: 24, borderWidth: 1, padding: 28 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  previewLogo: { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  previewName: { flex: 1, fontSize: 18, fontWeight: "800" },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 8 },
  inputWrapper: {
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, marginBottom: 20,
  },
  input: { flex: 1, paddingVertical: 16, fontSize: 15 },
  inputNoOutline: { outlineStyle: "none" } as any,
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  colorSwatch: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  customColorBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1, borderRadius: 14, paddingVertical: 12, marginBottom: 20,
  },
  customColorText: { fontWeight: "700", fontSize: 14 },
  errorText: { color: "#EF4444", fontSize: 13, fontWeight: "600", marginBottom: 14 },
  btnPrimary: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 999,
    paddingVertical: 18, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8,
  },
  btnPrimaryText: { color: "#FFF", fontWeight: "700", fontSize: 16, letterSpacing: 0.3 },
});
