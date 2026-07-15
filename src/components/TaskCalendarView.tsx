import React, { useMemo, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { CalendarDays, ChevronLeft, ChevronRight, Flag, Folder, Users } from "lucide-react-native";

import { Project } from "../lib/projects";
import { Task, TASK_PRIORITY_COLORS, TASK_PRIORITY_LABELS, TASK_PRIORITY_ORDER } from "../lib/tasks";

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

type Props = {
  tasks: Task[];
  projects: Project[];
  isDark: boolean;
  primaryColor: string;
  onTaskPress: (task: Task) => void;
};

export default function TaskCalendarView({ tasks, projects, isDark, primaryColor, onTaskPress }: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

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

  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(todayIso());

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
    <View style={[styles.layout, isMobile && styles.layoutMobile]}>
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: border, flex: isMobile ? undefined : 1.3 }, ultraShadow]}>
        <View style={styles.monthHeader}>
          <TouchableOpacity hitSlop={8} onPress={() => setViewMonth(new Date(year, month - 1, 1))}>
            <ChevronLeft size={18} color={textSecondary} strokeWidth={2.2} />
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: textPrimary }]}>
            {MONTH_LABELS[month]} {year}
          </Text>
          <TouchableOpacity hitSlop={8} onPress={() => setViewMonth(new Date(year, month + 1, 1))}>
            <ChevronRight size={18} color={textSecondary} strokeWidth={2.2} />
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
                  <Text style={{ color: isSelected ? "#FFF" : textPrimary, fontWeight: isSelected ? "700" : "600", fontSize: 13 }}>
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
          <CalendarDays size={16} color={primaryColor} strokeWidth={2.2} />
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
                  onPress={() => onTaskPress(event.task)}
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
  );
}

const styles = StyleSheet.create({
  layout: { flexDirection: "row", gap: 20, alignItems: "flex-start" },
  layoutMobile: { flexDirection: "column" },
  card: { borderRadius: 24, borderWidth: 1, padding: 20 },

  monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  monthLabel: { fontSize: 16, fontWeight: "700", textTransform: "capitalize" },

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
  agendaTitle: { fontSize: 15, fontWeight: "700", textTransform: "capitalize", flex: 1 },

  eventCard: { borderRadius: 16, borderLeftWidth: 3, padding: 12 },
  eventTitle: { fontSize: 13.5, fontWeight: "700", flex: 1, marginRight: 8 },
  kindChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
});
