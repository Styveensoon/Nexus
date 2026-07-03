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
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
} from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";
import { getUserOrganization } from "../lib/organizations";

export default function LoginScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = Platform.OS === "web";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [noOrgUserId, setNoOrgUserId] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMsg(null);
    setNoOrgUserId(null);
    if (!email.trim() || !password) {
      setErrorMsg("Ingresa tu correo y contraseña.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setLoading(false);
      setErrorMsg(error.message);
      return;
    }

    const { data: organization } = await getUserOrganization(data.user.id);
    setLoading(false);

    if (!organization) {
      // Retoma el onboarding si quedó pendiente (p. ej. no confirmó el correo a tiempo)
      const meta = data.user.user_metadata as Record<string, any>;
      if (meta?.pending_account_type === "create") {
        navigation.replace("WorkspaceSetup", { orgName: meta.pending_org_name ?? "" });
        return;
      }
      if (meta?.pending_account_type === "join" && meta.pending_invite_code) {
        navigation.replace("JoinWorkspace", { code: meta.pending_invite_code });
        return;
      }

      setErrorMsg("Tu cuenta no pertenece a ninguna organización todavía.");
      setNoOrgUserId(data.user.id);
      return;
    }

    navigation.replace("Main");
  };

  // Misma paleta del Landing
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

  const inputBorderColor = (field: string) =>
    focusedField === field ? primaryColor : border;

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
              <Image source={require("../../assets/images/nexus-logo.png")} style={styles.logoIcon} resizeMode="contain" />
              <Text style={[styles.logoText, { color: textPrimary }]}>Nexus</Text>
            </View>

            <Text style={[styles.title, { color: textPrimary }]}>Bienvenido de nuevo</Text>
            <Text style={[styles.subtitle, { color: textSecondary }]}>
              Inicia sesión para continuar con tus proyectos.
            </Text>

            <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
              <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorderColor("email") }]}>
                <Mail size={18} color={textSecondary} />
                <TextInput
                  placeholder="Correo electrónico"
                  placeholderTextColor={textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  style={[styles.input, { color: textPrimary }, isWeb && styles.inputNoOutline]}
                />
              </View>

              <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorderColor("password") }]}>
                <Lock size={18} color={textSecondary} />
                <TextInput
                  placeholder="Contraseña"
                  placeholderTextColor={textSecondary}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  style={[styles.input, { color: textPrimary }, isWeb && styles.inputNoOutline]}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                  {showPassword ? <EyeOff size={18} color={textSecondary} /> : <Eye size={18} color={textSecondary} />}
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={{ alignSelf: "flex-end", marginBottom: 24 }}>
                <Text style={[styles.forgotPassword, { color: primaryColor }]}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>

              {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

              {noOrgUserId ? (
                <View style={{ gap: 12, marginBottom: 4 }}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.btnPrimary, { backgroundColor: primaryColor, shadowColor: primaryColor }]}
                    onPress={() => navigation.replace("WorkspaceSetup")}
                  >
                    <Text style={styles.btnPrimaryText}>Crear mi organización</Text>
                    <ArrowRight size={18} color="#FFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.btnSecondary, { borderColor: border, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#FFF" }]}
                    onPress={() => navigation.replace("JoinWorkspace", { code: "" })}
                  >
                    <Text style={[styles.btnSecondaryText, { color: textPrimary }]}>Unirme con un código</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={loading}
                  style={[styles.btnPrimary, { backgroundColor: primaryColor, shadowColor: primaryColor, opacity: loading ? 0.7 : 1 }]}
                  onPress={handleLogin}
                >
                  <Text style={styles.btnPrimaryText}>{loading ? "Ingresando…" : "Iniciar sesión"}</Text>
                  {!loading && <ArrowRight size={18} color="#FFF" />}
                </TouchableOpacity>
              )}

              <View style={styles.divider}>
                <View style={[styles.line, { backgroundColor: border }]} />
                <Text style={[styles.or, { color: textSecondary }]}>o continúa con</Text>
                <View style={[styles.line, { backgroundColor: border }]} />
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.btnSecondary, { borderColor: border, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#FFF" }]}
              >
                <Text style={[styles.btnSecondaryText, { color: textPrimary }]}>Continuar con Google</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={{ marginTop: 28 }} onPress={() => navigation.navigate("Register")}>
              <Text style={[styles.registerLink, { color: textSecondary }]}>
                ¿No tienes cuenta? <Text style={{ color: primaryColor, fontWeight: "700" }}>Crear cuenta</Text>
              </Text>
            </TouchableOpacity>
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
  inputWrapper: {
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, marginBottom: 14,
  },
  input: { flex: 1, paddingVertical: 16, fontSize: 15 },
  inputNoOutline: { outlineStyle: "none" } as any,
  forgotPassword: { fontSize: 14, fontWeight: "600" },
  errorText: { color: "#EF4444", fontSize: 13, fontWeight: "600", marginBottom: 14 },
  btnPrimary: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 999,
    paddingVertical: 18, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8,
  },
  btnPrimaryText: { color: "#FFF", fontWeight: "700", fontSize: 16, letterSpacing: 0.3 },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 24 },
  line: { flex: 1, height: 1 },
  or: { marginHorizontal: 12, fontSize: 13 },
  btnSecondary: { borderRadius: 999, borderWidth: 1, paddingVertical: 18, alignItems: "center" },
  btnSecondaryText: { fontWeight: "600", fontSize: 15 },
  registerLink: { textAlign: "center", fontSize: 14 },
});
