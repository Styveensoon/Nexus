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

export default function Navbar({ navigation, isDark, logoUri }: NavbarProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const bg            = isDark ? "#111827" : "#FFFFFF";
  const border        = isDark ? "#374151" : "#E5E7EB";
  const textPrimary   = isDark ? "#FFFFFF" : "#111827";
  const textSecondary = isDark ? "#9CA3AF" : "#6B7280";
  const shadowBase    = isDark ? "#000000" : "#000000";

  const paddingH = isMobile ? 24 : "5%";

  return (
    <View style={[
      styles.navContainer, 
      { 
        backgroundColor: bg, 
        borderBottomColor: border,
        shadowColor: shadowBase,
      }
    ]}>
      {/* Aplicamos el mismo margen dinámico del Landing y quitamos el límite de ancho */}
      <View style={[styles.navContent, { paddingHorizontal: paddingH }]}>
        <TouchableOpacity style={styles.logoRow} onPress={() => navigation.navigate("Landing")}>
          {logoUri ? (
            <Image source={logoUri} style={styles.logoImage} resizeMode="contain" />
          ) : (
            <View style={styles.logoIcon}>
              <Sparkles size={16} color="#FFFFFF" />
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
            style={[styles.btnPrimary, { shadowColor: '#2563EB' }]}
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
    borderBottomWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
    zIndex: 50,
  },
  navContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    width: "100%", // Sin maxWidth para que fluya
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#2563EB", justifyContent: "center", alignItems: "center" },
  logoImage: { width: 32, height: 32, borderRadius: 8 },
  logoText: { fontSize: 20, fontWeight: "700", letterSpacing: -0.5 },
  links: { flexDirection: "row", gap: 32, alignItems: "center" },
  link: { fontSize: 15, fontWeight: "500" },
  actions: { flexDirection: "row", alignItems: "center", gap: 20 },
  linkBtn: { fontSize: 15, fontWeight: "600" },
  btnPrimary: { 
    backgroundColor: "#2563EB", 
    paddingHorizontal: 20, 
    paddingVertical: 10, 
    borderRadius: 999,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
});