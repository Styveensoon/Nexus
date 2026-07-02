import React, { useCallback, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { CalendarDays, ChevronLeft, ChevronRight, Flag, Folder, Users } from "lucide-react-native";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { listProjects, Project } from "../lib/projects";
import { listTasksForProjects, Task, TASK_PRIORITY_COLORS, TASK_PRIORITY_LABELS, TASK_PRIORITY_ORDER } from "../lib/tasks";

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTH_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayIso() {
  return toIso(new Date());
}

function formatLongDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

type CalendarEvent = { task: Task; kind: "start" | "due" };

export default function CalendarScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const { organization, loading: authLoading } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const bg            = isDark ? "#020617" : "#FAFAFA";
  const cardBg        = isDark ? "rgba(15, 23, 42, 0.8)" : "rgba(255, 255, 255, 0.9)";
  const border        = isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(226, 232, 240, 0.8)";
  const textPrimary   = isDark ? "#F8FAFC" : "#020617";
  const textSecondary = isDark ? "#94A3B8" : "#475569";
  const primaryColor  = organization?.color ?? "#2563EB";
  const inputBg       = isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC";

  const ultraShadow = Platform.select({
    web: {
      boxShadow: isDark
        ? "0 25px 50px -12px rgba(0,0,0,1), 0 0 0 1px rgba(255,255,255,0.05) inset"
        : "0 30px 60px -15px rgba(0,0,0,0.08), 0 10px 30px -5px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02) inset",
      backdropFilter: "blur(12px)",
    } as any,
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.4 : 0.06,
      shadowRadius: 16,
      elevation: 6,
    },
  });

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(todayIso());

  const loadData = useCallback(async () => {
    if (!organization) return;
    setLoadingData(true);
    setErrorText(null);

    const { data: projectRows, error: projectsError } = await listProjects(organization.id);
    if (projectsError) {
      setErrorText("No se pudieron cargar los proyectos.");
      setLoadingData(false);
      return;
    }
    setProjects(projectRows);

    const { data: taskRows, error: tasksError } = await listTasksForProjects(projectRows.map((p) => p.id));
    if (tasksError) setErrorText("No se pudieron cargar las tareas.");
    setTasks(taskRows);
    setLoadingData(false);
  }, [organization]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    const push = (date: string, event: CalendarEvent) => {
      const arr = map.get(date) ?? [];
      arr.push(event);
      map.set(date, arr);
    };
    tasks.forEach((task) => {
      if (task.startDate) push(task.startDate, { task, kind: "start" });
      if (task.dueDate) push(task.dueDate, { task, kind: "due" });
    });
    return map;
  }, [tasks]);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const dayColor = (events: CalendarEvent[]) => {
    const priorityRank = (p: Task["priority"]) => TASK_PRIORITY_ORDER.indexOf(p);
    const top = events.reduce((max, e) => (priorityRank(e.task.priority) > priorityRank(max.task.priority) ? e : max), events[0]);
    return TASK_PRIORITY_COLORS[top.task.priority];
  };

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const selectedEvents = eventsByDate.get(selectedDate) ?? [];
  const hasAnyDates = tasks.some((t) => t.startDate || t.dueDate);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: isMobile ? 16 : 32 }}>
        <View style={{ width: "100%", maxWidth: 960, alignSelf: "center" }}>
          <Text style={[styles.subtitle, { color: textSecondary }]}>{organization?.name ?? "Workspace"}</Text>
          <Text style={[styles.title, { color: textPrimary }]}>Calendario</Text>

          {!organization ? (
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border, marginTop: 24 }, ultraShadow]}>
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>Tu cuenta no tiene un workspace todavía</Text>
            </View>
          ) : authLoading || loadingData ? (
            <Text style={{ color: textSecondary, marginTop: 24 }}>Cargando…</Text>
          ) : (
            <>
              {errorText && <Text style={[styles.errorText, { color: "#EF4444" }]}>{errorText}</Text>}

              {projects.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border, marginTop: 20 }, ultraShadow]}>
                  <Folder size={32} color={textSecondary} />
                  <Text style={[styles.emptyTitle, { color: textPrimary }]}>Todavía no hay proyectos</Text>
                  <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
                    El calendario muestra las tareas con fecha de inicio o límite. Crea un proyecto primero.
                  </Text>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate("Projects")}>
                    <Text style={[styles.emptyLink, { color: primaryColor }]}>Ir a Proyectos</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.layout, isMobile && styles.layoutMobile]}>
                  <View style={[styles.card, { backgroundColor: cardBg, borderColor: border, flex: isMobile ? undefined : 1.3 }, ultraShadow]}>
                    <View style={styles.monthHeader}>
                      <TouchableOpacity hitSlop={8} onPress={() => setViewMonth(new Date(year, month - 1, 1))}>
                        <ChevronLeft size={18} color={textSecondary} />
                      </TouchableOpacity>
                      <Text style={[styles.monthLabel, { color: textPrimary }]}>
                        {MONTH_LABELS[month]} {year}
                      </Text>
                      <TouchableOpacity hitSlop={8} onPress={() => setViewMonth(new Date(year, month + 1, 1))}>
                        <ChevronRight size={18} color={textSecondary} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.weekRow}>
                      {WEEKDAY_LABELS.map((w, i) => (
                        <Text key={i} style={[styles.weekLabel, { color: textSecondary }]}>{w}</Text>
                      ))}
                    </View>

                    <View style={styles.grid}>
                      {cells.map((cell, idx) => {
                        if (!cell) return <View key={idx} style={styles.dayCell} />;
                        const iso = toIso(cell);
                        const events = eventsByDate.get(iso) ?? [];
                        const isToday = iso === todayIso();
                        const isSelected = iso === selectedDate;
                        return (
                          <View key={idx} style={styles.dayCell}>
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => setSelectedDate(iso)}
                              style={[
                                styles.dayTouchable,
                                isSelected && { backgroundColor: primaryColor },
                                !isSelected && isToday && { borderWidth: 1.5, borderColor: primaryColor },
                              ]}
                            >
                              <Text style={{ color: isSelected ? "#FFF" : textPrimary, fontWeight: isSelected ? "800" : "600", fontSize: 13 }}>
                                {cell.getDate()}
                              </Text>
                              {events.length > 0 && (
                                <View style={[styles.dayDot, { backgroundColor: isSelected ? "#FFF" : dayColor(events) }]} />
                              )}
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>

                    <View style={styles.legendRow}>
                      {TASK_PRIORITY_ORDER.map((p) => (
                        <View key={p} style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: TASK_PRIORITY_COLORS[p] }]} />
                          <Text style={{ color: textSecondary, fontSize: 11 }}>{TASK_PRIORITY_LABELS[p]}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={[styles.card, { backgroundColor: cardBg, borderColor: border, flex: 1, marginTop: isMobile ? 16 : 0 }, ultraShadow]}>
                    <View style={styles.agendaHeader}>
                      <CalendarDays size={16} color={primaryColor} />
                      <Text style={[styles.agendaTitle, { color: textPrimary }]} numberOfLines={1}>
                        {formatLongDate(selectedDate)}
                      </Text>
                    </View>

                    {selectedEvents.length === 0 ? (
                      <Text style={{ color: textSecondary, fontSize: 13, marginTop: 8 }}>
                        {hasAnyDates ? "No hay tareas ese día." : "Todavía ninguna task tiene fecha de inicio o límite."}
                      </Text>
                    ) : (
                      <View style={{ gap: 10, marginTop: 12 }}>
                        {selectedEvents.map((event, idx) => {
                          const project = projectById.get(event.task.projectId);
                          return (
                            <TouchableOpacity
                              key={`${event.task.id}-${event.kind}-${idx}`}
                              activeOpacity={0.85}
                              onPress={() => navigation.navigate("Tasks", { projectId: event.task.projectId, taskId: event.task.id })}
                              style={[styles.eventCard, { backgroundColor: inputBg, borderLeftColor: TASK_PRIORITY_COLORS[event.task.priority] }]}
                            >
                              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                <Text style={[styles.eventTitle, { color: textPrimary }]} numberOfLines={1}>
                                  {event.task.title}
                                </Text>
                                <View style={[styles.kindChip, { backgroundColor: TASK_PRIORITY_COLORS[event.task.priority] + "20" }]}>
                                  <Text style={{ color: TASK_PRIORITY_COLORS[event.task.priority], fontWeight: "700", fontSize: 10.5 }}>
                                    {event.kind === "start" ? "Inicia" : "Vence"}
                                  </Text>
                                </View>
                              </View>

                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                                {project && <Folder size={11} color={project.color} />}
                                <Text style={{ color: textSecondary, fontSize: 11.5 }} numberOfLines={1}>
                                  {project?.name ?? "Proyecto"}
                                </Text>
                                <Text style={{ color: textSecondary, fontSize: 11.5 }}>·</Text>
                                {event.task.assignee.type === "team" ? <Users size={11} color={textSecondary} /> : <Flag size={11} color={textSecondary} />}
                                <Text style={{ color: textSecondary, fontSize: 11.5 }} numberOfLines={1}>
                                  {event.task.assignee.name}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </View>
              )}
            </>
          )}

          <View style={{ height: 60 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  subtitle: { fontSize: 13, fontWeight: "700" },
  title: { fontSize: 30, fontWeight: "900", letterSpacing: -0.5, marginTop: 2 },

  errorText: { marginTop: 16, fontSize: 13, fontWeight: "600" },

  emptyCard: { borderRadius: 20, borderWidth: 1, padding: 32, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  emptySubtitle: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  emptyLink: { fontSize: 13, fontWeight: "700", textAlign: "center", marginTop: 6 },

  layout: { flexDirection: "row", gap: 20, marginTop: 24, alignItems: "flex-start" },
  layoutMobile: { flexDirection: "column" },
  card: { borderRadius: 22, borderWidth: 1, padding: 20 },

  monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  monthLabel: { fontSize: 16, fontWeight: "800", textTransform: "capitalize" },

  weekRow: { flexDirection: "row", marginBottom: 6 },
  weekLabel: { width: `${100 / 7}%`, textAlign: "center", fontSize: 11, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayTouchable: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  dayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },

  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 18 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },

  agendaHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  agendaTitle: { fontSize: 15, fontWeight: "800", textTransform: "capitalize", flex: 1 },

  eventCard: { borderRadius: 14, borderLeftWidth: 3, padding: 12 },
  eventTitle: { fontSize: 13.5, fontWeight: "700", flex: 1, marginRight: 8 },
  kindChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
});
