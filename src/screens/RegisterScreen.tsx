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
  Building2,
  Check,
  Eye,
  EyeOff,
  Handshake,
  Hash,
  Lock,
  Mail,
  User,
  Users,
} from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";
import TermsModal from "../components/TermsModal";

function passwordStrength(password: string) {
  if (password.length === 0) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.max(score, password.length >= 4 ? 1 : 0);
}

export default function RegisterScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = Platform.OS === "web";

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [dataConsent, setDataConsent] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<"create" | "join" | "client">("create");
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [orgValue, setOrgValue] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const strength = passwordStrength(password);

  const handleRegister = async () => {
    setErrorMsg(null);

    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setErrorMsg("Completa todos los campos.");
      return;
    }
    if (!orgValue.trim()) {
      setErrorMsg(
        accountType === "create"
          ? "Ingresa el nombre de tu organización."
          : accountType === "join"
          ? "Ingresa el código de invitación."
          : "Ingresa el código de cliente."
      );
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }
    if (!acceptedTerms) {
      setErrorMsg("Debes aceptar los términos y condiciones.");
      return;
    }
    // Consentimiento de uso de datos — solo aplica al flujo de cliente
    // (docs/CLIENTE.md §1: "se le informa/solicita consentimiento de que su
    // información podrá usarse para mejora de la plataforma/analítica").
    if (accountType === "client" && !dataConsent) {
      setErrorMsg("Debes aceptar el uso de tus datos para continuar como cliente.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          // Se guarda en el usuario para retomar el onboarding tras confirmar el correo
          pending_account_type: accountType,
          pending_org_name: accountType === "create" ? orgValue.trim() : null,
          pending_invite_code: accountType === "join" ? orgValue.trim() : null,
          pending_client_code: accountType === "client" ? orgValue.trim() : null,
          pending_data_consent: accountType === "client" ? dataConsent : null,
        },
      },
    });
    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    if (!data.session) {
      // Supabase responde "éxito" sin enviar correo cuando el email ya existe
      // (protección anti-enumeración). Se detecta por identities vacío.
      if ((data.user?.identities?.length ?? 0) === 0) {
        setErrorMsg("Ese correo ya está registrado. Inicia sesión o usa otro correo.");
        return;
      }
      setErrorMsg("Te enviamos un correo de confirmación. Revisa también spam/promociones y confírmalo antes de iniciar sesión.");
      return;
    }

    if (accountType === "create") {
      navigation.replace("WorkspaceSetup", { orgName: orgValue.trim() });
    } else if (accountType === "join") {
      navigation.replace("JoinWorkspace", { code: orgValue.trim() });
    } else {
      navigation.replace("ClientJoin", { code: orgValue.trim(), dataConsent });
    }
  };

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

  const inputBorderColor = (field: string) =>
    focusedField === field ? primaryColor : border;

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

            <Text style={[styles.title, { color: textPrimary }]}>Crea tu cuenta</Text>
            <Text style={[styles.subtitle, { color: textSecondary }]}>
              {accountType === "create"
                ? "Crea tu organización y empieza a construir con tu equipo."
                : accountType === "join"
                ? "Únete con el código de invitación de tu equipo."
                : "Únete con el código de cliente que te compartió tu organización."}
            </Text>

            <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
              <View style={[styles.segmentedControl, { backgroundColor: inputBg, borderColor: border }]}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.segmentButton, accountType === "create" && { backgroundColor: primaryColor }]}
                  onPress={() => setAccountType("create")}
                >
                  <Building2 size={16} color={accountType === "create" ? "#FFF" : textSecondary} strokeWidth={2.2} />
                  <Text style={[styles.segmentText, { color: accountType === "create" ? "#FFF" : textSecondary }]} numberOfLines={1}>
                    Crear
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.segmentButton, accountType === "join" && { backgroundColor: primaryColor }]}
                  onPress={() => setAccountType("join")}
                >
                  <Users size={16} color={accountType === "join" ? "#FFF" : textSecondary} strokeWidth={2.2} />
                  <Text style={[styles.segmentText, { color: accountType === "join" ? "#FFF" : textSecondary }]} numberOfLines={1}>
                    Unirme
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.segmentButton, accountType === "client" && { backgroundColor: primaryColor }]}
                  onPress={() => setAccountType("client")}
                >
                  <Handshake size={16} color={accountType === "client" ? "#FFF" : textSecondary} strokeWidth={2.2} />
                  <Text style={[styles.segmentText, { color: accountType === "client" ? "#FFF" : textSecondary }]} numberOfLines={1}>
                    Soy cliente
                  </Text>
                </TouchableOpacity>
              </View>

              {accountType === "create" ? (
                <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorderColor("org") }]}>
                  <Building2 size={18} color={textSecondary} strokeWidth={2.2} />
                  <TextInput
                    placeholder="Nombre de tu organización"
                    placeholderTextColor={textSecondary}
                    value={orgValue}
                    onChangeText={setOrgValue}
                    onFocus={() => setFocusedField("org")}
                    onBlur={() => setFocusedField(null)}
                    style={[styles.input, { color: textPrimary }, isWeb && styles.inputNoOutline]}
                  />
                </View>
              ) : (
                <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorderColor("orgCode") }]}>
                  <Hash size={18} color={textSecondary} strokeWidth={2.2} />
                  <TextInput
                    placeholder={accountType === "join" ? "Código de invitación" : "Código de cliente"}
                    placeholderTextColor={textSecondary}
                    autoCapitalize="characters"
                    value={orgValue}
                    onChangeText={setOrgValue}
                    onFocus={() => setFocusedField("orgCode")}
                    onBlur={() => setFocusedField(null)}
                    style={[styles.input, { color: textPrimary }, isWeb && styles.inputNoOutline]}
                  />
                </View>
              )}

              <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorderColor("name") }]}>
                <User size={18} color={textSecondary} strokeWidth={2.2} />
                <TextInput
                  placeholder="Nombre completo"
                  placeholderTextColor={textSecondary}
                  value={fullName}
                  onChangeText={setFullName}
                  onFocus={() => setFocusedField("name")}
                  onBlur={() => setFocusedField(null)}
                  style={[styles.input, { color: textPrimary }, isWeb && styles.inputNoOutline]}
                />
              </View>

              <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorderColor("email") }]}>
                <Mail size={18} color={textSecondary} strokeWidth={2.2} />
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

              <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorderColor("password"), marginBottom: 8 }]}>
                <Lock size={18} color={textSecondary} strokeWidth={2.2} />
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
                  {showPassword ? <EyeOff size={18} color={textSecondary} strokeWidth={2.2} /> : <Eye size={18} color={textSecondary} strokeWidth={2.2} />}
                </TouchableOpacity>
              </View>

              <View style={styles.passwordStrength}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.strengthBar,
                      { backgroundColor: i < strength ? primaryColor : border },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.passwordHint, { color: textSecondary }]}>
                Usa al menos 8 caracteres, una mayúscula y un número.
              </Text>

              <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorderColor("confirm") }]}>
                <Lock size={18} color={textSecondary} strokeWidth={2.2} />
                <TextInput
                  placeholder="Confirmar contraseña"
                  placeholderTextColor={textSecondary}
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={() => setFocusedField("confirm")}
                  onBlur={() => setFocusedField(null)}
                  style={[styles.input, { color: textPrimary }, isWeb && styles.inputNoOutline]}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} hitSlop={8}>
                  {showConfirmPassword ? <EyeOff size={18} color={textSecondary} strokeWidth={2.2} /> : <Eye size={18} color={textSecondary} strokeWidth={2.2} />}
                </TouchableOpacity>
              </View>

              {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => (acceptedTerms ? setAcceptedTerms(false) : setTermsModalVisible(true))}
              >
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: acceptedTerms ? primaryColor : border },
                    acceptedTerms && { backgroundColor: primaryColor },
                  ]}
                >
                  {acceptedTerms && <Check size={14} color="#FFF" strokeWidth={2.4} />}
                </View>
                <Text style={[styles.checkboxText, { color: textSecondary }]}>
                  Acepto los{" "}
                  <Text style={{ color: primaryColor, fontWeight: "700", textDecorationLine: "underline" }}>
                    términos y condiciones
                  </Text>
                </Text>
              </TouchableOpacity>

              {accountType === "client" && (
                <TouchableOpacity
                  style={[styles.checkboxContainer, { marginTop: -12 }]}
                  onPress={() => setDataConsent(!dataConsent)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: dataConsent ? primaryColor : border },
                      dataConsent && { backgroundColor: primaryColor },
                    ]}
                  >
                    {dataConsent && <Check size={14} color="#FFF" strokeWidth={2.4} />}
                  </View>
                  <Text style={[styles.checkboxText, { color: textSecondary }]}>
                    Acepto que mi información se use para mejorar la plataforma y con fines analíticos
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                activeOpacity={0.85}
                disabled={loading}
                style={[styles.btnPrimary, { backgroundColor: primaryColor, shadowColor: primaryColor, opacity: loading ? 0.7 : 1 }]}
                onPress={handleRegister}
              >
                <Text style={styles.btnPrimaryText}>{loading ? "Creando cuenta…" : "Crear cuenta"}</Text>
                {!loading && <ArrowRight size={18} color="#FFF" strokeWidth={2.2} />}
              </TouchableOpacity>

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

            <TouchableOpacity style={{ marginTop: 28 }} onPress={() => navigation.navigate("Login")}>
              <Text style={[styles.loginLink, { color: textSecondary }]}>
                ¿Ya tienes cuenta? <Text style={{ color: primaryColor, fontWeight: "700" }}>Inicia sesión</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <TermsModal
        visible={termsModalVisible}
        isDark={isDark}
        onAccept={() => {
          setAcceptedTerms(true);
          setTermsModalVisible(false);
        }}
        onClose={() => setTermsModalVisible(false)}
      />
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
  segmentedControl: { flexDirection: "row", borderWidth: 1, borderRadius: 16, padding: 4, gap: 4, marginBottom: 14 },
  segmentButton: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 12 },
  segmentText: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  inputWrapper: {
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, marginBottom: 14,
  },
  input: { flex: 1, paddingVertical: 16, fontSize: 15 },
  inputNoOutline: { outlineStyle: "none" } as any,
  passwordStrength: { flexDirection: "row", gap: 6, marginBottom: 8 },
  strengthBar: { flex: 1, height: 5, borderRadius: 6 },
  passwordHint: { fontSize: 12, marginBottom: 16 },
  errorText: { color: "#EF4444", fontSize: 13, fontWeight: "600", marginBottom: 14 },
  checkboxContainer: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 24 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  checkboxText: { flex: 1, fontSize: 13 },
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
  loginLink: { textAlign: "center", fontSize: 14 },
});
