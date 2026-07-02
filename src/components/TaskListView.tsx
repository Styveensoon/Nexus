import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Calendar, Flag, Folder, Users } from "lucide-react-native";

import { Project } from "../lib/projects";
import {
  DUE_SOON_COLOR,
  formatShortDate,
  isDueSoon,
  isOverdue,
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
  const cardBg        = isDark ? "rgba(15, 23, 42, 0.8)" : "rgba(255, 255, 255, 0.9)";
  const border        = isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(226, 232, 240, 0.8)";
  const textPrimary   = isDark ? "#F8FAFC" : "#020617";
  const textSecondary = isDark ? "#94A3B8" : "#475569";
  const inputBg       = isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC";

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const sorted = sortTasks(tasks);

  if (sorted.length === 0) {
    return (
      <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border }]}>
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
            style={[styles.row, { backgroundColor: cardBg, borderColor: border }]}
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
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, overflow: "hidden" },
  priorityBar: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  title: { fontSize: 14, fontWeight: "700" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  emptyCard: { borderRadius: 20, borderWidth: 1, padding: 24, alignItems: "center" },
});
