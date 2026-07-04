import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import {
  ArrowRight,
  Sparkles,
  Lock,
  BarChart3,
  Building2,
  UserCheck,
  LayoutGrid,
} from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import Navbar from "../components/landing/Navbar";
import Footer from "../components/landing/Footer";
import DashboardMockup from "../components/landing/DashboardMockup";
import LogoCarousel from "../components/landing/LogoCarousel";
import IntegrationsSection from "../components/landing/IntegrationsSection";
import PricingSection from "../components/landing/PricingSection";

// Paleta de marca de Nexus (azure) — acento único, moderado, no cubre áreas grandes.
const AZURE_DEEP = "#2C7BD1";

const FEATURES = [
  { icon: Sparkles,   title: "Semillero IA",        desc: "Describe tu proyecto y la IA forma el equipo ideal basándose en perfiles reales de tu organización." },
  { icon: Lock,       title: "Self-hosted & privado", desc: "La IA corre en tu servidor. Tus datos nunca salen de tu red. Ideal para corporativos y gobierno." },
  { icon: LayoutGrid, title: "Múltiples vistas",      desc: "Kanban, Lista, Timeline y Dashboard. La misma información, cuatro lentes distintos." },
  { icon: BarChart3,  title: "Reportes con IA",       desc: "Análisis automático de desempeño, avance y predicciones en lenguaje natural." },
  { icon: Building2,  title: "Workspaces con marca",  desc: "Cada organización personaliza su workspace con colores y logo propios." },
  { icon: UserCheck,  title: "Client Room",           desc: "Vista curada para clientes externos. Solo ven lo que tú decides mostrarles." },
];

