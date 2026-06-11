import React from "react";
import { useTheme } from "../context/ThemeContext";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function TeamScreen() {
  const { isDark } = useTheme();

  const members = [
    {
      name: "Alexandra Deff",
      role: "UI/UX Designer",
      status: "Online",
      initials: "AD",
    },
    {
      name: "Edwin Adenike",
      role: "Frontend Developer",
      status: "Online",
      initials: "EA",
    },
    {
      name: "Isaac Oluwa",
      role: "Backend Developer",
      status: "Away",
      initials: "IO",
    },
    {
      name: "David Oshodi",
      role: "Project Manager",
      status: "Offline",
      initials: "DO",
    },
  ];

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
          Team
        </Text>

        <TouchableOpacity style={styles.addButton}>
          <Text style={styles.addButtonText}>
            + Add Member
          </Text>
        </TouchableOpacity>
      </View>

      <Text
        style={[
          styles.subtitle,
          isDark && { color: "#CBD5E1" },
        ]}
      >
        Gestiona colaboradores y permisos del proyecto.
      </Text>

      {members.map((member, index) => (
        <View
          key={index}
          style={[
            styles.memberCard,
            isDark && { backgroundColor: "#1E293B" },
          ]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {member.initials}
            </Text>
          </View>

          <View style={styles.memberInfo}>
            <Text
              style={[
                styles.memberName,
                isDark && { color: "#F8FAFC" },
              ]}
            >
              {member.name}
            </Text>

            <Text
              style={[
                styles.memberRole,
                isDark && { color: "#94A3B8" },
              ]}
            >
              {member.role}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              member.status === "Online"
                ? styles.online
                : member.status === "Away"
                ? styles.away
                : styles.offline,
            ]}
          >
            <Text style={styles.statusText}>
              {member.status}
            </Text>
          </View>
        </View>
      ))}

      <View
        style={[
          styles.statsCard,
          isDark && { backgroundColor: "#1E293B" },
        ]}
      >
        <Text
          style={[
            styles.statsTitle,
            isDark && { color: "#F8FAFC" },
          ]}
        >
          Team Statistics
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>12</Text>
            <Text
              style={[
                styles.statLabel,
                isDark && { color: "#94A3B8" },
              ]}
            >
              Members
            </Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statNumber}>8</Text>
            <Text
              style={[
                styles.statLabel,
                isDark && { color: "#94A3B8" },
              ]}
            >
              Active
            </Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statNumber}>4</Text>
            <Text
              style={[
                styles.statLabel,
                isDark && { color: "#94A3B8" },
              ]}
            >
              Projects
            </Text>
          </View>
        </View>
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

  subtitle: {
    color: "#6B7280",
    marginTop: 8,
    marginBottom: 25,
  },

  addButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },

  addButtonText: {
    color: "#FFF",
    fontWeight: "700",
  },

  memberCard: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 16,
  },

  memberInfo: {
    flex: 1,
    marginLeft: 15,
  },

  memberName: {
    fontWeight: "800",
    fontSize: 16,
    color: "#111827",
  },

  memberRole: {
    color: "#6B7280",
    marginTop: 4,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },

  online: {
    backgroundColor: "#DCFCE7",
  },

  away: {
    backgroundColor: "#FEF3C7",
  },

  offline: {
    backgroundColor: "#E5E7EB",
  },

  statusText: {
    fontWeight: "700",
    fontSize: 12,
  },

  statsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginTop: 20,
    marginBottom: 40,
  },

  statsTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 20,
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  statBox: {
    alignItems: "center",
  },

  statNumber: {
    fontSize: 28,
    fontWeight: "900",
    color: "#2563EB",
  },

  statLabel: {
    color: "#6B7280",
    marginTop: 4,
  },
});