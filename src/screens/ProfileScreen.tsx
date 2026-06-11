import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "../context/ThemeContext";

export default function ProfileScreen() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <ScrollView
      style={[
        styles.container,
        isDark && styles.darkContainer,
      ]}
    >
      {/* PROFILE HEADER */}
      <View
        style={[
          styles.profileCard,
          isDark && styles.darkCard,
        ]}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>RH</Text>
        </View>

        <Text style={[styles.name, isDark && styles.darkText]}>
          Raúl Hernández
        </Text>

        <Text style={[styles.email, isDark && styles.darkSubText]}>
          raul@enzo.app
        </Text>

        <View style={styles.proBadge}>
          <Text style={styles.proText}>ENZO PRO</Text>
        </View>
      </View>

      {/* STATS */}
      <View style={styles.statsRow}>
        {["Projects", "Tasks", "Team"].map((label, i) => (
          <View
            key={i}
            style={[styles.statCard, isDark && styles.darkCard]}
          >
            <Text style={styles.statNumber}>
              {[24, 156, 12][i]}
            </Text>
            <Text style={[styles.statLabel, isDark && styles.darkSubText]}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      {/* SETTINGS */}
      <View style={[styles.section, isDark && styles.darkCard]}>
        <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
          App Settings
        </Text>

        <View style={styles.settingRow}>
          <Text style={[styles.settingText, isDark && styles.darkText]}>
            Tema oscuro
          </Text>

          <TouchableOpacity
            onPress={toggleTheme}
            style={[
              styles.toggle,
              isDark && styles.toggleActive,
            ]}
          >
            <View
              style={[
                styles.toggleCircle,
                isDark && styles.toggleCircleActive,
              ]}
            />
          </TouchableOpacity>
        </View>

        <Text style={[styles.settingHint, isDark && styles.darkSubText]}>
          Cambia entre modo claro y oscuro
        </Text>
      </View>

      {/* WORKSPACE */}
      <View style={[styles.section, isDark && styles.darkCard]}>
        <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
          Workspace
        </Text>

        {["Upgrade Plan", "Settings", "Notifications"].map((item, i) => (
          <TouchableOpacity key={i} style={styles.menuItem}>
            <Text style={styles.menuText}>• {item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* LOGOUT */}
      <TouchableOpacity style={styles.logoutButton}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>

      <Text style={styles.version}>ENZO v1.0.0</Text>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 20,
  },

  darkContainer: {
    backgroundColor: "#0F172A",
  },

  profileCard: {
    marginTop: 50,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 30,
    alignItems: "center",
  },

  darkCard: {
    backgroundColor: "#1E293B",
  },

  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    color: "#FFF",
    fontSize: 28,
    fontWeight: "900",
  },

  name: {
    fontSize: 24,
    fontWeight: "900",
    marginTop: 18,
    color: "#111827",
  },

  email: {
    color: "#6B7280",
    marginTop: 5,
  },

  darkText: {
    color: "#F8FAFC",
  },

  darkSubText: {
    color: "#CBD5E1",
  },

  proBadge: {
    marginTop: 15,
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },

  proText: {
    color: "#2563EB",
    fontWeight: "800",
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },

  statCard: {
    backgroundColor: "#FFFFFF",
    width: "31%",
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
  },

  statNumber: {
    fontSize: 24,
    fontWeight: "900",
    color: "#2563EB",
  },

  statLabel: {
    color: "#6B7280",
    marginTop: 5,
  },

  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginTop: 20,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 15,
  },

  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  settingText: {
    fontSize: 16,
    fontWeight: "600",
  },

  settingHint: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 8,
  },

  toggle: {
    width: 50,
    height: 28,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    padding: 3,
  },

  toggleActive: {
    backgroundColor: "#2563EB",
  },

  toggleCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFF",
  },

  toggleCircleActive: {
    marginLeft: 22,
  },

  menuItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  menuText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },

  logoutButton: {
    marginTop: 25,
    backgroundColor: "#EF4444",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
  },

  logoutText: {
    color: "#FFF",
    fontWeight: "800",
  },

  version: {
    textAlign: "center",
    color: "#94A3B8",
    marginTop: 20,
    marginBottom: 50,
  },
});