export default function LandingScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = Platform.OS === "web";

  // Hover sutil (solo web) para los CTA principales
  const [hoverHeroPrimary, setHoverHeroPrimary] = useState(false);
  const [hoverHeroSecondary, setHoverHeroSecondary] = useState(false);
  const [hoverCta, setHoverCta] = useState(false);

  // Paleta "vidrio azure" — mismo lenguaje visual que Dashboard/Profile
  const bg            = isDark ? "#0B1220" : "#F1F5FA";
  const cardBg        = isDark ? "rgba(17, 24, 39, 0.62)" : "rgba(255, 255, 255, 0.72)";
  const bg2           = isDark ? "#0E1626" : "#EAF1FA";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = AZURE_DEEP;

  // --- COREOGRAFÍA DE ANIMACIONES ---
  const heroContentOpacity = useRef(new Animated.Value(0)).current;
  const heroContentTranslateY = useRef(new Animated.Value(30)).current;
  
  const mockupScale = useRef(new Animated.Value(0.85)).current;
  const mockupOpacity = useRef(new Animated.Value(0)).current;

  const featureAnims = useRef(FEATURES.map(() => new Animated.Value(0))).current;

  // Posiciones Y de cada sección "ancla" de la nav, capturadas vía onLayout
  // (relativas al contenido del ScrollView, ver docs/TRAMPAS.md si se toca este patrón).
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});

  const registerSection = (key: string) => (e: any) => {
    sectionY.current[key] = e.nativeEvent.layout.y;
  };

  const scrollToSection = (key: string) => {
    const y = sectionY.current[key];
    if (typeof y === "number") {
      scrollRef.current?.scrollTo({ y: Math.max(y - 88, 0), animated: true });
    }
  };

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(heroContentOpacity, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(heroContentTranslateY, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
      ]),
      Animated.parallel([
        Animated.timing(mockupOpacity, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
        Animated.spring(mockupScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: Platform.OS !== 'web' }),
      ]),
      Animated.stagger(80, 
        featureAnims.map(anim => 
          Animated.spring(anim, { toValue: 1, friction: 7, tension: 50, useNativeDriver: Platform.OS !== 'web' })
        )
      )
    ]).start();
  }, []);

  const containerStyle: any = Platform.OS === "web"
    ? { backgroundColor: bg, height: "100vh", width: "100%" }
    : { flex: 1, backgroundColor: bg };

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

  return (
    <View style={containerStyle}>
      <View style={[
        styles.navWrapper, 
        { backgroundColor: isDark ? 'rgba(11, 18, 32, 0.72)' : 'rgba(241, 245, 250, 0.78)', borderBottomColor: border },
        Platform.OS === 'web' && { backdropFilter: 'blur(20px) saturate(180%)' } as any
      ]}>
        <Navbar
          navigation={navigation}
          isDark={isDark}
          logoUri={require("../../assets/images/nexus-logo.png")}
          onNavLinkPress={scrollToSection}
        />
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 64, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        
        {/* --- HERO SECTION --- */}
        <View style={[styles.contentContainer, { paddingHorizontal: isMobile ? 16 : "5%" }]}>
          <View style={[styles.hero, { flexDirection: isMobile ? "column" : "row", paddingVertical: isMobile ? 40 : 140 }]}>
            
            <Animated.View style={[styles.heroLeft, { 
              width: isMobile ? "100%" : "48%", 
              opacity: heroContentOpacity,
              transform: [{ translateY: heroContentTranslateY }]
            }]}>
              <View style={[styles.badge, { backgroundColor: isDark ? "rgba(44,123,209,0.14)" : "#EAF4FC", borderColor: isDark ? "rgba(44,123,209,0.35)" : "#BEE3FA", marginBottom: isMobile ? 16 : 32 }]}>
                <Sparkles size={14} color={primaryColor} />
                <Text style={styles.badgeText}>La evolución del management</Text>
              </View>

              {/* TÍTULO COMPACTO PARA MÓVIL */}
              <Text style={[styles.heroTitle, { color: textPrimary, fontSize: isMobile ? 36 : 80, lineHeight: isMobile ? 42 : 84, marginBottom: isMobile ? 16 : 24 }]}>
                Proyectos con{"\n"}
                <Text style={{ color: primaryColor }}>inteligencia</Text> brutal.
              </Text>

              {/* DESCRIPCIÓN REFINADA Y MENOS PESADA */}
              <Text style={[styles.heroDesc, { color: textSecondary, fontSize: isMobile ? 15 : 20, lineHeight: isMobile ? 24 : 32, marginBottom: isMobile ? 24 : 48 }]}>
                Nexus unifica tus equipos, flujos y tareas bajo una IA que vive en tu infraestructura. Silenciosa, privada y ridículamente rápida.
              </Text>

              {/* BOTONES STACKED EN MÓVIL */}
              <View style={[styles.btnRow, { flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 16 }]}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.btnPrimary,
                    { backgroundColor: primaryColor, shadowColor: primaryColor, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 10, width: isMobile ? '100%' : 'auto', paddingVertical: isMobile ? 16 : 20, paddingHorizontal: isMobile ? 24 : 36 },
                    isWeb && ({ transitionProperty: 'transform, box-shadow', transitionDuration: '0.2s', transform: [{ translateY: hoverHeroPrimary ? -3 : 0 }], shadowOpacity: hoverHeroPrimary ? 0.55 : 0.4 } as any),
                  ]}
                  onPress={() => navigation.navigate("Register")}
                  {...(isWeb ? { onMouseEnter: () => setHoverHeroPrimary(true), onMouseLeave: () => setHoverHeroPrimary(false) } as any : {})}
                >
                  <Text style={[styles.btnPrimaryText, { fontSize: isMobile ? 16 : 18 }]}>Iniciar gratis</Text>
                  <ArrowRight size={isMobile ? 16 : 18} color="#FFF" strokeWidth={2.2} />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.btnSecondary,
                    { borderColor: border, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#FFF", width: isMobile ? '100%' : 'auto', paddingVertical: isMobile ? 16 : 20, paddingHorizontal: isMobile ? 24 : 36 },
                    isWeb && ({ transitionProperty: 'transform, border-color', transitionDuration: '0.2s', transform: [{ translateY: hoverHeroSecondary ? -3 : 0 }], borderColor: hoverHeroSecondary ? textSecondary : border } as any),
                  ]}
                  onPress={() => navigation.navigate("Login")}
                  {...(isWeb ? { onMouseEnter: () => setHoverHeroSecondary(true), onMouseLeave: () => setHoverHeroSecondary(false) } as any : {})}
                >
                  <Text style={[styles.btnSecondaryText, { color: textPrimary, fontSize: isMobile ? 16 : 18 }]}>Acceder</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* --- IMAGEN HERO DERECHA TOTALMENTE AFINADA --- */}
            <Animated.View style={[styles.heroRight, { 
              width: isMobile ? "100%" : "52%", 
              alignItems: isMobile ? 'center' : 'flex-end',
              opacity: mockupOpacity,
              marginTop: isMobile ? 48 : 0, 
              transform: [{ scale: mockupScale }]
            }]}>
              <View style={[
                styles.mockupWrapper, 
                ultraShadow,
                // ANCHO CONTROLADO Y BORDES REFINADOS
                isMobile && { 
                  width: '92%', 
                  maxWidth: 420, 
                  alignSelf: 'center',
                  backgroundColor: isDark ? "#0F172A" : "#FFFFFF", 
                  borderRadius: 24, 
                  padding: isDark ? 1 : 0, 
                  borderWidth: isDark ? 1 : 0, 
                  borderColor: border 
                } 
              ]}>
                <DashboardMockup />
              </View>
            </Animated.View>

          </View>
        </View>

        {/* --- CARRUSEL DE LOGOS (decorativo, ver LogoCarousel.tsx) --- */}
        <LogoCarousel isDark={isDark} isMobile={isMobile} />

        {/* --- CARACTERÍSTICAS --- */}
        <View onLayout={registerSection("features")} style={[styles.section, { backgroundColor: bg2, paddingVertical: isMobile ? 48 : 120 }]}>
          <View style={[styles.contentContainer, { maxWidth: 1536, paddingHorizontal: isMobile ? 16 : "5%" }]}>
            <Text style={[styles.sectionTitle, { color: textPrimary, fontSize: isMobile ? 28 : 44, marginBottom: isMobile ? 16 : 20 }]}>Potencia sin concesiones</Text>
            <Text style={[styles.sectionSub, { color: textSecondary, fontSize: isMobile ? 15 : 20, marginBottom: isMobile ? 32 : 64 }]}>Diseñado para equipos que exigen rendimiento, privacidad y estética.</Text>
            
            <View style={styles.featGrid}>
              {FEATURES.map((f, i) => (
                <Animated.View 
                  key={i} 
                  style={[
                    styles.featCard, 
                    { width: isMobile ? "100%" : 380, backgroundColor: cardBg, borderColor: border, borderWidth: 1, padding: isMobile ? 20 : 32 },
                    ultraShadow,
                    {
                      opacity: featureAnims[i],
                      transform: [
                        { translateY: featureAnims[i].interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                        { scale: featureAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }
                      ]
                    }
                  ]}
                >
                  <View style={[styles.featIcon, { backgroundColor: isDark ? "rgba(44,123,209,0.16)" : "#EAF4FC", width: isMobile ? 48 : 60, height: isMobile ? 48 : 60, marginBottom: isMobile ? 16 : 24 }]}>
                    <f.icon size={isMobile ? 20 : 26} color={primaryColor} strokeWidth={2.3} />
                  </View>
                  <Text style={[styles.featTitle, { color: textPrimary, fontSize: isMobile ? 17 : 22 }]}>{f.title}</Text>
                  <Text style={[styles.featDesc, { color: textSecondary, fontSize: isMobile ? 13 : 16, lineHeight: isMobile ? 20 : 26 }]}>{f.desc}</Text>
                </Animated.View>
              ))}
            </View>
          </View>
        </View>

        {/* --- INTEGRACIONES --- */}
        <View onLayout={registerSection("integrations")}>
          <IntegrationsSection isDark={isDark} isMobile={isMobile} />
        </View>

        {/* --- PRIVACIDAD / SELF-HOSTED (el diferenciador real, ver docs/ARQUITECTURA.md) --- */}
        <View onLayout={registerSection("privacy")}>
          <PricingSection isDark={isDark} isMobile={isMobile} />
        </View>

        {/* --- CTA FINAL --- */}
        <View style={[styles.cta, { backgroundColor: isDark ? "#0B1220" : "#FFFFFF", borderTopWidth: 1, borderTopColor: border, paddingVertical: isMobile ? 48 : 120, paddingHorizontal: isMobile ? 16 : 0 }]}>
          <View style={[styles.contentContainer, { maxWidth: 1000 }]}>
            <Text style={[styles.ctaTitle, { color: textPrimary, fontSize: isMobile ? 28 : 48, marginBottom: isMobile ? 16 : 24 }]}>Deja de gestionar. Empieza a crear.</Text>
            <Text style={[styles.ctaSub, { color: textSecondary, fontSize: isMobile ? 15 : 20, marginBottom: isMobile ? 24 : 48 }]}>
              Únete a los equipos que ya están construyendo el futuro con Nexus.
            </Text>
            <View style={[styles.btnRow, { justifyContent: "center" }]}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.btnPrimary,
                  { backgroundColor: textPrimary, paddingHorizontal: isMobile ? 24 : 40, paddingVertical: isMobile ? 16 : 20, width: isMobile ? '100%' : 'auto' },
                  isWeb && ({ transitionProperty: 'transform', transitionDuration: '0.2s', transform: [{ translateY: hoverCta ? -3 : 0 }] } as any),
                ]}
                onPress={() => navigation.navigate("Register")}
                {...(isWeb ? { onMouseEnter: () => setHoverCta(true), onMouseLeave: () => setHoverCta(false) } as any : {})}
              >
                <Text style={[styles.btnPrimaryText, { color: isDark ? "#0B1220" : "#FFFFFF", fontSize: isMobile ? 16 : 18 }]}>Crear mi Workspace</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Footer isDark={isDark} logoUri={require("../../assets/images/nexus-logo.png")} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  navWrapper: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 100, borderBottomWidth: 1, height: 72, justifyContent: "center",
  },
  contentContainer: {
    width: "100%", alignSelf: "center",
  },
  hero: {
    width: "100%", alignItems: "center", justifyContent: "space-between",
  },
  heroLeft: {
    paddingRight: Platform.OS === 'web' ? 40 : 0,
    zIndex: 10,
  },
  heroRight: {
    zIndex: 5,
  },
  mockupWrapper: {
    borderRadius: 28,
    borderWidth: Platform.OS === 'web' ? 0 : 1,
    borderColor: 'rgba(150,150,150,0.2)',
  },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1,
  },
  badgeText:        { color: "#2C7BD1", fontSize: 14, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  heroTitle:        { fontWeight: "700", letterSpacing: -2 },
  heroDesc:         { fontWeight: "400" },
  btnRow:           { alignItems: "center" },
  btnPrimary:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, borderRadius: 999 },
  btnPrimaryText:   { fontWeight: "700", color: "#FFF", letterSpacing: 0.3 },
  btnSecondary:     { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 999, borderWidth: 1 },
  btnSecondaryText: { fontWeight: "600", letterSpacing: 0.3 },
  section: {
    width: "100%",
  },
  sectionTitle:  { fontWeight: "700", textAlign: "center", letterSpacing: -1 },
  sectionSub:    { textAlign: "center", lineHeight: 30, maxWidth: 800, alignSelf: 'center', fontWeight: "400" },
  featGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 32, justifyContent: "center" },
  featCard: {
    borderRadius: 24,
  },
  featIcon:      { borderRadius: 18, justifyContent: "center", alignItems: "center" },
  featTitle:     { fontWeight: "600", marginBottom: 16, letterSpacing: -0.5 },
  featDesc:      { },
  cta:           { alignItems: "center", width: '100%' },
  ctaTitle:      { fontWeight: "700", textAlign: "center", letterSpacing: -1.5 },
  ctaSub:        { textAlign: "center", maxWidth: 800, alignSelf: 'center', lineHeight: 32 },
});