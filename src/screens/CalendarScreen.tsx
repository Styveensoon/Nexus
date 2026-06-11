import React from "react";
import { useTheme } from "../context/ThemeContext";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function CalendarScreen() {
  const { isDark } = useTheme();

  return (
    <ScrollView
      style={[styles.container, isDark && styles.darkContainer]}
    >
      <Text style={[styles.title, isDark && styles.darkText]}>
        Calendar
      </Text>

      <Text style={[styles.subtitle, isDark && styles.darkSubText]}>
        Organiza reuniones, tareas y deadlines
      </Text>

      {/* TODAY */}
      <Text style={[styles.section, isDark && styles.darkAccent]}>
        Hoy
      </Text>

      <View style={[styles.eventCard, isDark && styles.darkCard]}>
        <Text style={[styles.eventTitle, isDark && styles.darkText]}>
          Reunión con equipo ENZO
        </Text>
        <Text style={[styles.eventTime, isDark && styles.darkSubText]}>
          10:00 AM - 11:30 AM
        </Text>
      </View>

      <View style={[styles.eventCard, isDark && styles.darkCard]}>
        <Text style={[styles.eventTitle, isDark && styles.darkText]}>
          Revisión de proyecto
        </Text>
        <Text style={[styles.eventTime, isDark && styles.darkSubText]}>
          1:00 PM - 2:00 PM
        </Text>
      </View>

      {/* UPCOMING */}
      <Text style={[styles.section, isDark && styles.darkAccent]}>
        Próximos días
      </Text>

      <View style={[styles.eventCardAlt, isDark && styles.darkCard]}>
        <Text style={[styles.eventTitle, isDark && styles.darkText]}>
          Deploy producción
        </Text>
        <Text style={[styles.eventTime, isDark && styles.darkSubText]}>
          Mañana - 6:00 PM
        </Text>
      </View>

      <View style={[styles.eventCardAlt, isDark && styles.darkCard]}>
        <Text style={[styles.eventTitle, isDark && styles.darkText]}>
          Sprint Planning
        </Text>
        <Text style={[styles.eventTime, isDark && styles.darkSubText]}>
          Viernes - 9:00 AM
        </Text>
      </View>

    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 20,
  },

  title: {
    marginTop: 50,
    fontSize: 32,
    fontWeight: "900",
    color: "#111827",
  },

  subtitle: {
    color: "#6B7280",
    marginTop: 8,
    marginBottom: 20,
  },

  section: {
    marginTop: 25,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: "800",
    color: "#2563EB",
  },

  eventCard: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 18,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#2563EB",
  },

  eventCardAlt: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 18,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#10B981",
  },

  eventTitle: {
    fontWeight: "800",
    color: "#111827",
  },

  eventTime: {
    color: "#6B7280",
    marginTop: 6,
  },
  darkContainer: {
  backgroundColor: "#0F172A",
    },

    darkCard: {
    backgroundColor: "#1E293B",
    },

    darkText: {
    color: "#F8FAFC",
    },

    darkSubText: {
    color: "#CBD5E1",
    },

    darkAccent: {
    color: "#60A5FA",
    },
});