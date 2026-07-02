import React, { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

type Props = {
  visible: boolean;
  initialDate?: string | null;
  isDark: boolean;
  onClose: () => void;
  onConfirm: (isoDate: string) => void;
};

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTH_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function DatePickerModal({ visible, initialDate, isDark, onClose, onConfirm }: Props) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today);
  const [selected, setSelected] = useState(today);

  useEffect(() => {
    if (!visible) return;
    const base = initialDate ? new Date(`${initialDate}T00:00:00`) : new Date();
    setViewMonth(base);
    setSelected(base);
  }, [visible, initialDate]);

  const cardBg        = isDark ? "#0F172A" : "#FFFFFF";
  const border        = isDark ? "rgba(51, 65, 85, 0.6)" : "rgba(226, 232, 240, 0.9)";
  const textPrimary   = isDark ? "#F8FAFC" : "#020617";
  const textSecondary = isDark ? "#94A3B8" : "#475569";
  const primaryColor  = "#2563EB";

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.header}>
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
              <Text key={i} style={[styles.weekLabel, { color: textSecondary }]}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((cell, idx) => {
              if (!cell) return <View key={idx} style={styles.dayCell} />;
              const selectedDay = isSameDay(cell, selected);
              const isToday = isSameDay(cell, today);
              return (
                <View key={idx} style={styles.dayCell}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setSelected(cell)}
                    style={[
                      styles.dayTouchable,
                      selectedDay && { backgroundColor: primaryColor },
                      !selectedDay && isToday && { borderWidth: 1.5, borderColor: primaryColor },
                    ]}
                  >
                    <Text style={{ color: selectedDay ? "#FFF" : textPrimary, fontWeight: selectedDay ? "800" : "600", fontSize: 13 }}>
                      {cell.getDate()}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity activeOpacity={0.85} style={[styles.btnSecondary, { borderColor: border }]} onPress={onClose}>
              <Text style={[styles.btnSecondaryText, { color: textPrimary }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.btnPrimary, { backgroundColor: primaryColor }]}
              onPress={() => onConfirm(toIso(selected))}
            >
              <Text style={styles.btnPrimaryText}>Usar esta fecha</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(2, 6, 23, 0.6)", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 340, borderRadius: 24, borderWidth: 1, padding: 22 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  monthLabel: { fontSize: 15, fontWeight: "800" },
  weekRow: { flexDirection: "row", marginBottom: 6 },
  weekLabel: { width: `${100 / 7}%`, textAlign: "center", fontSize: 11, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayTouchable: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", gap: 12, marginTop: 18 },
  btnSecondary: { flex: 1, borderWidth: 1, borderRadius: 999, paddingVertical: 12, alignItems: "center" },
  btnSecondaryText: { fontWeight: "600", fontSize: 13 },
  btnPrimary: { flex: 1.4, borderRadius: 999, paddingVertical: 12, alignItems: "center" },
  btnPrimaryText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
});
