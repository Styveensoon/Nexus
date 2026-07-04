import React, { useState } from "react";
import { ArrowLeft, Building2 } from "lucide-react-native";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import IconColorPicker from "../components/IconColorPicker";
import { updateOrganization } from "../lib/organizations";

const AZURE_DEEP = "#2C7BD1";

// Personalización de organización (Punto 2 del feedback): cambiar logo,
// nombre y color desde una pantalla propia, no solo al crear el workspace.
// Solo el owner puede llegar acá (Dashboard solo muestra el ícono de ajustes
// al owner) y solo el owner puede guardar (organizations_update_owner, RLS
// ya existente — sin cambios de schema).
export default function OrganizationSettingsScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const { user, organization, refreshOrganization } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = Platform.OS === "web";

  const [name, setName] = useState(organization?.name ?? "");
  const [color, setColor] = useState(organization?.color ?? AZURE_DEEP);
  const [logoUrl, setLogoUrl] = useState<string | null>(organization?.logo_url ?? null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const bg            = isDark ? "#0B1220" : "#F1F5FA";
  const cardBg        = isDark ? "rgba(17, 24, 39, 0.58)" : "rgba(255, 255, 255, 0.6)";
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
      default: {
        shadowColor: isDark ? "#000" : "#2C7BD1",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: isDark ? 0.35 : 0.1,
        shadowRadius: 22,
        elevation: 6,
      },
    }),
    borderTopColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.9)",
  };

  if (!organization) {
    return (
      <View style={[styles.container, { backgroundColor: bg, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: textSecondary }}>Cargando…</Text>
      </View>
    );
  }

  const handleSave = async () => {
    setErrorMsg(null);
    setSaved(false);
    if (!name.trim()) {
      setErrorMsg("Ponle un nombre a tu organización.");
      return;
    }

    setSaving(true);
    const { error } = await updateOrganization(organization.id, {
      name: name.trim(),
      color,
      logoUrl,
    });
    setSaving(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    await refreshOrganization();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <View style={[styles.container, { backgroundColor: bg, overflow: "hidden" }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: isMobile ? 16 : 32 }}>
        <View style={{ width: "100%", maxWidth: 640, alignSelf: "center" }}>
          <View style={styles.header}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.backBtn, { backgroundColor: cardBg, borderColor: border }]}
              onPress={() => navigation.goBack()}
            >
              <ArrowLeft size={18} color={textSecondary} strokeWidth={2.2} />
            </TouchableOpacity>
            <View>
              <Text style={[styles.subtitle, { color: textSecondary }]}>{organization.name}</Text>
              <Text style={[styles.title, { color: textPrimary }]}>Personalizar organización</Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
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

            <Text style={[styles.label, { color: textSecondary }]}>Logo y color de marca</Text>
            <IconColorPicker
              isDark={isDark}
              userId={user?.id ?? organization.owner_id}
              color={color}
              onColorChange={setColor}
              iconUrl={logoUrl}
              onIconChange={setLogoUrl}
              fallbackIcon={Building2}
            />

            {errorMsg && <Text style={[styles.errorText, { marginTop: 20 }]}>{errorMsg}</Text>}
            {saved && <Text style={[styles.savedText, { marginTop: 20 }]}>Cambios guardados.</Text>}

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={saving}
              style={[styles.btnPrimary, { backgroundColor: primaryColor, shadowColor: primaryColor, opacity: saving ? 0.7 : 1 }]}
              onPress={handleSave}
            >
              <Text style={styles.btnPrimaryText}>{saving ? "Guardando…" : "Guardar cambios"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  subtitle: { fontSize: 13, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "700", letterSpacing: -0.5, marginTop: 2 },
  card: { borderRadius: 28, borderWidth: 1, padding: 24 },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 10, marginTop: 4 },
  inputWrapper: {
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, marginBottom: 20,
  },
  input: { flex: 1, paddingVertical: 16, fontSize: 15 },
  inputNoOutline: { outlineStyle: "none" } as any,
  errorText: { color: "#EF4444", fontSize: 13, fontWeight: "600" },
  savedText: { color: "#10B981", fontSize: 13, fontWeight: "600" },
  btnPrimary: {
    alignItems: "center", justifyContent: "center", borderRadius: 999,
    paddingVertical: 18, marginTop: 24, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8,
  },
  btnPrimaryText: { color: "#FFF", fontWeight: "700", fontSize: 16, letterSpacing: 0.3 },
});
