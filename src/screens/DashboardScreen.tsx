import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  useWindowDimensions,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import {
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";

import { useTheme } from "../context/ThemeContext";
import { COLORS } from "../styles/colors";

export default function DashboardScreen() {
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();

  const isTablet = width >= 768;

  const theme = {
    background: isDark ? "#0F172A" : COLORS.background,
    surface: isDark ? "#1E293B" : COLORS.surface,
    text: isDark ? "#F8FAFC" : COLORS.text,
    secondary: isDark ? "#CBD5E1" : COLORS.textSecondary,
    border: isDark ? "#334155" : COLORS.border,
  };

  const stats = [
    {
      title: "Projects",
      value: "12",
      icon: "folder",
      color: COLORS.primary,
    },
    {
      title: "Tasks",
      value: "184",
      icon: "checkmark-circle",
      color: COLORS.success,
    },
    {
      title: "Team",
      value: "7",
      icon: "people",
      color: COLORS.warning,
    },
    {
      title: "Issues",
      value: "23",
      icon: "bug",
      color: COLORS.error,
    },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
        },
      ]}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* HEADER */}

        <View style={styles.header}>
          <View>
            <Text
              style={[
                styles.greeting,
                {
                  color: theme.secondary,
                },
              ]}
            >
              Bienvenido 👋
            </Text>

            <Text
              style={[
                styles.title,
                {
                  color: theme.text,
                },
              ]}
            >
              Nexus Dashboard
            </Text>
          </View>

          <TouchableOpacity style={styles.avatar}>
            <Text style={styles.avatarText}>SL</Text>
          </TouchableOpacity>
        </View>

        {/* SEARCH */}

        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: theme.surface,
            },
          ]}
        >
          <Ionicons
            name="search"
            size={20}
            color={theme.secondary}
          />

          <TextInput
            placeholder="Buscar proyectos..."
            placeholderTextColor={theme.secondary}
            style={[
              styles.searchInput,
              {
                color: theme.text,
              },
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
          <View>
            <Text style={styles.aiSmall}>
              NEXUS AI
            </Text>

            <Text style={styles.aiTitle}>
              Productividad +18%
            </Text>

            <Text style={styles.aiDescription}>
              Tus proyectos están avanzando más rápido esta semana.
            </Text>
          </View>

          <MaterialCommunityIcons
            name="robot-excited"
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
          {stats.map((item, index) => (
            <View
              key={index}
              style={[
                styles.statCard,
                {
                  backgroundColor: theme.surface,
                },
              ]}
            >
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor:
                      item.color + "20",
                  },
                ]}
              >
                <Ionicons
                  name={
                    item.icon as any
                  }
                  size={22}
                  color={item.color}
                />
              </View>

              <Text
                style={[
                  styles.statNumber,
                  {
                    color: theme.text,
                  },
                ]}
              >
                {item.value}
              </Text>

              <Text
                style={[
                  styles.statLabel,
                  {
                    color: theme.secondary,
                  },
                ]}
              >
                {item.title}
              </Text>
            </View>
          ))}
        </View>

        {/* PRIORITY PROJECTS */}

        <Text
          style={[
            styles.sectionTitle,
            {
              color: theme.text,
            },
          ]}
        >
          Proyectos Prioritarios
        </Text>

        {[
          {
            name: "Nexus Mobile App",
            progress: 82,
          },
          {
            name: "Dashboard Admin",
            progress: 64,
          },
          {
            name: "API Backend",
            progress: 95,
          },
        ].map((project, index) => (
          <View
            key={index}
            style={[
              styles.projectCard,
              {
                backgroundColor: theme.surface,
              },
            ]}
          >
            <View style={styles.projectHeader}>
              <Text
                style={[
                  styles.projectName,
                  {
                    color: theme.text,
                  },
                ]}
              >
                {project.name}
              </Text>

              <Text
                style={{
                  color: COLORS.primary,
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
                    width: `${project.progress}%`,
                  },
                ]}
              />
            </View>
          </View>
        ))}

        {/* ACTIVITY */}

        <Text
          style={[
            styles.sectionTitle,
            {
              color: theme.text,
            },
          ]}
        >
          Actividad Reciente
        </Text>

        {[
          "Andrea completó Login",
          "Nueva tarea creada",
          "Sprint actualizado",
        ].map((item, index) => (
          <View
            key={index}
            style={[
              styles.activityCard,
              {
                backgroundColor: theme.surface,
              },
            ]}
          >
            <Ionicons
              name="flash"
              size={18}
              color={COLORS.primary}
            />

            <Text
              style={{
                color: theme.text,
                marginLeft: 10,
                flex: 1,
              }}
            >
              {item}
            </Text>
          </View>
        ))}

        {/* EVENTS */}

        <Text
          style={[
            styles.sectionTitle,
            {
              color: theme.text,
            },
          ]}
        >
          Próximos Eventos
        </Text>

        <View
          style={[
            styles.eventCard,
            {
              backgroundColor: theme.surface,
            },
          ]}
        >
          <Text
            style={{
              color: theme.text,
              fontWeight: "700",
            }}
          >
            Sprint Planning
          </Text>

          <Text
            style={{
              color: theme.secondary,
              marginTop: 5,
            }}
          >
            Hoy • 10:00 AM
          </Text>
        </View>

        <View
          style={{
            height: 100,
          }}
        />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },

  header: {
    marginTop: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  greeting: {
    fontSize: 14,
  },

  title: {
    fontSize: 30,
    fontWeight: "900",
  },

  avatar: {
    width: 55,
    height: 55,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    color: "#FFF",
    fontWeight: "900",
  },

  searchContainer: {
    marginTop: 25,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    paddingHorizontal: 15,
    height: 58,
  },

  searchInput: {
    flex: 1,
    marginLeft: 10,
  },

  aiCard: {
    marginTop: 25,
    borderRadius: 28,
    padding: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  aiSmall: {
    color: "#DBEAFE",
    fontWeight: "700",
  },

  aiTitle: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 5,
  },

  aiDescription: {
    color: "#DBEAFE",
    marginTop: 10,
    maxWidth: 220,
  },

  statsContainer: {
    marginTop: 25,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  statsTablet: {
    justifyContent: "space-evenly",
  },

  statCard: {
    width: "48%",
    borderRadius: 24,
    padding: 20,
    marginBottom: 15,
  },

  iconContainer: {
    width: 45,
    height: 45,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  statNumber: {
    fontSize: 28,
    fontWeight: "900",
    marginTop: 12,
  },

  statLabel: {
    marginTop: 5,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: 25,
    marginBottom: 15,
  },

  projectCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
  },

  projectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  projectName: {
    fontWeight: "700",
  },

  progressBar: {
    marginTop: 15,
    height: 10,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
  },

  progressFill: {
    height: "100%",
    borderRadius: 20,
    backgroundColor: COLORS.primary,
  },

  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 18,
    marginBottom: 12,
  },

  eventCard: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 30,
  },

  fab: {
    position: "absolute",
    right: 25,
    bottom: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
  },
});