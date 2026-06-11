import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../context/ThemeContext";

export default function TasksScreen() {
  const { isDark } = useTheme();

  return (
    <ScrollView
      style={[
        styles.container,
        isDark && styles.darkContainer,
      ]}
    >
      <View style={styles.header}>
        <Text
          style={[
            styles.title,
            isDark && { color: "#F8FAFC" },
          ]}
        >
          Tasks
        </Text>

        <TouchableOpacity style={styles.addButton}>
          <Text style={styles.addButtonText}>
            + Nueva Tarea
          </Text>
        </TouchableOpacity>
      </View>

      {/* TODO */}

      <Text
        style={[
          styles.columnTitle,
          isDark && { color: "#F8FAFC" },
        ]}
      >
        Todo
      </Text>

      <View
        style={[
          styles.taskCard,
          isDark && { backgroundColor: "#1E293B" },
        ]}
      >
        <Text
          style={[
            styles.taskTitle,
            isDark && { color: "#F8FAFC" },
          ]}
        >
          Diseñar Landing Page
        </Text>

        <Text
          style={[
            styles.taskDescription,
            isDark && { color: "#94A3B8" },
          ]}
        >
          Crear diseño principal de ENZO.
        </Text>
      </View>

      <View
        style={[
          styles.taskCard,
          isDark && { backgroundColor: "#1E293B" },
        ]}
      >
        <Text
          style={[
            styles.taskTitle,
            isDark && { color: "#F8FAFC" },
          ]}
        >
          Crear sistema de login
        </Text>

        <Text
          style={[
            styles.taskDescription,
            isDark && { color: "#94A3B8" },
          ]}
        >
          Implementar autenticación.
        </Text>
      </View>

      {/* IN PROGRESS */}

      <Text
        style={[
          styles.columnTitle,
          isDark && { color: "#F8FAFC" },
        ]}
      >
        In Progress
      </Text>

      <View style={styles.activeTask}>
        <Text style={styles.taskTitleWhite}>
          Dashboard SaaS
        </Text>

        <Text style={styles.taskDescriptionWhite}>
          Construcción del panel principal.
        </Text>
      </View>

      {/* DONE */}

      <Text
        style={[
          styles.columnTitle,
          isDark && { color: "#F8FAFC" },
        ]}
      >
        Done
      </Text>

      <View
        style={[
          styles.doneTask,
          isDark && { backgroundColor: "#14532D" },
        ]}
      >
        <Text
          style={[
            styles.taskTitle,
            isDark && { color: "#F8FAFC" },
          ]}
        >
          Configuración Expo
        </Text>

        <Text style={styles.doneText}>
          ✔ Completado
        </Text>
      </View>

      <View
        style={[
          styles.doneTask,
          isDark && { backgroundColor: "#14532D" },
        ]}
      >
        <Text
          style={[
            styles.taskTitle,
            isDark && { color: "#F8FAFC" },
          ]}
        >
          Navegación inicial
        </Text>

        <Text style={styles.doneText}>
          ✔ Completado
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

  darkContainer: {
    backgroundColor: "#0F172A",
  },

  header: {
    marginTop: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#111827",
  },

  addButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },

  addButtonText: {
    color: "#FFF",
    fontWeight: "700",
  },

  columnTitle: {
    marginTop: 25,
    marginBottom: 10,
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },

  taskCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },

  activeTask: {
    backgroundColor: "#2563EB",
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },

  doneTask: {
    backgroundColor: "#DCFCE7",
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },

  taskTitle: {
    fontWeight: "800",
    fontSize: 16,
    color: "#111827",
  },

  taskDescription: {
    color: "#6B7280",
    marginTop: 6,
  },

  taskTitleWhite: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 16,
  },

  taskDescriptionWhite: {
    color: "#DBEAFE",
    marginTop: 6,
  },

  doneText: {
    color: "#16A34A",
    marginTop: 8,
    fontWeight: "700",
  },
});