import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "../context/ThemeContext";
import { COLORS } from "../styles/colors";

export default function ProjectsScreen() {
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();

  const isTablet = width >= 768;

  const [selectedFilter, setSelectedFilter] = useState("Todos");

  const theme = {
    background: isDark ? "#0F172A" : COLORS.background,
    card: isDark ? "#1E293B" : "#FFFFFF",
    text: isDark ? "#F8FAFC" : COLORS.text,
    secondary: isDark ? "#CBD5E1" : COLORS.textSecondary,
    border: isDark ? "#334155" : COLORS.border,
  };

  const projects = [
    {
      id: 1,
      name: "Nexus Web Platform",
      description: "Producto principal SaaS",
      progress: 72,
      members: 12,
      status: "Activo",
      color: "#2563EB",
    },
    {
      id: 2,
      name: "Mobile App",
      description: "Aplicación iOS y Android",
      progress: 45,
      members: 6,
      status: "En revisión",
      color: "#EC4899",
    },
    {
      id: 3,
      name: "Checkout V2",
      description: "Sistema de pagos",
      progress: 30,
      members: 8,
      status: "Planning",
      color: "#F59E0B",
    },
    {
      id: 4,
      name: "Internal AI",
      description: "Motor IA de Nexus",
      progress: 20,
      members: 3,
      status: "Activo",
      color: "#06B6D4",
    },
  ];

  const filters = [
    "Todos",
    "Activo",
    "En revisión",
    "Planning",
  ];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* HEADER */}

        <View style={styles.header}>
          <View>
            <Text
              style={[
                styles.subtitle,
                { color: theme.secondary },
              ]}
            >
              Workspace
            </Text>

            <Text
              style={[
                styles.title,
                { color: theme.text },
              ]}
            >
              Projects
            </Text>
          </View>

          <TouchableOpacity
            style={styles.profileButton}
          >
            <Text style={styles.profileText}>
              SL
            </Text>
          </TouchableOpacity>
        </View>

        {/* SEARCH */}

        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <Ionicons
            name="search"
            size={20}
            color={theme.secondary}
          />

          <TextInput
            placeholder="Buscar proyecto..."
            placeholderTextColor={theme.secondary}
            style={[
              styles.searchInput,
              { color: theme.text },
            ]}
          />
        </View>

        {/* AI CARD */}

        <LinearGradient
          colors={[
            COLORS.primary,
            COLORS.primaryDark,
          ]}
          style={styles.aiCard}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.aiLabel}>
              NEXUS AI
            </Text>

            <Text style={styles.aiTitle}>
              3 proyectos requieren atención
            </Text>

            <Text style={styles.aiDescription}>
              Detectamos retrasos y tareas pendientes.
            </Text>
          </View>

          <Ionicons
            name="sparkles"
            size={50}
            color="#FFF"
          />
        </LinearGradient>

        {/* STATS */}

        <View
          style={[
            styles.statsContainer,
            isTablet && styles.statsTablet,
          ]}
        >
          <StatCard
            title="Projects"
            value="24"
            icon="folder"
            color="#2563EB"
            theme={theme}
          />

          <StatCard
            title="Active"
            value="12"
            icon="flash"
            color="#10B981"
            theme={theme}
          />

          <StatCard
            title="Teams"
            value="7"
            icon="people"
            color="#F59E0B"
            theme={theme}
          />

          <StatCard
            title="Tasks"
            value="184"
            icon="checkmark-circle"
            color="#8B5CF6"
            theme={theme}
          />
        </View>

        {/* FILTERS */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter}
              onPress={() =>
                setSelectedFilter(filter)
              }
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    selectedFilter === filter
                      ? COLORS.primary
                      : theme.card,
                },
              ]}
            >
              <Text
                style={{
                  color:
                    selectedFilter === filter
                      ? "#FFF"
                      : theme.text,
                  fontWeight: "700",
                }}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* PROJECTS */}

        {projects.map((project) => (
          <TouchableOpacity
            key={project.id}
            style={[
              styles.projectCard,
              {
                backgroundColor: theme.card,
              },
            ]}
          >
            <View style={styles.projectHeader}>
              <View
                style={[
                  styles.projectIcon,
                  {
                    backgroundColor:
                      project.color + "20",
                  },
                ]}
              >
                <Ionicons
                  name="folder"
                  size={22}
                  color={project.color}
                />
              </View>

              <TouchableOpacity>
                <Ionicons
                  name="ellipsis-horizontal"
                  size={20}
                  color={theme.secondary}
                />
              </TouchableOpacity>
            </View>

            <Text
              style={[
                styles.projectTitle,
                { color: theme.text },
              ]}
            >
              {project.name}
            </Text>

            <Text
              style={[
                styles.projectDescription,
                { color: theme.secondary },
              ]}
            >
              {project.description}
            </Text>

            <View style={styles.progressRow}>
              <Text
                style={{
                  color: theme.secondary,
                }}
              >
                Progress
              </Text>

              <Text
                style={{
                  color: theme.text,
                  fontWeight: "700",
                }}
              >
                {project.progress}%
              </Text>
            </View>

            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width:
                      `${project.progress}%`,
                    backgroundColor:
                      project.color,
                  },
                ]}
              />
            </View>

            <View style={styles.projectFooter}>
              <View style={styles.membersRow}>
                <View
                  style={styles.avatarMini}
                />
                <View
                  style={styles.avatarMini}
                />
                <View
                  style={styles.avatarMini}
                />

                <Text
                  style={{
                    marginLeft: 8,
                    color: theme.secondary,
                  }}
                >
                  +{project.members}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      project.color + "20",
                  },
                ]}
              >
                <Text
                  style={{
                    color: project.color,
                    fontWeight: "700",
                  }}
                >
                  {project.status}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}

      <TouchableOpacity style={styles.fab}>
        <Ionicons
          name="add"
          size={30}
          color="#FFF"
        />
      </TouchableOpacity>
    </View>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
  theme,
}: any) {
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: theme.card,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={24}
        color={color}
      />

      <Text
        style={[
          styles.statValue,
          { color: theme.text },
        ]}
      >
        {value}
      </Text>

      <Text
        style={{
          color: theme.secondary,
        }}
      >
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },

  header: {
    marginTop: 60,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  subtitle: {
    fontSize: 14,
  },

  title: {
    fontSize: 34,
    fontWeight: "900",
  },

  profileButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },

  profileText: {
    color: "#FFF",
    fontWeight: "900",
  },

  searchContainer: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 58,
    borderWidth: 1,
  },

  searchInput: {
    flex: 1,
    marginLeft: 10,
  },

  aiCard: {
    marginTop: 20,
    borderRadius: 24,
    padding: 24,
    flexDirection: "row",
    alignItems: "center",
  },

  aiLabel: {
    color: "#DBEAFE",
    fontWeight: "700",
  },

  aiTitle: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 5,
  },

  aiDescription: {
    color: "#DBEAFE",
    marginTop: 8,
  },

  statsContainer: {
    marginTop: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  statsTablet: {
    justifyContent: "space-evenly",
  },

  statCard: {
    width: "48%",
    padding: 20,
    borderRadius: 20,
    marginBottom: 12,
  },

  statValue: {
    fontSize: 28,
    fontWeight: "900",
    marginTop: 10,
  },

  filterScroll: {
    marginVertical: 20,
  },

  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },

  projectCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 15,
  },

  projectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  projectIcon: {
    width: 45,
    height: 45,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  projectTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 15,
  },

  projectDescription: {
    marginTop: 8,
  },

  progressRow: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  progressBar: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 20,
    marginTop: 8,
  },

  progressFill: {
    height: "100%",
    borderRadius: 20,
  },

  projectFooter: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  membersRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatarMini: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#DBEAFE",
    marginRight: -5,
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },

  fab: {
    position: "absolute",
    right: 25,
    bottom: 25,
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
  },
});