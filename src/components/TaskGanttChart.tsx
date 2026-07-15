import React, { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, PanResponderInstance, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Flag, Folder, Users } from "lucide-react-native";

import { Project } from "../lib/projects";
import { Task, TASK_PRIORITY_COLORS } from "../lib/tasks";

const DAY_WIDTH = 36;
const ROW_HEIGHT = 52;
const BAR_HEIGHT = 28;
const LABEL_WIDTH = 220;
const MONTH_LABELS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const WEEKDAY_INITIALS = ["D", "L", "M", "M", "J", "V", "S"];

function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseIso(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

function addDaysToIso(iso: string, delta: number) {
  const d = parseIso(iso);
  d.setDate(d.getDate() + delta);
  return toIso(d);
}

function daysBetweenIso(fromIso: string, toIsoStr: string) {
  const MS = 86400000;
  return Math.round((parseIso(toIsoStr).getTime() - parseIso(fromIso).getTime()) / MS);
}

type Props = {
  tasks: Task[];
  projects: Project[];
  showProject: boolean;
  isDark: boolean;
  primaryColor: string;
  canEditTask: (task: Task) => boolean;
  onTaskPress: (task: Task) => void;
  onDatesChange: (taskId: string, startDate: string, dueDate: string) => void;
};

export default function TaskGanttChart({ tasks, projects, showProject, isDark, primaryColor, canEditTask, onTaskPress, onDatesChange }: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const cardBg        = isDark ? "rgba(17, 24, 39, 0.58)" : "rgba(255, 255, 255, 0.6)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const rowAltBg      = isDark ? "rgba(255,255,255,0.02)" : "rgba(2, 6, 23, 0.015)";
  const weekendBg     = isDark ? "rgba(255,255,255,0.025)" : "rgba(2, 6, 23, 0.025)";

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
  const withDates = tasks.filter((t) => t.startDate || t.dueDate);

  const rows = useMemo(
    () =>
      [...withDates].sort((a, b) => {
        const startA = a.startDate ?? a.dueDate!;
        const startB = b.startDate ?? b.dueDate!;
        return startA < startB ? -1 : startA > startB ? 1 : 0;
      }),
    [withDates]
  );

  const todayIso = toIso(new Date());

  // Rango visible: si no hay tasks con fecha, una ventana fija alrededor de
  // hoy; si las hay, desde la más temprana hasta la más tardía con margen,
  // topado a 180 días para no renderizar una grilla descomunal si alguien
  // pone una fecha límite años en el futuro.
  const { rangeStartIso, totalDays } = useMemo(() => {
    if (rows.length === 0) {
      return { rangeStartIso: addDaysToIso(todayIso, -7), totalDays: 38 };
    }
    let minIso = rows[0].startDate ?? rows[0].dueDate!;
    let maxIso = rows[0].dueDate ?? rows[0].startDate!;
    rows.forEach((t) => {
      const s = t.startDate ?? t.dueDate!;
      const e = t.dueDate ?? t.startDate!;
      if (s < minIso) minIso = s;
      if (e > maxIso) maxIso = e;
    });
    if (todayIso < minIso) minIso = todayIso;
    if (todayIso > maxIso) maxIso = todayIso;
    const start = addDaysToIso(minIso, -5);
    const end = addDaysToIso(maxIso, 10);
    const span = Math.min(daysBetweenIso(start, end) + 1, 180);
    return { rangeStartIso: start, totalDays: span };
  }, [rows, todayIso]);

  const todayIndex = daysBetweenIso(rangeStartIso, todayIso);

  const dayColumns = useMemo(() => {
    const cols: { iso: string; date: Date; isWeekend: boolean }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const iso = addDaysToIso(rangeStartIso, i);
      const date = parseIso(iso);
      cols.push({ iso, date, isWeekend: date.getDay() === 0 || date.getDay() === 6 });
    }
    return cols;
  }, [rangeStartIso, totalDays]);

  const monthGroups = useMemo(() => {
    const groups: { label: string; startIndex: number; days: number }[] = [];
    dayColumns.forEach((col, idx) => {
      const label = `${MONTH_LABELS_SHORT[col.date.getMonth()]} ${col.date.getFullYear()}`;
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.days += 1;
      else groups.push({ label, startIndex: idx, days: 1 });
    });
    return groups;
  }, [dayColumns]);

  const gridRef = useRef<ScrollView>(null);

  useEffect(() => {
    const x = Math.max(0, todayIndex * DAY_WIDTH - 120);
    const timeout = setTimeout(() => gridRef.current?.scrollTo({ x, animated: false }), 0);
    return () => clearTimeout(timeout);
    // Solo al montar / cuando cambia el rango — no cada vez que se arrastra una barra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStartIso]);

  const gridWidth = totalDays * DAY_WIDTH;
  const gridHeight = rows.length * ROW_HEIGHT;

  if (rows.length === 0) {
    return (
      <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
        <Text style={{ color: textSecondary, fontSize: 13 }}>Ninguna task visible tiene fecha de inicio o límite todavía.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: LABEL_WIDTH }}>
          <View style={[styles.labelHeaderCell, { borderColor: border }]}>
            <Text style={{ color: textSecondary, fontSize: 11, fontWeight: "700" }}>Tarea</Text>
          </View>
          {rows.map((task, idx) => {
            const project = projectById.get(task.projectId);
            return (
              <View
                key={task.id}
                style={[styles.labelCell, { borderColor: border, backgroundColor: idx % 2 === 1 ? rowAltBg : "transparent" }]}
              >
                <Text style={{ color: textPrimary, fontSize: 12.5, fontWeight: "700" }} numberOfLines={1}>
                  {task.title}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                  {showProject && project && (
                    <>
                      <Folder size={10} color={project.color} />
                      <Text style={{ color: textSecondary, fontSize: 10.5 }} numberOfLines={1}>
                        {project.name}
                      </Text>
                    </>
                  )}
                  {task.assignee.type === "team" ? <Users size={10} color={textSecondary} /> : <Flag size={10} color={textSecondary} />}
                  <Text style={{ color: textSecondary, fontSize: 10.5, flexShrink: 1 }} numberOfLines={1}>
                    {task.assignee.name}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <ScrollView ref={gridRef} horizontal showsHorizontalScrollIndicator={isMobile}>
          <View style={{ width: gridWidth }}>
            <View style={[styles.monthRow, { borderColor: border }]}>
              {monthGroups.map((g, idx) => (
                <View key={idx} style={{ width: g.days * DAY_WIDTH, borderRightWidth: idx < monthGroups.length - 1 ? 1 : 0, borderColor: border }}>
                  <Text style={{ color: textSecondary, fontSize: 10.5, fontWeight: "700", textTransform: "capitalize", paddingLeft: 6 }}>
                    {g.label}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.dayRow, { borderColor: border }]}>
              {dayColumns.map((col) => (
                <View key={col.iso} style={[styles.dayCell, { backgroundColor: col.isWeekend ? weekendBg : "transparent" }]}>
                  <Text style={{ color: textSecondary, fontSize: 9.5 }}>{WEEKDAY_INITIALS[col.date.getDay()]}</Text>
                  <Text style={{ color: col.iso === todayIso ? primaryColor : textPrimary, fontWeight: col.iso === todayIso ? "700" : "600", fontSize: 11 }}>
                    {col.date.getDate()}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ height: gridHeight, position: "relative" }}>
              {dayColumns.map(
                (col, idx) =>
                  col.isWeekend && (
                    <View
                      key={col.iso}
                      pointerEvents="none"
                      style={{ position: "absolute", left: idx * DAY_WIDTH, top: 0, bottom: 0, width: DAY_WIDTH, backgroundColor: weekendBg }}
                    />
                  )
              )}
              <View
                pointerEvents="none"
                style={{ position: "absolute", left: todayIndex * DAY_WIDTH + DAY_WIDTH / 2 - 1, top: 0, bottom: 0, width: 2, backgroundColor: primaryColor }}
              />

              {rows.map((task, idx) => (
                <View key={task.id} style={{ position: "absolute", top: idx * ROW_HEIGHT, left: 0, right: 0, height: ROW_HEIGHT, backgroundColor: idx % 2 === 1 ? rowAltBg : "transparent" }}>
                  <GanttBar
                    task={task}
                    dayWidth={DAY_WIDTH}
                    rangeStartIso={rangeStartIso}
                    isMobile={isMobile}
                    canEdit={canEditTask(task)}
                    onPress={() => onTaskPress(task)}
                    onCommit={(startIso, dueIso) => onDatesChange(task.id, startIso, dueIso)}
                  />
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

type GanttBarProps = {
  task: Task;
  dayWidth: number;
  rangeStartIso: string;
  isMobile: boolean;
  canEdit: boolean;
  onPress: () => void;
  onCommit: (startIso: string, dueIso: string) => void;
};

type DragMode = "move" | "start" | "end";

function createDragResponder(
  mode: DragMode,
  latest: React.MutableRefObject<{ effectiveStart: string; effectiveEnd: string; dayWidth: number; canEdit: boolean; onPress: () => void; onCommit: (s: string, e: string) => void }>,
  setDrag: (d: { mode: DragMode; deltaPx: number } | null) => void
): PanResponderInstance {
  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => setDrag({ mode, deltaPx: 0 }),
    onPanResponderMove: (_, g) => setDrag({ mode, deltaPx: g.dx }),
    onPanResponderRelease: (_, g) => {
      setDrag(null);
      const { effectiveStart, effectiveEnd, dayWidth, canEdit, onPress, onCommit } = latest.current;
      const isTap = Math.abs(g.dx) < 4 && Math.abs(g.dy) < 4;
      if (mode === "move" && isTap) {
        onPress();
        return;
      }
      if (!canEdit) return;
      const dayDelta = Math.round(g.dx / dayWidth);
      if (dayDelta === 0) return;
      if (mode === "move") {
        onCommit(addDaysToIso(effectiveStart, dayDelta), addDaysToIso(effectiveEnd, dayDelta));
      } else if (mode === "start") {
        const newStart = addDaysToIso(effectiveStart, dayDelta);
        onCommit(newStart > effectiveEnd ? effectiveEnd : newStart, effectiveEnd);
      } else {
        const newEnd = addDaysToIso(effectiveEnd, dayDelta);
        onCommit(effectiveStart, newEnd < effectiveStart ? effectiveStart : newEnd);
      }
    },
    onPanResponderTerminate: () => setDrag(null),
  });
}

function GanttBar({ task, dayWidth, rangeStartIso, isMobile, canEdit, onPress, onCommit }: GanttBarProps) {
  const effectiveStart = task.startDate ?? task.dueDate!;
  const effectiveEnd = task.dueDate ?? task.startDate!;
  const startIdx = daysBetweenIso(rangeStartIso, effectiveStart);
  const endIdx = daysBetweenIso(rangeStartIso, effectiveEnd);
  const baseLeft = startIdx * dayWidth;
  const baseWidth = Math.max(dayWidth - 4, (endIdx - startIdx + 1) * dayWidth - 4);

  const [drag, setDrag] = useState<{ mode: DragMode; deltaPx: number } | null>(null);

  const latest = useRef({ effectiveStart, effectiveEnd, dayWidth, canEdit, onPress, onCommit });
  latest.current = { effectiveStart, effectiveEnd, dayWidth, canEdit, onPress, onCommit };

  const moveResponder = useRef(createDragResponder("move", latest, setDrag)).current;
  const startResponder = useRef(createDragResponder("start", latest, setDrag)).current;
  const endResponder = useRef(createDragResponder("end", latest, setDrag)).current;

  let visualLeft = baseLeft;
  let visualWidth = baseWidth;
  if (drag) {
    if (drag.mode === "move") visualLeft = baseLeft + drag.deltaPx;
    else if (drag.mode === "start") {
      visualLeft = baseLeft + drag.deltaPx;
      visualWidth = Math.max(dayWidth - 4, baseWidth - drag.deltaPx);
    } else {
      visualWidth = Math.max(dayWidth - 4, baseWidth + drag.deltaPx);
    }
  }

  const handleWidth = isMobile ? 18 : 10;
  const cursorStyle = Platform.select({ web: { cursor: canEdit ? (drag?.mode === "move" ? "grabbing" : "grab") : "pointer" } as any, default: {} });
  const resizeCursor = Platform.select({ web: { cursor: "ew-resize" } as any, default: {} });

  return (
    <View style={{ position: "absolute", top: (ROW_HEIGHT - BAR_HEIGHT) / 2, left: visualLeft, width: visualWidth, height: BAR_HEIGHT, flexDirection: "row" }}>
      {canEdit && <View {...startResponder.panHandlers} style={[{ width: handleWidth, height: BAR_HEIGHT }, resizeCursor]} />}
      <View
        {...moveResponder.panHandlers}
        style={[styles.barBody, { backgroundColor: TASK_PRIORITY_COLORS[task.priority], flex: 1 }, cursorStyle]}
      >
        <Text numberOfLines={1} style={styles.barText}>
          {task.title}
        </Text>
      </View>
      {canEdit && <View {...endResponder.panHandlers} style={[{ width: handleWidth, height: BAR_HEIGHT }, resizeCursor]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderWidth: 1, borderRadius: 24, overflow: "hidden" },
  emptyCard: { borderRadius: 24, borderWidth: 1, padding: 24, alignItems: "center" },

  labelHeaderCell: { height: 20 + 28, justifyContent: "flex-end", paddingBottom: 6, paddingHorizontal: 12, borderBottomWidth: 1, borderRightWidth: 1 },
  labelCell: { height: ROW_HEIGHT, justifyContent: "center", paddingHorizontal: 12, borderRightWidth: 1 },

  monthRow: { flexDirection: "row", height: 20, borderBottomWidth: 1 },
  dayRow: { flexDirection: "row", height: 28, borderBottomWidth: 1 },
  dayCell: { width: DAY_WIDTH, alignItems: "center", justifyContent: "center" },

  barBody: { borderRadius: 10, justifyContent: "center", paddingHorizontal: 8 },
  barText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
});
