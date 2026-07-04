import React, { useEffect, useState } from "react";
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Folder, X } from "lucide-react-native";
import { OrganizationMemberProfile } from "../lib/organizations";
import { Project } from "../lib/projects";
import { Task, TASK_STATUS_COLORS, TASK_STATUS_LABELS, listTasksForUser } from "../lib/tasks";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

// Estados terminales/de historial: "completadas, bloqueadas, etc." tal como
// lo pidió el profesor (Punto 3 del feedback) — el resto de los estados
// cuentan como "en curso" para esa persona.
const HISTORY_STATUSES = new Set<Task["status"]>(["completed", "cancelled", "blocked"]);

type Props = {
  visible: boolean;
  isDark: boolean;
  primaryColor: string;
  organizationId: string;
  member: OrganizationMemberProfile | null;
  projects: Project[];
  onClose: () => void;
};

// Se abre desde el buscador de usuarios de TasksScreen (Punto 3 del
// feedback) — muestra las tareas actuales de esa persona (con status) y su
// histórico (completadas/bloqueadas/canceladas). Self-contained: hace su
// propio fetch con listTasksForUser en vez de depender de que el padre ya
// tenga cargadas TODAS las tasks de la organización.
export default function UserTasksModal({ visible, isDark, primaryColor, organizationId, member, projects, onClose }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !member) return;
    setLoading(true);
    setTasks([]);
    listTasksForUser(organizationId, member.userId).then(({ data }) => {
      setTasks(data);
      setLoading(false);
    });
  }, [visible, member?.userId, organizationId]);

  const cardBg        = isDark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.92)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";

  if (!member) return null;

  const currentTasks = tasks.filter((t) => !HISTORY_STATUSES.has(t.status));
  const historyTasks = tasks.filter((t) => HISTORY_STATUSES.has(t.status));

  function TaskRow({ task }: { task: Task }) {
    const project = projects.find((p) => p.id === task.projectId);
    return (
      <View style={[styles.taskRow, { backgroundColor: inputBg, borderColor: border }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: textPrimary, fontSize: 13, fontWeight: "700" }} numberOfLines={1}>
            {task.title}
          </Text>
          {project && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
              <Folder size={11} color={textSecondary} strokeWidth={2.2} />
              <Text style={{ color: textSecondary, fontSize: 11 }} numberOfLines={1}>
                {project.name}
              </Text>
            </View>
          )}
        </View>
        <View style={[styles.statusPill, { backgroundColor: TASK_STATUS_COLORS[task.status] + "20" }]}>
          <Text style={{ color: TASK_STATUS_COLORS[task.status], fontWeight: "700", fontSize: 10.5 }} numberOfLines={1}>
            {TASK_STATUS_LABELS[task.status]}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.header}>
            <View style={[styles.avatar, { backgroundColor: member.avatarColor }]}>
              <Text style={styles.avatarText}>{initials(member.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: textPrimary }]} numberOfLines={1}>
                {member.name}
              </Text>
              {(member.customRole || member.role) && (
                <Text style={{ color: textSecondary, fontSize: 12 }} numberOfLines={1}>
                  {member.customRole || member.role}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={18} color={textSecondary} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {loading ? (
              <Text style={{ color: textSecondary, fontSize: 13, paddingVertical: 12 }}>Cargando tareas…</Text>
            ) : (
              <>
                <Text style={[styles.sectionLabel, { color: textSecondary }]}>
                  Tareas actuales {currentTasks.length > 0 ? `(${currentTasks.length})` : ""}
                </Text>
                {currentTasks.length === 0 ? (
                  <Text style={{ color: textSecondary, fontSize: 12.5, marginBottom: 16 }}>No tiene tareas activas ahora mismo.</Text>
                ) : (
                  <View style={{ gap: 8, marginBottom: 16 }}>
                    {currentTasks.map((t) => (
                      <TaskRow key={t.id} task={t} />
                    ))}
                  </View>
                )}

                <Text style={[styles.sectionLabel, { color: textSecondary }]}>
                  Histórico {historyTasks.length > 0 ? `(${historyTasks.length})` : ""}
                </Text>
                {historyTasks.length === 0 ? (
                  <Text style={{ color: textSecondary, fontSize: 12.5 }}>Todavía no tiene tareas completadas, bloqueadas o canceladas.</Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    {historyTasks.map((t) => (
                      <TaskRow key={t.id} task={t} />
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(2, 6, 23, 0.5)", alignItems: "center", justifyContent: "center", padding: 20,
    ...Platform.select({ web: { backdropFilter: "blur(4px)" } as any, default: {} }),
  },
  card: { width: "100%", maxWidth: 440, borderRadius: 24, borderWidth: 1, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  avatar: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFF", fontSize: 13, fontWeight: "700" },
  title: { fontSize: 15, fontWeight: "700" },
  sectionLabel: { fontSize: 11.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  taskRow: {
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  statusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
});
