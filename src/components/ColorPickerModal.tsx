import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Check, X } from "lucide-react-native";

const AZURE_DEEP = "#2C7BD1";

const HUE_GRADIENT = ["#FF0000", "#FFFF00", "#00FF00", "#00FFFF", "#0000FF", "#FF00FF", "#FF0000"] as const;
const BAR_HEIGHT = 16;
const THUMB_SIZE = 24;

function hsvToHex(h: number, s: number, v: number) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function hexToHue(hex: string) {
  const clean = hex.replace("#", "");
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return null;
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}

type Props = {
  visible: boolean;
  initialColor: string;
  isDark: boolean;
  onClose: () => void;
  onConfirm: (hex: string) => void;
};

export default function ColorPickerModal({ visible, initialColor, isDark, onClose, onConfirm }: Props) {
  const [hue, setHue] = useState(0);
  const [hex, setHex] = useState(initialColor);
  const [barWidth, setBarWidth] = useState(0);
  const barRef = useRef<View>(null);
  const barWidthRef = useRef(0);
  const barPageXRef = useRef(0);

  const cardBg        = isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.85)";
  const border         = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary    = isDark ? "#F8FAFC" : "#101828";
  const textSecondary  = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor   = AZURE_DEEP;
  const inputBg        = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";

  const ultraShadow = {
    ...Platform.select({
      web: {
        boxShadow: isDark
          ? "0 30px 60px -25px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.08) inset"
          : "0 30px 60px -22px rgba(44,123,209,0.18), 0 1px 0 rgba(255,255,255,0.9) inset",
        backdropFilter: "blur(32px) saturate(200%)",
      } as any,
      default: {
        shadowColor: isDark ? "#000" : "#2C7BD1",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: isDark ? 0.35 : 0.1,
        shadowRadius: 22,
        elevation: 6,
      },
    }),
    borderTopColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.9)",
  };

  useEffect(() => {
    if (visible) {
      setHex(initialColor.toUpperCase());
      setHue(hexToHue(initialColor) ?? 0);
      // Modal recién montado: espera al layout antes de medir la barra
      requestAnimationFrame(measureBar);
    }
  }, [visible, initialColor]);

  const measureBar = () => {
    barRef.current?.measure((_x, _y, width, _height, pageX) => {
      barWidthRef.current = width;
      barPageXRef.current = pageX;
      setBarWidth(width);
    });
  };

  // refs porque PanResponder se crea una sola vez y, si leyera del state,
  // quedaría con el valor (0) que existía en el primer render.
  const updateFromPageX = (pageX: number) => {
    const width = barWidthRef.current;
    if (width <= 0) return;
    const relativeX = pageX - barPageXRef.current;
    const clamped = Math.max(0, Math.min(width, relativeX));
    const nextHue = (clamped / width) * 360;
    setHue(nextHue);
    setHex(hsvToHex(nextHue, 1, 1));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_e, gestureState) => updateFromPageX(gestureState.x0),
      onPanResponderMove: (_e, gestureState) => updateFromPageX(gestureState.moveX),
    })
  ).current;

  const handleHexChange = (value: string) => {
    const clean = value.startsWith("#") ? value : `#${value}`;
    setHex(clean.toUpperCase());
    const parsedHue = hexToHue(clean);
    if (parsedHue !== null) setHue(parsedHue);
  };

  const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(hex);
  const thumbLeft = barWidth > 0 ? (hue / 360) * barWidth - THUMB_SIZE / 2 : -THUMB_SIZE / 2;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: textPrimary }]}>Personalizar color</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color={textSecondary} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <View style={styles.previewRow}>
            <View style={[styles.previewCircle, { backgroundColor: isValidHex ? hex : "#CBD5E1", borderColor: border }]}>
              {isValidHex && <Check size={20} color="#FFF" strokeWidth={2.3} />}
            </View>
            <Text style={[styles.previewHex, { color: textSecondary }]}>{hex}</Text>
          </View>

          <View
            ref={barRef}
            style={[styles.hueBar, { borderColor: border }]}
            onLayout={measureBar}
            {...panResponder.panHandlers}
          >
            <LinearGradient
              colors={HUE_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <View
              pointerEvents="none"
              style={[
                styles.thumb,
                { left: thumbLeft, backgroundColor: hex, borderColor: isDark ? "#0F172A" : "#FFF" },
              ]}
            />
          </View>

          <View style={[styles.hexInputWrapper, { backgroundColor: inputBg, borderColor: border }]}>
            <Text style={[styles.hexPrefix, { color: textSecondary }]}>#</Text>
            <TextInput
              value={hex.replace("#", "")}
              onChangeText={(v) => handleHexChange(v)}
              autoCapitalize="characters"
              maxLength={6}
              placeholder="2C7BD1"
              placeholderTextColor={textSecondary}
              style={[styles.hexInput, { color: textPrimary }, Platform.OS === "web" && styles.noOutline]}
            />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity activeOpacity={0.85} style={[styles.btnSecondary, { borderColor: border }]} onPress={onClose}>
              <Text style={[styles.btnSecondaryText, { color: textPrimary }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!isValidHex}
              style={[styles.btnPrimary, { backgroundColor: primaryColor, opacity: isValidHex ? 1 : 0.5 }]}
              onPress={() => isValidHex && onConfirm(hex)}
            >
              <Text style={styles.btnPrimaryText}>Usar este color</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    ...Platform.select({ web: { backdropFilter: "blur(4px)" } as any, default: {} }),
  },
  card: {
    width: "100%", maxWidth: 360, borderRadius: 28, borderWidth: 1, padding: 24,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  title: { fontSize: 17, fontWeight: "700", letterSpacing: -0.3 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  previewCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  previewHex: { fontSize: 14, fontWeight: "600", letterSpacing: 1 },
  hueBar: {
    height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, borderWidth: 1, overflow: "visible", marginBottom: 20, justifyContent: "center",
  },
  thumb: {
    position: "absolute", width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2, borderWidth: 3,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4,
  },
  hexInputWrapper: {
    flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, marginBottom: 24,
  },
  hexPrefix: { fontSize: 15, fontWeight: "600" },
  hexInput: { flex: 1, paddingVertical: 14, paddingLeft: 4, fontSize: 15, letterSpacing: 1 },
  noOutline: { outlineStyle: "none" } as any,
  actions: { flexDirection: "row", gap: 12 },
  btnSecondary: { flex: 1, borderWidth: 1, borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  btnSecondaryText: { fontWeight: "600", fontSize: 14 },
  btnPrimary: { flex: 1.4, borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  btnPrimaryText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});
