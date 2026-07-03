import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Image,
  ImageSourcePropType,
} from "react-native";
import { Sparkles } from "lucide-react-native";

interface NavbarProps {
  navigation: any;
  isDark: boolean;
  logoUri?: ImageSourcePropType;
}

// Paleta de marca de Nexus (azure) — acento único, moderado, no cubre áreas grandes.
const AZURE_DEEP = "#2C7BD1";

export default function Navbar({ navigation, isDark, logoUri }: NavbarProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";

  const paddingH = isMobile ? 24 : "5%";

  return (
    // Sin fondo/sombra propios a propósito: el wrapper translúcido con blur que envuelve
    // este componente en LandingScreen.tsx (navWrapper) es el vidrio real — pintar un fondo
    // opaco acá encima lo taparía por completo.
    <View style={styles.navContainer}>
      <View style={[styles.navContent, { paddingHorizontal: paddingH }]}>
        <TouchableOpacity style={styles.logoRow} onPress={() => navigation.navigate("Landing")}>
          {logoUri ? (
            <Image source={logoUri} style={styles.logoImage} resizeMode="contain" />
          ) : (
            <View style={[styles.logoIcon, { backgroundColor: AZURE_DEEP }]}>
              <Sparkles size={16} color="#FFFFFF" strokeWidth={2.3} />
            </View>
          )}
          <Text style={[styles.logoText, { color: textPrimary }]}>Nexus</Text>
        </TouchableOpacity>

        {!isMobile && (
          <View style={styles.links}>
            {["Características", "Integraciones", "Precios"].map((l) => (
              <TouchableOpacity key={l}>
                <Text style={[styles.link, { color: textSecondary }]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          {!isMobile && (
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text style={[styles.linkBtn, { color: textSecondary }]}>Iniciar sesión</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: AZURE_DEEP, shadowColor: AZURE_DEEP }]}
            onPress={() => navigation.navigate("Register")}
          >
            <Text style={styles.btnPrimaryText}>
              {isMobile ? "Registrarse" : "Comenzar gratis"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navContainer: {
    width: "100%",
    zIndex: 50,
  },
  navContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    width: "100%",
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  logoImage: { width: 32, height: 32, borderRadius: 10 },
  logoText: { fontSize: 20, fontWeight: "700", letterSpacing: -0.5 },
  links: { flexDirection: "row", gap: 32, alignItems: "center" },
  link: { fontSize: 15, fontWeight: "500" },
  actions: { flexDirection: "row", alignItems: "center", gap: 20 },
  linkBtn: { fontSize: 15, fontWeight: "600" },
  btnPrimary: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 3,
  },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
});
