import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Image,
  ImageSourcePropType,
  Platform,
} from "react-native";
import { Sparkles } from "lucide-react-native";

interface NavbarProps {
  navigation: any;
  isDark: boolean;
  logoUri?: ImageSourcePropType;
  onNavLinkPress?: (sectionKey: string) => void;
}

// Paleta de marca de Nexus (azure) — acento único, moderado, no cubre áreas grandes.
const AZURE_DEEP = "#2C7BD1";

const NAV_LINKS = [
  { key: "features", label: "Características" },
  { key: "integrations", label: "Integraciones" },
  { key: "privacy", label: "Privacidad" },
];

const isWeb = Platform.OS === "web";

function NavPillLink({
  label,
  textSecondary,
  textPrimary,
  hoverBg,
  onPress,
}: {
  label: string;
  textSecondary: string;
  textPrimary: string;
  hoverBg: string;
  onPress?: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.navPillLink, hover && { backgroundColor: hoverBg }]}
      {...(isWeb
        ? ({ onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) } as any)
        : {})}
    >
      <Text style={[styles.navPillLinkText, { color: hover ? textPrimary : textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function LoginGhostButton({
  border,
  hoverBorder,
  hoverBg,
  textSecondary,
  textPrimary,
  onPress,
}: {
  border: string;
  hoverBorder: string;
  hoverBg: string;
  textSecondary: string;
  textPrimary: string;
  onPress: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.loginBtn,
        { borderColor: hover ? hoverBorder : border, backgroundColor: hover ? hoverBg : "transparent" },
      ]}
      {...(isWeb
        ? ({ onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) } as any)
        : {})}
    >
      <Text style={[styles.linkBtn, { color: hover ? textPrimary : textSecondary }]}>Iniciar sesión</Text>
    </TouchableOpacity>
  );
}

export default function Navbar({ navigation, isDark, logoUri, onNavLinkPress }: NavbarProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const border        = isDark ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.12)";
  const hoverBorder   = isDark ? "rgba(255,255,255,0.28)" : "rgba(15,23,42,0.22)";
  const pillBg        = isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.035)";
  const pillHoverBg   = isDark ? "rgba(255,255,255,0.09)" : "rgba(15,23,42,0.06)";

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
          <View style={[styles.linksPill, { backgroundColor: pillBg, borderColor: border }]}>
            {NAV_LINKS.map((l) => (
              <NavPillLink
                key={l.key}
                label={l.label}
                textSecondary={textSecondary}
                textPrimary={textPrimary}
                hoverBg={pillHoverBg}
                onPress={() => onNavLinkPress?.(l.key)}
              />
            ))}
          </View>
        )}

        <View style={styles.actions}>
          {!isMobile && (
            <LoginGhostButton
              border={border}
              hoverBorder={hoverBorder}
              hoverBg={pillHoverBg}
              textSecondary={textSecondary}
              textPrimary={textPrimary}
              onPress={() => navigation.navigate("Login")}
            />
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
  linksPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  navPillLink: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    ...(isWeb ? ({ transitionProperty: "background-color", transitionDuration: "0.15s" } as any) : {}),
  },
  navPillLinkText: { fontSize: 14, fontWeight: "600" },
  actions: { flexDirection: "row", alignItems: "center", gap: 12 },
  loginBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    ...(isWeb ? ({ transitionProperty: "background-color, border-color", transitionDuration: "0.15s" } as any) : {}),
  },
  linkBtn: { fontSize: 14, fontWeight: "600" },
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
