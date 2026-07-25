import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Calendar, Flag, Folder, Users } from "lucide-react-native";

import { Project } from "../lib/projects";
import {
  DUE_SOON_COLOR,
  formatShortDate,
  isDueSoon,
  isOverdue,
  labelColor,
  Task,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
} from "../lib/tasks";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

// Sin fecha va al final; con fecha, la más próxima primero. A igualdad de
// fecha, la de mayor prioridad primero — así lo urgente siempre flota arriba.
function sortTasks(tasks: Task[]) {
  const priorityRank: Record<string, number> = { urgent: 3, high: 2, medium: 1, low: 0 };
  return [...tasks].sort((a, b) => {
    const dueA = a.dueDate ?? "9999-12-31";
    const dueB = b.dueDate ?? "9999-12-31";
    if (dueA !== dueB) return dueA < dueB ? -1 : 1;
    return priorityRank[b.priority] - priorityRank[a.priority];
  });
}

type Props = {
  tasks: Task[];
  projects: Project[];
  showProject: boolean;
  isDark: boolean;
  onTaskPress: (task: Task) => void;
};

export default function TaskListView({ tasks, projects, showProject, isDark, onTaskPress }: Props) {
  const cardBg        = isDark ? "rgba(17, 24, 39, 0.58)" : "rgba(255, 255, 255, 0.6)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";

  const ultraShadow = {
    ...Platform.select({
      web: {
        boxShadow: isDark
          ? "0 30px 60px -25px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.08) inset"
          : "0 30px 60px -22px rgba(44,123,209,0.18), 0 1px 0 rgba(255,255,255,0.9) inset",
        backdropFilter: "blur(32px) saturate(200%)",
      } as any,
      default: {},
    }),
    borderTopColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.9)",
  };

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const sorted = sortTasks(tasks);

  if (sorted.length === 0) {
    return (
      <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
        <Text style={{ color: textSecondary, fontSize: 13 }}>No hay tareas que coincidan con los filtros.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {sorted.map((task) => {
        const project = projectById.get(task.projectId);
        const dueColor = isOverdue(task) ? "#EF4444" : isDueSoon(task) ? DUE_SOON_COLOR : textSecondary;
        return (
          <TouchableOpacity
            key={task.id}
            activeOpacity={0.85}
            onPress={() => onTaskPress(task)}
            style={[styles.row, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}
          >
            <View style={[styles.priorityBar, { backgroundColor: TASK_PRIORITY_COLORS[task.priority] }]} />

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.title, { color: textPrimary }]} numberOfLines={1}>
                {task.title}
              </Text>
              <View style={styles.metaRow}>
                {showProject && project && (
                  <View style={styles.metaItem}>
                    <Folder size={11} color={project.color} />
                    <Text style={{ color: textSecondary, fontSize: 11.5 }} numberOfLines={1}>
                      {project.name}
                    </Text>
                  </View>
                )}
                <View style={styles.metaItem}>
                  {task.assignee.type === "team" ? <Users size={11} color={textSecondary} /> : <Flag size={11} color={textSecondary} />}
                  <Text style={{ color: textSecondary, fontSize: 11.5 }} numberOfLines={1}>
                    {task.assignee.name}
                  </Text>
                </View>
                {!!task.labels.length && (
                  <View style={styles.metaItem}>
                    {task.labels.slice(0, 3).map((label) => (
                      <View key={label} style={[styles.labelChip, { backgroundColor: `${labelColor(label)}1F` }]}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: labelColor(label) }}>{label}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {task.dueDate && (
              <View style={[styles.metaChip, { backgroundColor: dueColor === textSecondary ? inputBg : dueColor + "20" }]}>
                <Calendar size={11} color={dueColor} />
                <Text style={{ color: dueColor, fontWeight: "700", fontSize: 11 }}>{formatShortDate(task.dueDate)}</Text>
              </View>
            )}

            <View style={[styles.statusBadge, { backgroundColor: TASK_STATUS_COLORS[task.status] + "20" }]}>
              <Text style={{ color: TASK_STATUS_COLORS[task.status], fontWeight: "700", fontSize: 11 }}>
                {TASK_STATUS_LABELS[task.status]}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 18, padding: 14, overflow: "hidden" },
  priorityBar: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  title: { fontSize: 14, fontWeight: "600" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  labelChip: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  emptyCard: { borderRadius: 24, borderWidth: 1, padding: 24, alignItems: "center" },
});
