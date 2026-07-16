import React, { useRef } from "react";
import { PanResponder, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  value: number;
  max?: number;
  activeColor: string;
  trackColor: string;
  onChange?: (value: number) => void;
  disabled?: boolean;
};

// En mobile, este control vive dentro de listas que a su vez viven dentro de
// un ScrollView vertical (ProfileEditorForm). El PanResponder solo debe
// reclamar el gesto cuando el movimiento es claramente horizontal (arrastrar
// para ajustar el nivel) — si reclamara en cualquier toque (incluido el
// arranque de un scroll vertical que pase por encima de esta fila), bloquea
// el scroll de toda la pantalla y cambia el valor sin que el usuario lo
// busque. Por eso onStartShouldSetPanResponder es false (nunca reclama de
// entrada) y onMoveShouldSetPanResponder exige que |dx| > |dy|. La selección
// por toque directo (tocar un punto puntual) se resuelve aparte, con un
// TouchableOpacity por punto — así conviven con el ScrollView sin este hack.
export default function LevelDots({ value, max = 10, activeColor, trackColor, onChange, disabled }: Props) {
  const rowRef = useRef<View>(null);
  const widthRef = useRef(0);
  const pageXRef = useRef(0);

  const measure = () => {
    rowRef.current?.measure((_x, _y, width, _height, pageX) => {
      widthRef.current = width;
      pageXRef.current = pageX;
    });
  };

  const updateFromPageX = (pageX: number) => {
    const width = widthRef.current;
    if (width <= 0 || !onChange) return;
    const relativeX = pageX - pageXRef.current;
    const clamped = Math.max(0, Math.min(width, relativeX));
    const step = Math.min(max, Math.max(1, Math.ceil((clamped / width) * max)));
    onChange(step);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, gestureState) =>
        !disabled && Math.abs(gestureState.dx) > 6 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onPanResponderGrant: (_e, gestureState) => updateFromPageX(gestureState.moveX),
      onPanResponderMove: (_e, gestureState) => updateFromPageX(gestureState.moveX),
      onPanResponderTerminationRequest: () => true,
      onShouldBlockNativeResponder: () => false,
    })
  ).current;

  return (
    <View style={styles.wrapper}>
      <View ref={rowRef} onLayout={measure} style={styles.row} {...(disabled ? {} : panResponder.panHandlers)}>
        {Array.from({ length: max }).map((_, i) => {
          const active = i < value;
          const isCurrent = i === value - 1;
          const dot = (
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: active ? activeColor : trackColor,
                  transform: [{ scale: isCurrent ? 1.35 : 1 }],
                },
              ]}
            />
          );
          if (disabled) {
            return <View key={i}>{dot}</View>;
          }
          return (
            <TouchableOpacity key={i} activeOpacity={0.7} hitSlop={4} onPress={() => onChange?.(i + 1)}>
              {dot}
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.value, { color: activeColor }]}>
        {value}/{max}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 10 },
  dot: { width: 13, height: 13, borderRadius: 7 },
  value: { fontSize: 12, fontWeight: "800", minWidth: 32, textAlign: "right" },
});
