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
import { Sparkles, Globe, Mail, Code } from "lucide-react-native";

interface FooterProps {
  isDark: boolean;
  logoUri?: ImageSourcePropType;
}

const COLUMNS = [
  { title: "Producto", items: ["Características", "Integraciones", "Dashboard", "Roadmap"] },
  { title: "Empresa",  items: ["Nosotros", "Contacto", "Blog", "Carreras"] },
  { title: "Recursos", items: ["Documentación", "Soporte", "API", "Guías"] },
  { title: "Legal",    items: ["Privacidad", "Términos", "Cookies", "Licencias"] },
];

export default function Footer({ isDark, logoUri }: FooterProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;

  const bg            = isDark ? "#111827" : "#FFFFFF";
  const border        = isDark ? "#374151" : "#E5E7EB";
  const textPrimary   = isDark ? "#FFFFFF" : "#111827";
  const textSecondary = isDark ? "#9CA3AF" : "#6B7280";
  const socialBg      = isDark ? "#1F2937" : "#F3F4F6";

  const paddingH = isMobile ? 24 : "5%";

  return (
    <View style={[styles.footer, { backgroundColor: bg, borderTopColor: border }]}>
      {/* Quitamos maxWidth y aplicamos el margen dinámico */}
      <View style={[styles.content, isMobile && styles.contentMobile, { paddingHorizontal: paddingH }]}>
        
        <View style={[styles.brand, isMobile && styles.brandMobile]}>
          <View style={styles.logoRow}>
            {logoUri ? (
              <Image source={logoUri} style={styles.logoImage} resizeMode="contain" />
            ) : (
              <View style={styles.logoIcon}>
                <Sparkles size={16} color="#FFFFFF" />
              </View>
            )}
            <Text style={[styles.logoText, { color: textPrimary }]}>Nexus</Text>
          </View>

          <Text style={[styles.brandDesc, { color: textSecondary }, isMobile && { textAlign: 'center' }]}>
            Plataforma moderna para la gestión de proyectos, equipos y tareas
            impulsada por inteligencia artificial local.
          </Text>

          <View style={[styles.socials, isMobile && { justifyContent: 'center' }]}>
            {[Code, Globe, Mail].map((Icon, i) => (
              <TouchableOpacity key={i} style={[styles.socialBtn, { backgroundColor: socialBg }]}>
                <Icon size={18} color={textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.linksContainer, isMobile && styles.linksContainerMobile]}>
          {COLUMNS.map((col) => (
            <View key={col.title} style={[styles.column, isTablet && styles.columnTablet]}>
              <Text style={[styles.colTitle, { color: textPrimary }]}>{col.title}</Text>
              {col.items.map((item) => (
                <TouchableOpacity key={item} style={styles.linkContainer}>
                  <Text style={[styles.link, { color: textSecondary }]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.bottom, { borderTopColor: border, flexDirection: isMobile ? 'column' : 'row', paddingHorizontal: paddingH }]}>
        <Text style={[styles.copyright, { color: textSecondary }, isMobile && { marginBottom: 12 }]}>
          © {new Date().getFullYear()} Nexus Technologies. Todos los derechos reservados.
        </Text>
        <View style={styles.bottomLinks}>
          {["Privacidad", "Términos", "Seguridad"].map((l) => (
            <TouchableOpacity key={l}>
              <Text style={[styles.bottomLink, { color: textSecondary }]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { borderTopWidth: 1, alignItems: 'center', width: '100%' },
  content: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    paddingVertical: 60, 
    width: "100%", // Expandido sin límite
    gap: 40 
  },
  contentMobile: { flexDirection: "column", alignItems: "center" },
  brand: { maxWidth: 320 },
  brandMobile: { alignItems: 'center', marginBottom: 20 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  logoIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: "#2563EB", justifyContent: "center", alignItems: "center" },
  logoImage: { width: 34, height: 34, borderRadius: 8 },
  logoText: { fontSize: 20, fontWeight: "700", letterSpacing: -0.5 },
  brandDesc: { fontSize: 14, lineHeight: 22, marginBottom: 24 },
  socials: { flexDirection: "row", gap: 12 },
  socialBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  linksContainer: { flex: 1, flexDirection: "row", justifyContent: "flex-end", gap: 40, flexWrap: "wrap" },
  linksContainerMobile: { justifyContent: "center", width: "100%", marginTop: 20 },
  column: { minWidth: 120, marginBottom: 20 },
  columnTablet: { minWidth: '40%' },
  colTitle: { fontSize: 15, fontWeight: "600", marginBottom: 16 },
  linkContainer: { marginBottom: 12 },
  link: { fontSize: 14 },
  bottom: { 
    borderTopWidth: 1, 
    paddingVertical: 24, 
    justifyContent: "space-between", 
    alignItems: "center", 
    width: "100%" // Expandido sin límite
  },
  copyright: { fontSize: 13 },
  bottomLinks: { flexDirection: "row", gap: 24, flexWrap: 'wrap', justifyContent: 'center' },
  bottomLink: { fontSize: 13, fontWeight: "500" },
});