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
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

export default function SemilleroScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const { organization } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = Platform.OS === "web";

  const [idea, setIdea] = useState("");
  const [submitted, setSubmitted] = useState(false);

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

  const handleSubmit = () => {
    if (!idea.trim()) return;
    setSubmitted(true);
  };

  return (
    <View style={containerStyle}>
      <TouchableOpacity
        style={[styles.backLink, { top: isMobile ? 20 : 32, left: isMobile ? 20 : 40 }]}
        onPress={() => navigation.goBack()}
      >
        <ArrowLeft size={16} color={textSecondary} />
        <Text style={[styles.backLinkText, { color: textSecondary }]}>Volver</Text>
      </TouchableOpacity>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: isMobile ? 20 : 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: "100%", maxWidth: 560 }}>
            <View style={styles.logoRow}>
              <View style={[styles.logoIcon, { backgroundColor: organization?.color ?? primaryColor }]}>
                <Sparkles size={18} color="#FFF" />
              </View>
              <Text style={[styles.logoText, { color: textPrimary }]}>El Semillero</Text>
            </View>

            <Text style={[styles.title, { color: textPrimary }]}>Convierte tu idea en un equipo</Text>
            <Text style={[styles.subtitle, { color: textSecondary }]}>
              Describe tu proyecto y la IA forma el equipo ideal basándose en perfiles reales de tu organización.
            </Text>

            <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
              <Text style={[styles.label, { color: textSecondary }]}>Tu idea</Text>
              <View style={[styles.textAreaWrapper, { backgroundColor: inputBg, borderColor: border }]}>
                <TextInput
                  placeholder="Ej. Necesito lanzar una campaña de marketing digital para..."
                  placeholderTextColor={textSecondary}
                  value={idea}
                  onChangeText={(t) => {
                    setIdea(t);
                    if (submitted) setSubmitted(false);
                  }}
                  multiline
                  numberOfLines={5}
                  style={[styles.textArea, { color: textPrimary }, isWeb && styles.inputNoOutline]}
                />
              </View>

              {submitted ? (
                <View style={[styles.noticeBox, { borderColor: border, backgroundColor: inputBg }]}>
                  <Sparkles size={16} color={primaryColor} />
                  <Text style={[styles.noticeText, { color: textPrimary }]}>
                    Esta función estará disponible muy pronto. Estamos construyendo el Semillero 🚀
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={!idea.trim()}
                  style={[styles.btnPrimary, { backgroundColor: primaryColor, shadowColor: primaryColor, opacity: idea.trim() ? 1 : 0.5 }]}
                  onPress={handleSubmit}
                >
                  <Text style={styles.btnPrimaryText}>Formar equipo</Text>
                  <ArrowRight size={18} color="#FFF" />
                </TouchableOpacity>
              )}
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
  logoIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  logoText: { fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  title: { fontSize: 32, fontWeight: "900", letterSpacing: -1, marginBottom: 8 },
  subtitle: { fontSize: 16, lineHeight: 24, marginBottom: 32 },
  card: { borderRadius: 24, borderWidth: 1, padding: 28 },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 8 },
  textAreaWrapper: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 16 },
  textArea: { minHeight: 110, fontSize: 15, paddingVertical: 12, textAlignVertical: "top" },
  inputNoOutline: { outlineStyle: "none" } as any,
  noticeBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: 14, padding: 14 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  btnPrimary: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 999,
    paddingVertical: 18, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8,
  },
  btnPrimaryText: { color: "#FFF", fontWeight: "700", fontSize: 16, letterSpacing: 0.3 },
});
