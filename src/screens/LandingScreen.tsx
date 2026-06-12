import React, { useEffect, useRef } from "react";
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

const FEATURES = [
  { icon: Sparkles,   title: "Semillero IA",        desc: "Describe tu proyecto y la IA forma el equipo ideal basándose en perfiles reales de tu organización." },
  { icon: Lock,       title: "Self-hosted & privado", desc: "La IA corre en tu servidor. Tus datos nunca salen de tu red. Ideal para corporativos y gobierno." },
  { icon: LayoutGrid, title: "Múltiples vistas",      desc: "Kanban, Lista, Timeline y Dashboard. La misma información, cuatro lentes distintos." },
  { icon: BarChart3,  title: "Reportes con IA",       desc: "Análisis automático de desempeño, avance y predicciones en lenguaje natural." },
  { icon: Building2,  title: "Workspaces con marca",  desc: "Cada organización personaliza su workspace con colores y logo propios." },
  { icon: UserCheck,  title: "Client Room",           desc: "Vista curada para clientes externos. Solo ven lo que tú decides mostrarles." },
];

const INTEGRATIONS = [
  "GitHub", "Slack", "Google Drive", "Google Calendar",
  "Trello", "Discord", "Microsoft Teams", "Jira",
];

export default function LandingScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Paleta Premium (Contrastes agresivos)
  const bg            = isDark ? "#020617" : "#FAFAFA"; 
  const cardBg        = isDark ? "rgba(15, 23, 42, 0.8)" : "rgba(255, 255, 255, 0.9)"; 
  const bg2           = isDark ? "#0B1120" : "#F1F5F9";
  const border        = isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(226, 232, 240, 0.8)";
  const textPrimary   = isDark ? "#F8FAFC" : "#020617";
  const textSecondary = isDark ? "#94A3B8" : "#475569";
  const primaryColor  = "#2563EB";

  // --- COREOGRAFÍA DE ANIMACIONES ---
  const heroContentOpacity = useRef(new Animated.Value(0)).current;
  const heroContentTranslateY = useRef(new Animated.Value(30)).current;
  
  const mockupScale = useRef(new Animated.Value(0.85)).current;
  const mockupOpacity = useRef(new Animated.Value(0)).current;

  const featureAnims = useRef(FEATURES.map(() => new Animated.Value(0))).current;

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

  const ultraShadow = Platform.select({
    web: {
      boxShadow: isDark 
        ? "0 25px 50px -12px rgba(0,0,0,1), 0 0 0 1px rgba(255,255,255,0.05) inset"
        : "0 30px 60px -15px rgba(0,0,0,0.08), 0 10px 30px -5px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02) inset",
      backdropFilter: "blur(12px)", 
    } as any,
    default: {
      // SOMBRA ESPECÍFICA PARA MÓVIL: Sutil, elegante, no rústica.
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.4 : 0.05,
      shadowRadius: 12,
      elevation: 6, 
    },
  });

  return (
    <View style={containerStyle}>
      <View style={[
        styles.navWrapper, 
        { backgroundColor: isDark ? 'rgba(2, 6, 23, 0.9)' : 'rgba(250, 250, 250, 0.9)', borderBottomColor: border },
        Platform.OS === 'web' && { backdropFilter: 'blur(10px)' } as any
      ]}>
        <Navbar navigation={navigation} isDark={isDark} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 64, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        
        {Platform.OS === 'web' && (
          <View style={styles.backgroundTextureContainer}>
            <View style={[styles.glowOrb, { top: -100, left: '-10%', backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : 'rgba(37, 99, 235, 0.08)' }]} />
            <View style={[styles.glowOrb, { top: 300, right: '-5%', backgroundColor: isDark ? 'rgba(124, 58, 237, 0.12)' : 'rgba(124, 58, 237, 0.05)' }]} />
            <View style={[styles.glowOrb, { top: '60%', left: '20%', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.03)' }]} />
          </View>
        )}

        {/* --- HERO SECTION --- */}
        <View style={[styles.contentContainer, { paddingHorizontal: isMobile ? 16 : "5%" }]}>
          <View style={[styles.hero, { flexDirection: isMobile ? "column" : "row", paddingVertical: isMobile ? 40 : 140 }]}>
            
            <Animated.View style={[styles.heroLeft, { 
              width: isMobile ? "100%" : "48%", 
              opacity: heroContentOpacity,
              transform: [{ translateY: heroContentTranslateY }]
            }]}>
              <View style={[styles.badge, { backgroundColor: isDark ? "rgba(37, 99, 235, 0.1)" : "#EFF6FF", borderColor: isDark ? "rgba(37, 99, 235, 0.3)" : "#BFDBFE", marginBottom: isMobile ? 16 : 32 }]}>
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
                <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: primaryColor, shadowColor: primaryColor, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 10, width: isMobile ? '100%' : 'auto', paddingVertical: isMobile ? 16 : 20, paddingHorizontal: isMobile ? 24 : 36 }]} onPress={() => navigation.navigate("Register")}>
                  <Text style={[styles.btnPrimaryText, { fontSize: isMobile ? 16 : 18 }]}>Iniciar gratis</Text>
                  <ArrowRight size={isMobile ? 16 : 18} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnSecondary, { borderColor: border, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#FFF", width: isMobile ? '100%' : 'auto', paddingVertical: isMobile ? 16 : 20, paddingHorizontal: isMobile ? 24 : 36 }]} onPress={() => navigation.navigate("Login")}>
                  <Text style={[styles.btnSecondaryText, { color: textPrimary, fontSize: isMobile ? 16 : 18 }]}>Ver demo</Text>
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

        {/* --- CARACTERÍSTICAS --- */}
        <View style={[styles.section, { backgroundColor: bg2, paddingVertical: isMobile ? 48 : 120 }]}>
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
                  <View style={[styles.featIcon, { backgroundColor: isDark ? "rgba(37,99,235,0.15)" : "#EFF6FF", width: isMobile ? 48 : 60, height: isMobile ? 48 : 60, marginBottom: isMobile ? 16 : 24 }]}>
                    <f.icon size={isMobile ? 20 : 26} color={primaryColor} />
                  </View>
                  <Text style={[styles.featTitle, { color: textPrimary, fontSize: isMobile ? 17 : 22 }]}>{f.title}</Text>
                  <Text style={[styles.featDesc, { color: textSecondary, fontSize: isMobile ? 13 : 16, lineHeight: isMobile ? 20 : 26 }]}>{f.desc}</Text>
                </Animated.View>
              ))}
            </View>
          </View>
        </View>

        {/* --- CTA FINAL --- */}
        <View style={[styles.cta, { backgroundColor: isDark ? "#020617" : "#FFFFFF", borderTopWidth: 1, borderTopColor: border, paddingVertical: isMobile ? 48 : 120, paddingHorizontal: isMobile ? 16 : 0 }]}>
          <View style={[styles.contentContainer, { maxWidth: 1000 }]}>
            <Text style={[styles.ctaTitle, { color: textPrimary, fontSize: isMobile ? 28 : 48, marginBottom: isMobile ? 16 : 24 }]}>Deja de gestionar. Empieza a crear.</Text>
            <Text style={[styles.ctaSub, { color: textSecondary, fontSize: isMobile ? 15 : 20, marginBottom: isMobile ? 24 : 48 }]}>
              Únete a los equipos que ya están construyendo el futuro con Nexus.
            </Text>
            <View style={[styles.btnRow, { justifyContent: "center" }]}>
              <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: textPrimary, paddingHorizontal: isMobile ? 24 : 40, paddingVertical: isMobile ? 16 : 20, width: isMobile ? '100%' : 'auto' }]} onPress={() => navigation.navigate("Register")}>
                <Text style={[styles.btnPrimaryText, { color: isDark ? "#020617" : "#FFFFFF", fontSize: isMobile ? 16 : 18 }]}>Crear mi Workspace</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Footer isDark={isDark} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backgroundTextureContainer: {
    position: 'absolute', width: '100%', height: 1200, overflow: 'hidden', zIndex: -1,
  },
  glowOrb: {
    position: 'absolute', width: 800, height: 800, borderRadius: 400, filter: 'blur(150px)', 
  } as any,
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
    borderRadius: 24,
    borderWidth: Platform.OS === 'web' ? 0 : 1, 
    borderColor: 'rgba(150,150,150,0.2)', 
  },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1,
  },
  badgeText:        { color: "#2563EB", fontSize: 14, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  heroTitle:        { fontWeight: "900", letterSpacing: -2 }, 
  heroDesc:         { fontWeight: "400" },
  btnRow:           { alignItems: "center" },
  btnPrimary:       { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 999 },
  btnPrimaryText:   { fontWeight: "700" },
  btnSecondary:     { flexDirection: "row", alignItems: "center", borderRadius: 999, borderWidth: 1 },
  btnSecondaryText: { fontWeight: "600" },
  section: {
    width: "100%",
  },
  sectionTitle:  { fontWeight: "900", textAlign: "center", letterSpacing: -1 },
  sectionSub:    { textAlign: "center", lineHeight: 30, maxWidth: 800, alignSelf: 'center', fontWeight: "400" },
  featGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 32, justifyContent: "center" },
  featCard: {
    borderRadius: 24,
  },
  featIcon:      { borderRadius: 18, justifyContent: "center", alignItems: "center" },
  featTitle:     { fontWeight: "800", marginBottom: 16, letterSpacing: -0.5 },
  featDesc:      { },
  cta:           { alignItems: "center", width: '100%' },
  ctaTitle:      { fontWeight: "900", textAlign: "center", letterSpacing: -1.5 },
  ctaSub:        { textAlign: "center", maxWidth: 800, alignSelf: 'center', lineHeight: 32 },
});