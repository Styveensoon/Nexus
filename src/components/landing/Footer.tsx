import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";

import {
  Sparkles,
  Globe,
  Mail,
  Code,
} from "lucide-react-native";

import { useTheme } from "../../context/ThemeContext";

const { width } = Dimensions.get("window");
const isMobile = width < 768;

export default function Footer() {
  const { isDark } = useTheme();

  return (
    <View style={[styles.footer, isDark && styles.footerDark]}>
      <View style={[styles.content, isMobile && styles.mobileContent]}>
        {/* LOGO */}
        <View style={styles.brandSection}>
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <Sparkles size={16} color="#FFFFFF" />
            </View>
            <Text style={[styles.logoText, isDark && styles.darkText]}>
              Nexus
            </Text>
          </View>

          <Text style={[styles.brandDescription, isDark && styles.darkSubText]}>
            Plataforma moderna para la gestión de proyectos, equipos, tareas e
            incidencias impulsada por inteligencia artificial.
          </Text>

          <View style={styles.socials}>
            <SocialButton icon={<Code size={18} color="#6B7280" />} />
            <SocialButton icon={<Globe size={18} color="#6B7280" />} />
            <SocialButton icon={<Mail size={18} color="#6B7280" />} />
          </View>
        </View>

        <FooterColumn
          title="Producto"
          items={["Características", "Integraciones", "Dashboard", "Roadmap"]}
          isDark={isDark}
        />

        <FooterColumn
          title="Empresa"
          items={["Nosotros", "Contacto", "Blog", "Carreras"]}
          isDark={isDark}
        />

        <FooterColumn
          title="Recursos"
          items={["Documentación", "Soporte", "API", "Guías"]}
          isDark={isDark}
        />

        <FooterColumn
          title="Legal"
          items={["Privacidad", "Términos", "Cookies", "Licencias"]}
          isDark={isDark}
        />
      </View>

      {/* BOTTOM */}
      <View style={[styles.bottom, isDark && styles.bottomDark]}>
        <Text style={[styles.copyright, isDark && styles.darkSubText]}>
          © 2026 Nexus Technologies. Todos los derechos reservados.
        </Text>

        {!isMobile && (
          <View style={styles.bottomLinks}>
            <Text style={styles.bottomLink}>Privacidad</Text>
            <Text style={styles.bottomLink}>Términos</Text>
            <Text style={styles.bottomLink}>Seguridad</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function FooterColumn({ title, items, isDark }: any) {
  return (
    <View style={styles.column}>
      <Text style={[styles.columnTitle, isDark && styles.darkText]}>
        {title}
      </Text>
      {items.map((item: string) => (
        <TouchableOpacity key={item} style={styles.linkContainer}>
          <Text style={[styles.link, isDark && styles.darkSubText]}>
            {item}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SocialButton({ icon }: any) {
  return (
    <TouchableOpacity style={styles.socialButton}>{icon}</TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: 80,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderColor: "#E5E7EB",
  },
  footerDark: {
    backgroundColor: "#111827",
    borderColor: "#1F2937",
  },
  content: {
    paddingHorizontal: 40,
    paddingVertical: 60,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  mobileContent: {
    flexDirection: "column",
    gap: 40,
  },
  brandSection: {
    maxWidth: 320,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: {
    fontSize: 24,
    fontWeight: "800",
    marginLeft: 10,
    color: "#111827",
  },
  darkText: {
    color: "#FFFFFF",
  },
  darkSubText: {
    color: "#CBD5E1",
  },
  brandDescription: {
    marginTop: 18,
    lineHeight: 22,
    color: "#6B7280",
  },
  socials: {
    flexDirection: "row",
    marginTop: 24,
    gap: 12,
  },
  socialButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  column: {
    minWidth: 130,
  },
  columnTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 18,
  },
  linkContainer: {
    marginBottom: 12,
  },
  link: {
    color: "#6B7280",
    fontSize: 14,
  },
  bottom: {
    borderTopWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 40,
    paddingVertical: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bottomDark: {
    borderColor: "#1F2937",
  },
  copyright: {
    color: "#6B7280",
    fontSize: 13,
  },
  bottomLinks: {
    flexDirection: "row",
    gap: 20,
  },
  bottomLink: {
    color: "#6B7280",
    fontSize: 13,
  },
});