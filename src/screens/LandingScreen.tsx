import React from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
} from "react-native";

import {
  ArrowRight,
  Sparkles,
  Folder,
  Users,
  ListChecks,
} from "lucide-react-native";

import { useTheme } from "../context/ThemeContext";

import Navbar from "../components/landing/Navbar";
import Footer from "../components/landing/Footer";
import DashboardMockup from "../components/landing/DashboardMockup";

const integrations = [
  { name: "GitHub", icon: Folder },
  { name: "GitLab", icon: Folder },
  { name: "Jira", icon: Folder },
  { name: "Trello", icon: Folder },
  { name: "Slack", icon: Users },
  { name: "Discord", icon: Users },
  { name: "Google Workspace", icon: ListChecks },
  { name: "Microsoft Teams", icon: Users },
];

const { width } = Dimensions.get("window");
const isMobile = width < 768;

export default function LandingScreen({ navigation }: any) {
  const { isDark } = useTheme();

  return (
    <ScrollView style={[styles.container, isDark && styles.darkContainer]}>
      <Navbar navigation={navigation} />

      {/* HERO */}
      <View style={styles.hero}>
        <View style={[styles.heroContent, isMobile && styles.heroContentMobile]}>
          <View style={styles.heroLeft}>
            <View style={styles.badge}>
              <Sparkles size={14} color="#2563EB" />
              <Text style={styles.badgeText}>
                Nueva generación de gestión de proyectos
              </Text>
            </View>

            <Text style={styles.heroTitle}>
              Gestiona proyectos, equipos y tareas desde un solo lugar.
            </Text>

            <Text style={styles.heroDesc}>
              Nexus centraliza proyectos, tareas, incidencias, colaboración y
              reportes inteligentes para que tu equipo trabaje de forma más
              rápida y organizada.
            </Text>

            <View style={styles.heroButtons}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => navigation.navigate("Register")}
              >
                <Text style={styles.primaryText}>Comenzar ahora</Text>
                <ArrowRight size={16} color="#FFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => navigation.navigate("Login")}
              >
                <Text style={styles.secondaryText}>Iniciar sesión</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.heroRight}>
            <DashboardMockup />
          </View>
        </View>
      </View>

      {/* CAROUSEL */}
      <View style={styles.carouselSection}>
        <Text style={styles.sectionTitle}>
          Todo lo que necesitas para gestionar proyectos
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContainer}
        >
          {[
            {
              title: "Gestión de proyectos",
              image: require("../../assets/images/dashboard.png"),
            },
            {
              title: "Colaboración en tiempo real",
              image: require("../../assets/images/collaboration.jpg"),
            },
            {
              title: "Seguimiento de incidencias",
              image: require("../../assets/images/review.jpg"),
            },
            {
              title: "Reportes avanzados",
              image: require("../../assets/images/deploy.jpg"),
            },
          ].map((item, index) => (
            <View key={index} style={styles.carouselCard}>
              <Image
                source={item.image}
                style={styles.carouselImage}
                resizeMode="cover"
              />
              <View style={styles.carouselOverlay}>
                <Text style={styles.carouselTitle}>{item.title}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* INTEGRATIONS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Integraciones</Text>
        <View style={styles.integrationGrid}>
          {integrations.map((item, index) => (
            <View key={index} style={styles.integrationCard}>
              <item.icon size={20} color="#2563EB" />
              <Text style={styles.integrationName}>{item.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* VIDEO PLACEHOLDER */}
      <View style={styles.videoSection}>
        <View style={styles.videoBox}>
          <Text style={styles.videoText}>📹 Demo en video próximamente</Text>
        </View>
      </View>

      {/* CTA */}
      <View style={styles.ctaSection}>
        <Text style={styles.ctaTitle}>
          Comienza a trabajar de forma más inteligente
        </Text>
        <Text style={styles.ctaText}>
          Crea tu cuenta y lleva la gestión de tus proyectos al siguiente nivel.
        </Text>
        <View style={styles.ctaButtons}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate("Register")}
          >
            <Text style={styles.primaryText}>Registrarse</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.secondaryText}>Iniciar sesión</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  darkContainer: {
    backgroundColor: "#111827",
  },
  hero: {
    paddingHorizontal: 40,
    paddingVertical: 60,
    alignItems: "center",
  },
  heroContent: {
    width: "100%",
    maxWidth: 1400,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 40,
  },
  heroContentMobile: {
    flexDirection: "column",
  },
  heroLeft: {
    flex: 1,
  },
  heroRight: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  badgeText: {
    color: "#2563EB",
    fontWeight: "600",
    fontSize: 12,
  },
  heroTitle: {
    fontSize: isMobile ? 36 : 56,
    fontWeight: "800",
    color: "#111827",
    marginTop: 20,
  },
  heroDesc: {
    fontSize: isMobile ? 16 : 18,
    lineHeight: 30,
    color: "#6B7280",
    marginTop: 20,
    maxWidth: 650,
  },
  heroButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 30,
  },
  primaryBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
  },
  secondaryText: {
    fontWeight: "600",
    color: "#111827",
  },
  section: {
    paddingHorizontal: 40,
    paddingVertical: 60,
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 34,
    fontWeight: "800",
    marginBottom: 30,
    color: "#111827",
  },
  integrationGrid: {
    width: "100%",
    maxWidth: 1000,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
  },
  integrationCard: {
    width: isMobile ? "45%" : 180,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  integrationName: {
    marginTop: 10,
    fontWeight: "700",
    color: "#111827",
  },
  carouselSection: {
    paddingVertical: 60,
  },
  carouselContainer: {
    paddingHorizontal: 24,
  },
  carouselCard: {
    width: isMobile ? 280 : 380,
    height: isMobile ? 180 : 250,
    marginRight: 20,
    borderRadius: 24,
    overflow: "hidden",
  },
  carouselImage: {
    width: "100%",
    height: "100%",
  },
  carouselOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  carouselTitle: {
    color: "#FFFFFF",
    fontSize: isMobile ? 20 : 28,
    fontWeight: "700",
  },
  videoSection: {
    width: "100%",
    maxWidth: 1200,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  videoBox: {
    height: isMobile ? 220 : 400,
    borderRadius: 30,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },
  videoText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  ctaSection: {
    paddingHorizontal: 40,
    paddingVertical: 80,
    alignItems: "center",
  },
  ctaTitle: {
    fontSize: isMobile ? 32 : 42,
    fontWeight: "800",
    textAlign: "center",
    color: "#111827",
  },
  ctaText: {
    marginTop: 16,
    fontSize: 18,
    color: "#6B7280",
    textAlign: "center",
    maxWidth: 700,
  },
  ctaButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 30,
  },
});